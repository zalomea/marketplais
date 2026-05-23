import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Real USDC contract on Base mainnet (available via fork)
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
// Top USDC holder on Base — used to fund the faucet via impersonation
const WHALE_ADDRESS = "0x8da91A6298eA5d1A8Bc985e99798fd0A0f05701a";

const FEE_BPS = 1000n; // 10% platform fee (1000 basis points) — immutable, set at deploy time
const AGENT_ID = 1n; // ID of the agent registered in the mock registry
const PAYMENT_AMOUNT = ethers.parseUnits("100", 6); // 100 USDC (6 decimals)

describe("MarketplaceRouter", function () {
  let router: Contract;
  let usdc: Contract;
  let faucet: Contract;
  let mockRegistry: Contract;
  let owner: SignerWithAddress; // Platform admin — deploys and manages the router
  let agent: SignerWithAddress; // AI Agent owner — receives payments
  let client: SignerWithAddress; // Payer — initiates payments to agents

  // Runs before each test: deploys all contracts and funds the client with 1,000 USDC
  beforeEach(async function () {
    [owner, agent, client] = await ethers.getSigners();

    // 1. Get USDC contract instance from the forked Base mainnet
    usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);

    // 2. Fund the whale with ETH so it can pay for gas on the local fork
    await ethers.provider.send("hardhat_setBalance", [WHALE_ADDRESS, "0x8AC7230489E80000"]);

    // 3. Impersonate the whale to act on its behalf (Hardhat fork feature)
    await ethers.provider.send("hardhat_impersonateAccount", [WHALE_ADDRESS]);
    const whaleSigner = await ethers.getSigner(WHALE_ADDRESS);

    // 4. Deploy the USDCFaucet contract using the whale as the deployer/signer
    const FaucetFactory = await ethers.getContractFactory("USDCFaucet", whaleSigner);
    faucet = await FaucetFactory.deploy(USDC_ADDRESS);
    await faucet.waitForDeployment();

    // 5. Transfer 1,000,000 USDC from the whale to the faucet so it has funds to distribute
    const usdcAsWhale = usdc.connect(whaleSigner);
    await usdcAsWhale.transfer(await faucet.getAddress(), ethers.parseUnits("1000000", 6));

    // 6. Stop impersonating the whale — no longer needed
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [WHALE_ADDRESS]);

    // 7. Client calls requestTokens() to receive 1,000 USDC from the faucet
    await faucet.connect(client).requestTokens();

    // 8. Deploy the MockERC8004Registry and register agent #1 with agent.address as its wallet
    // The mock simulates the real ERC-8004 IdentityRegistry without requiring the full protocol
    const MockRegistryFactory = await ethers.getContractFactory("MockERC8004Registry");
    mockRegistry = await MockRegistryFactory.deploy();
    await mockRegistry.waitForDeployment();
    await mockRegistry.registerAgent(AGENT_ID, agent.address);

    // 9. Deploy the MarketplaceRouter with USDC, the mock registry, and a 10% platform fee
    const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
    router = await RouterFactory.deploy(USDC_ADDRESS, await mockRegistry.getAddress(), FEE_BPS);
    await router.waitForDeployment();
  });

  // ─── Initial Setup ────────────────────────────────────────────────────────
  // Verifies that the test environment is correctly configured before each test

  describe("Initial Setup", function () {
    it("Should fund the client with 1,000 USDC via the Faucet", async function () {
      // Confirms the full setup chain worked:
      // whale impersonated → faucet deployed → faucet funded → client called requestTokens()
      const balance = await usdc.balanceOf(client.address);
      expect(balance).to.equal(ethers.parseUnits("1000", 6));
    });
  });

  // ─── Deployment State ─────────────────────────────────────────────────────
  // Verifies that the constructor correctly initializes all contract state variables

  describe("Deployment state", function () {
    it("Should initialize feeBps with the value passed to the constructor", async function () {
      // Ensures the fee is stored correctly and readable as a public variable
      expect(await router.feeBps()).to.equal(FEE_BPS);
    });

    it("Should initialize the IdentityRegistry address with the value passed to the constructor", async function () {
      // Ensures the router will query the correct registry on every payment
      expect(await router.identityRegistry()).to.equal(await mockRegistry.getAddress());
    });

    it("Should initialize the treasury address with the value passed to the constructor", async function () {
      // Deploys a new router with a dedicated treasury to verify it is stored correctly
      // Treasury is separate from owner: owner manages the contract, treasury receives platform fees
      const [, , , , treasury] = await ethers.getSigners();

      const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
      const routerWithTreasury = await RouterFactory.deploy(
        USDC_ADDRESS,
        await mockRegistry.getAddress(),
        FEE_BPS,
        treasury.address,
      );
      await routerWithTreasury.waitForDeployment();

      expect(await routerWithTreasury.treasury()).to.equal(treasury.address);
    });

    it("Should have zero USDC balance after deployment (router must not retain funds)", async function () {
      // The router is a pass-through contract — it should never hold USDC at rest
      expect(await usdc.balanceOf(await router.getAddress())).to.equal(0n);
    });

    it("Should have zero USDC balance after a payment (router must not retain funds)", async function () {
      // Verifies that all USDC is forwarded to agent and treasury in a single transaction
      // Any leftover balance would indicate a bug or potential fund lock
      await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT);
      await router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);

      expect(await usdc.balanceOf(await router.getAddress())).to.equal(0n);
    });
  });

  // ─── Fee Split ────────────────────────────────────────────────────────────
  // Verifies the payment math: correct amounts reach agent and treasury, and client is debited

  describe("Fee split", function () {
    it("Should transfer 90 USDC to the agent and 10 USDC to the platform", async function () {
      // Standard payment: 100 USDC in, 90 to agent (after 10% fee), 10 to platform treasury
      const agentBalanceBefore = await usdc.balanceOf(agent.address);
      const platformBalanceBefore = await usdc.balanceOf(owner.address);

      await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT);
      await router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);

      const expectedFee = (PAYMENT_AMOUNT * FEE_BPS) / 10000n; // 10 USDC
      const expectedAgentAmount = PAYMENT_AMOUNT - expectedFee; // 90 USDC

      expect(await usdc.balanceOf(agent.address)).to.equal(agentBalanceBefore + expectedAgentAmount);
      expect(await usdc.balanceOf(owner.address)).to.equal(platformBalanceBefore + expectedFee);
    });

    it("Should deduct the full payment amount from the client balance", async function () {
      // Verifies that transferFrom correctly debits the full amount from the client
      // Ensures the router does not spend more or less than what was approved
      const clientBalanceBefore = await usdc.balanceOf(client.address);

      await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT);
      await router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);

      expect(await usdc.balanceOf(client.address)).to.equal(clientBalanceBefore - PAYMENT_AMOUNT);
    });

    it("Should maintain the total USDC supply intact (invariant)", async function () {
      // Conservation of funds: total USDC does not appear or disappear during routing
      // What left the client must exactly equal what arrived at agent + platform
      const clientBefore = await usdc.balanceOf(client.address);
      const agentBefore = await usdc.balanceOf(agent.address);
      const platformBefore = await usdc.balanceOf(owner.address);

      await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT);
      await router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);

      const clientAfter = await usdc.balanceOf(client.address);
      const agentAfter = await usdc.balanceOf(agent.address);
      const platformAfter = await usdc.balanceOf(owner.address);

      expect(clientBefore - clientAfter).to.equal(agentAfter - agentBefore + platformAfter - platformBefore);
    });

    it("Should send the platform fee to the treasury address, not the owner", async function () {
      // Verifies the separation of concerns: owner manages the contract, treasury receives fees
      // If the router used owner() instead of treasury, this test would fail after ownership transfer
      const [, , , , treasury] = await ethers.getSigners();

      const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
      const routerWithTreasury = await RouterFactory.deploy(
        USDC_ADDRESS,
        await mockRegistry.getAddress(),
        FEE_BPS,
        treasury.address,
      );
      await routerWithTreasury.waitForDeployment();

      await usdc.connect(client).approve(await routerWithTreasury.getAddress(), PAYMENT_AMOUNT);

      const treasuryBalanceBefore = await usdc.balanceOf(treasury.address);
      const ownerBalanceBefore = await usdc.balanceOf(owner.address);

      await routerWithTreasury.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);

      const expectedFee = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;

      expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBalanceBefore + expectedFee);
      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBalanceBefore);
    });

    it("Should correctly handle dust payments (fee truncates to 0 due to integer precision)", async function () {
      // Solidity uses integer division: (9 * 1000) / 10000 = 0.9 → truncates to 0
      // In this case the agent receives the full dust amount and the platform receives nothing
      const DUST_AMOUNT = 9n; // 9 USDC wei — below the minimum for a non-zero fee at 10%
      await usdc.connect(client).approve(await router.getAddress(), DUST_AMOUNT);

      const agentBalanceBefore = await usdc.balanceOf(agent.address);
      const platformBalanceBefore = await usdc.balanceOf(owner.address);

      await router.connect(client).payAgent(AGENT_ID, DUST_AMOUNT);

      expect(await usdc.balanceOf(agent.address)).to.equal(agentBalanceBefore + DUST_AMOUNT);
      expect(await usdc.balanceOf(owner.address)).to.equal(platformBalanceBefore);
    });

    it("Should handle payment at the exact limit of client balance", async function () {
      // Edge case: client spends their entire balance in one payment
      // Verifies no off-by-one errors and that the client ends at exactly 0
      const fullBalance = ethers.parseUnits("1000", 6);

      await usdc.connect(client).approve(await router.getAddress(), fullBalance);
      await router.connect(client).payAgent(AGENT_ID, fullBalance);

      const expectedFee = (fullBalance * FEE_BPS) / 10000n;
      const expectedAgentAmount = fullBalance - expectedFee;

      expect(await usdc.balanceOf(client.address)).to.equal(0n);
      expect(await usdc.balanceOf(agent.address)).to.equal(expectedAgentAmount);
      expect(await usdc.balanceOf(owner.address)).to.equal(expectedFee);
    });

    it("Should handle a payment of 1 wei of USDC", async function () {
      // Minimum possible payment: (1 * 1000) / 10000 = 0.1 → truncates to 0
      // Verifies the contract does not revert or behave unexpectedly at the absolute minimum
      const ONE_WEI = 1n;
      await usdc.connect(client).approve(await router.getAddress(), ONE_WEI);

      const agentBalanceBefore = await usdc.balanceOf(agent.address);
      const platformBalanceBefore = await usdc.balanceOf(owner.address);

      await router.connect(client).payAgent(AGENT_ID, ONE_WEI);

      expect(await usdc.balanceOf(agent.address)).to.equal(agentBalanceBefore + ONE_WEI);
      expect(await usdc.balanceOf(owner.address)).to.equal(platformBalanceBefore);
    });

    it("Should handle payment with allowance set to exactly the payment amount", async function () {
      // Verifies that the router does not attempt to spend more than what was approved
      // If the contract tried to spend even 1 wei extra, the ERC-20 transferFrom would revert
      await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT);
      await router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);

      const expectedFee = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;
      const expectedAgentAmount = PAYMENT_AMOUNT - expectedFee;

      expect(await usdc.balanceOf(agent.address)).to.equal(expectedAgentAmount);
      expect(await usdc.balanceOf(owner.address)).to.equal(expectedFee);
    });
  });

  // ─── IdentityRegistry Routing ─────────────────────────────────────────────
  // Verifies that the router always fetches the agent wallet from the registry at call time

  describe("IdentityRegistry routing", function () {
    it("Should route payment to the wallet registered in the IdentityRegistry, not a hardcoded address", async function () {
      // Overrides agentId=1 to point to thirdParty instead of agent.address
      // The only way this test passes is if the router queries the registry at payment time
      const [, , , thirdParty] = await ethers.getSigners();

      await mockRegistry.registerAgent(AGENT_ID, thirdParty.address);

      await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT);
      await router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);

      const expectedFee = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;
      const expectedAgentAmount = PAYMENT_AMOUNT - expectedFee;

      expect(await usdc.balanceOf(thirdParty.address)).to.equal(expectedAgentAmount);
      expect(await usdc.balanceOf(agent.address)).to.equal(0n);
    });

    it("Should route payments to the correct wallet when paying two different agents", async function () {
      // Verifies the router does not mix up wallets between different agent IDs
      // If there were any caching or state bug, one agent would receive the other's payment
      const AGENT_ID_2 = 2n;
      const [, , , secondAgent] = await ethers.getSigners();

      await mockRegistry.registerAgent(AGENT_ID_2, secondAgent.address);

      await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT * 2n);
      await router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);
      await router.connect(client).payAgent(AGENT_ID_2, PAYMENT_AMOUNT);

      const expectedFee = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;
      const expectedAgentAmount = PAYMENT_AMOUNT - expectedFee;

      expect(await usdc.balanceOf(agent.address)).to.equal(expectedAgentAmount);
      expect(await usdc.balanceOf(secondAgent.address)).to.equal(expectedAgentAmount);
    });

    it("Should route correctly to an agent registered after the router was deployed", async function () {
      // Verifies the router queries the registry dynamically at payment time, not at deploy time
      // A new agent registered after deploy must be payable without redeploying the router
      const AGENT_ID_3 = 3n;
      const [, , , , , lateAgent] = await ethers.getSigners();

      await mockRegistry.registerAgent(AGENT_ID_3, lateAgent.address);

      await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT);
      await router.connect(client).payAgent(AGENT_ID_3, PAYMENT_AMOUNT);

      const expectedFee = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;
      const expectedAgentAmount = PAYMENT_AMOUNT - expectedFee;

      expect(await usdc.balanceOf(lateAgent.address)).to.equal(expectedAgentAmount);
    });

    it("Should correctly accumulate balances after multiple payments to the same agent", async function () {
      // Verifies there is no internal state that resets or corrupts between consecutive calls
      // Both payments use the same approval (approved 2x the amount upfront)
      const agentBalanceBefore = await usdc.balanceOf(agent.address);
      const platformBalanceBefore = await usdc.balanceOf(owner.address);

      await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT * 2n);
      await router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);
      await router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);

      const expectedFee = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;
      const expectedAgentAmount = PAYMENT_AMOUNT - expectedFee;

      expect(await usdc.balanceOf(agent.address)).to.equal(agentBalanceBefore + expectedAgentAmount * 2n);
      expect(await usdc.balanceOf(owner.address)).to.equal(platformBalanceBefore + expectedFee * 2n);
      expect(await usdc.balanceOf(client.address)).to.equal(ethers.parseUnits("1000", 6) - PAYMENT_AMOUNT * 2n);
    });

    it("Should correctly accumulate balances when multiple clients pay the same agent", async function () {
      // Verifies the router handles concurrent clients without mixing balances
      // Both clients fund independently via the faucet and pay separately
      const [, , , secondClient] = await ethers.getSigners();

      await faucet.connect(secondClient).requestTokens();

      const agentBalanceBefore = await usdc.balanceOf(agent.address);

      await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT);
      await usdc.connect(secondClient).approve(await router.getAddress(), PAYMENT_AMOUNT);

      await router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);
      await router.connect(secondClient).payAgent(AGENT_ID, PAYMENT_AMOUNT);

      const expectedFee = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;
      const expectedAgentAmount = PAYMENT_AMOUNT - expectedFee;

      expect(await usdc.balanceOf(agent.address)).to.equal(agentBalanceBefore + expectedAgentAmount * 2n);
    });
  });

  // ─── Event ────────────────────────────────────────────────────────────────
  // Verifies that the PaymentRouted event is emitted correctly for the x402 middleware

  describe("Event", function () {
    it("Should emit PaymentRouted event with correct args (critical for x402 middleware)", async function () {
      // The x402 middleware listens for this event to confirm payment on-chain
      // All three args must match exactly: client address, agent ID, and full payment amount
      await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT);

      await expect(router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT))
        .to.emit(router, "PaymentRouted")
        .withArgs(client.address, AGENT_ID, PAYMENT_AMOUNT);
    });
  });

  it("Should apply the updated fee after owner calls setFeeBps()", async function () {
    // Verifies that the new fee is used on the very next payment after the update
    // Changed from 10% (1000 bps) to 20% (2000 bps): agent should receive 80 USDC
    const NEW_FEE_BPS = 2000n;
    await router.connect(owner).setFeeBps(NEW_FEE_BPS);

    await usdc.connect(client).approve(await router.getAddress(), PAYMENT_AMOUNT);

    const agentBalanceBefore = await usdc.balanceOf(agent.address);
    const platformBalanceBefore = await usdc.balanceOf(owner.address);

    await router.connect(client).payAgent(AGENT_ID, PAYMENT_AMOUNT);

    const expectedFee = (PAYMENT_AMOUNT * NEW_FEE_BPS) / 10000n; // 20 USDC
    const expectedAgentAmount = PAYMENT_AMOUNT - expectedFee; // 80 USDC

    expect(await usdc.balanceOf(agent.address)).to.equal(agentBalanceBefore + expectedAgentAmount);
    expect(await usdc.balanceOf(owner.address)).to.equal(platformBalanceBefore + expectedFee);
  });
});
