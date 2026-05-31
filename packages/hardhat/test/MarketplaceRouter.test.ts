import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signature } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// ─── Network constants (Base mainnet fork) ────────────────────────────────────
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WHALE_ADDRESS = "0x8da91A6298eA5d1A8Bc985e99798fd0A0f05701a";

// ─── Contract parameters ──────────────────────────────────────────────────────

// 10% platform fee expressed in basis points (1 bps = 0.01%)
const FEE_BPS = 1000n;

// Agent price set at registration: 100 USDC (6 decimals)
const AGENT_PRICE = ethers.parseUnits("100", 6);

const AGENT_URI = "ipfs://QmTestAgentURI";

// Fee is added ON TOP of the agent price: fee = price * feeBps / 10000
// Client pays: price + fee. Agent accumulates: price. Router retains: fee.
const PLATFORM_FEE = (AGENT_PRICE * FEE_BPS) / 10000n;
const TOTAL_PAYMENT = AGENT_PRICE + PLATFORM_FEE;

// ─── EIP-3009 helpers ─────────────────────────────────────────────────────────

/**
 * Builds a valid EIP-3009 typed signature for transferWithAuthorization.
 * Uses chainId 31337 to match the Hardhat fork's local chain identifier.
 * The domain matches the real USDC contract deployed on Base mainnet.
 */
async function buildTransferAuthorization(
  signer: SignerWithAddress,
  to: string,
  value: bigint,
  validUntil: number,
  nonce: string,
  validAfter: number = 0,
): Promise<{ v: number; r: string; s: string }> {
  const domain = {
    name: "USD Coin",
    version: "2",
    // Hardhat fork preserves the local chainId (31337), not Base mainnet's (8453)
    chainId: 31337,
    verifyingContract: USDC_ADDRESS,
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const message = {
    from: signer.address,
    to,
    value,
    validAfter,
    validBefore: validUntil,
    nonce,
  };

  const rawSig = await signer.signTypedData(domain, types, message);
  const sig = Signature.from(rawSig);
  return { v: sig.v, r: sig.r, s: sig.s };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("MarketplaceRouter", function () {
  let router: Contract;
  let agentMarketplace: Contract;
  let mockRegistry: Contract;
  let mockReputation: Contract;
  let usdc: Contract;

  // Router deployer — only address allowed to call processAgentPaymentAndReputation
  let owner: SignerWithAddress;
  // Receives accumulated platform fees on withdrawFees()
  let treasury: SignerWithAddress;
  // Registered agent owner — receives earnings on withdrawAgentEarnings()
  let agentOwner: SignerWithAddress;
  // Signs EIP-3009 authorizations and pays for agent services
  let client: SignerWithAddress;

  let agentId: bigint;
  let routerAddress: string;

  // Snapshot ID used to restore blockchain state between tests
  let snapshotId: string;

  // ─── before ─────────────────────────────────────────────────────────────────
  // Runs ONCE before all tests. Deploys all contracts and funds the client.
  // This avoids repeating expensive fork calls and deploys on every test.
  before(async function () {
    [owner, treasury, agentOwner, client] = await ethers.getSigners();

    // Attach to the real USDC contract already deployed on the Base mainnet fork
    usdc = await ethers.getContractAt("IUSDC", USDC_ADDRESS);

    // Fund the whale with ETH so it can pay gas on the local network
    await ethers.provider.send("hardhat_setBalance", [WHALE_ADDRESS, "0x8AC7230489E80000"]);

    // Impersonate the whale account to transfer USDC without needing its private key
    await ethers.provider.send("hardhat_impersonateAccount", [WHALE_ADDRESS]);
    const whaleSigner = await ethers.getSigner(WHALE_ADDRESS);

    // Transfer 1,000 USDC from the whale directly to the test client
    await usdc.connect(whaleSigner).transfer(client.address, ethers.parseUnits("1000", 6));

    // Stop impersonation immediately after the transfer to keep the environment clean
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [WHALE_ADDRESS]);

    // Deploy the mock identity registry to avoid Base mainnet ERC-8004 dependencies
    const MockRegistryFactory = await ethers.getContractFactory("MockIdentityRegistry");
    mockRegistry = await MockRegistryFactory.deploy();
    await mockRegistry.waitForDeployment();

    // Deploy the mock reputation registry to avoid Base mainnet ERC-8004 dependencies
    const MockReputationFactory = await ethers.getContractFactory("MockReputationRegistry");
    mockReputation = await MockReputationFactory.deploy();
    await mockReputation.waitForDeployment();

    // Deploy AgentMarketplace pointing to the mock registry
    const AgentMarketplaceFactory = await ethers.getContractFactory("AgentMarketplace");
    agentMarketplace = await AgentMarketplaceFactory.deploy(await mockRegistry.getAddress());
    await agentMarketplace.waitForDeployment();

    // Register an agent with 100 USDC price and payToAgentWallet=false (pay to owner address)
    const tx = await agentMarketplace.connect(agentOwner).register(AGENT_PRICE, AGENT_URI, false);
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((log: any) => {
        try {
          return agentMarketplace.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e?.name === "AgentRegistered");
    agentId = event?.args.agentId;

    // Deploy the MarketplaceRouter with the marketplace, reputation registry, USDC token, fee, and treasury
    const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
    router = await RouterFactory.deploy(
      await agentMarketplace.getAddress(),
      await mockReputation.getAddress(),
      USDC_ADDRESS,
      FEE_BPS,
      treasury.address,
    );
    await router.waitForDeployment();
    routerAddress = await router.getAddress();
  });

  // ─── beforeEach / afterEach ──────────────────────────────────────────────────
  // Snapshot the EVM state before each test and revert after.
  // This gives every test a clean slate without redeploying contracts.
  beforeEach(async function () {
    snapshotId = await ethers.provider.send("evm_snapshot", []);
  });

  afterEach(async function () {
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  // ─── Helper: get current block timestamp from the fork ───────────────────────

  /**
   * Returns the timestamp of the latest block on the forked network.
   * Must be used instead of Date.now() to avoid EIP-3009 signature expiry
   * mismatches caused by the fork's block time being in the past.
   */
  async function getBlockTimestamp(): Promise<number> {
    const block = await ethers.provider.getBlock("latest");
    return block!.timestamp;
  }

  // ─── Helper: process a valid payment ────────────────────────────────────────

  /**
   * Builds and submits a complete valid payment flow:
   * signs an EIP-3009 authorization and calls processAgentPaymentAndReputation as the owner.
   * Returns the nonce used so tests can reference it for replay-attack checks.
   */
  async function processPayment(amount: bigint = TOTAL_PAYMENT, customNonce?: string): Promise<string> {
    const nonce = customNonce ?? ethers.hexlify(ethers.randomBytes(32));
    // Authorize the transfer for 24 hours from the current block timestamp
    const validUntil = (await getBlockTimestamp()) + 86400;
    const { v, r, s } = await buildTransferAuthorization(client, routerAddress, amount, validUntil, nonce);
    const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

    await router
      .connect(owner)
      .processAgentPaymentAndReputation(client.address, agentId, amount, validUntil, nonce, sig);
    return nonce;
  }

  // ─── Initial Setup ───────────────────────────────────────────────────────────

  describe("Initial Setup", function () {
    it("Should fund the client with 1,000 USDC", async function () {
      expect(await usdc.balanceOf(client.address)).to.equal(ethers.parseUnits("1000", 6));
    });

    it("Should register an agent with the correct price", async function () {
      const agent = await agentMarketplace.getAgent(agentId);
      expect(agent.price).to.equal(AGENT_PRICE);
      expect(agent.active).to.equal(true);
    });
  });

  // ─── Deployment State ────────────────────────────────────────────────────────

  describe("Deployment state", function () {
    it("Should initialize feeBps with the value passed to the constructor", async function () {
      expect(await router.feeBps()).to.equal(FEE_BPS);
    });

    it("Should initialize treasury with the address passed to the constructor", async function () {
      expect(await router.treasury()).to.equal(treasury.address);
    });

    it("Should initialize owner as the deployer", async function () {
      expect(await router.owner()).to.equal(owner.address);
    });

    it("Should have zero USDC balance after deployment", async function () {
      expect(await usdc.balanceOf(routerAddress)).to.equal(0n);
    });
  });

  // ─── processAgentPaymentAndReputation ─────────────────────────────────────────────────────

  describe("processAgentPaymentAndReputation()", function () {
    it("Should accumulate the agent earnings correctly after one payment", async function () {
      await processPayment();
      expect(await router.agentBalances(agentId)).to.equal(AGENT_PRICE);
    });

    it("Should hold the total payment amount in the router balance after one payment", async function () {
      await processPayment();
      expect(await usdc.balanceOf(routerAddress)).to.equal(TOTAL_PAYMENT);
    });

    it("Should deduct the full payment amount from the client balance", async function () {
      const clientBefore = await usdc.balanceOf(client.address);
      await processPayment();
      expect(await usdc.balanceOf(client.address)).to.equal(clientBefore - TOTAL_PAYMENT);
    });

    it("Should emit PaymentRouted event with correct args", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await expect(
        router
          .connect(owner)
          .processAgentPaymentAndReputation(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig),
      )
        .to.emit(router, "PaymentRouted")
        .withArgs(client.address, agentId, TOTAL_PAYMENT);
    });

    it("Should accumulate correctly after two payments to the same agent", async function () {
      await processPayment();
      await processPayment();

      expect(await router.agentBalances(agentId)).to.equal(AGENT_PRICE * 2n);
      expect(await usdc.balanceOf(routerAddress)).to.equal(TOTAL_PAYMENT * 2n);
    });

    it("Should mark the nonce as processed after a successful payment", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      await processPayment(TOTAL_PAYMENT, nonce);
      expect(await router.proccessesNonces(nonce)).to.equal(true);
    });

    it("Should conserve funds: client debit equals agent balance plus router fee (invariant)", async function () {
      const clientBefore = await usdc.balanceOf(client.address);
      await processPayment();
      const clientAfter = await usdc.balanceOf(client.address);

      const agentAccumulated = await router.agentBalances(agentId);
      const routerBalance = await usdc.balanceOf(routerAddress);

      // The implicit fee is whatever the router holds beyond the agent's share
      const implicitFee = routerBalance - agentAccumulated;

      expect(clientBefore - clientAfter).to.equal(TOTAL_PAYMENT);
      expect(agentAccumulated + implicitFee).to.equal(TOTAL_PAYMENT);
    });

    it("Should accumulate balances independently for two different agents", async function () {
      const [, , , , secondAgentOwner] = await ethers.getSigners();

      // Register a second agent to verify balances are tracked per agentId
      const tx = await agentMarketplace.connect(secondAgentOwner).register(AGENT_PRICE, AGENT_URI, false);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log: any) => {
          try {
            return agentMarketplace.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === "AgentRegistered");
      const agentId2 = event?.args.agentId;

      // Pay agent 1
      await processPayment();

      // Pay agent 2 with a fresh nonce and authorization
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);
      await router
        .connect(owner)
        .processAgentPaymentAndReputation(client.address, agentId2, TOTAL_PAYMENT, validUntil, nonce, sig);

      expect(await router.agentBalances(agentId)).to.equal(AGENT_PRICE);
      expect(await router.agentBalances(agentId2)).to.equal(AGENT_PRICE);
      expect(await usdc.balanceOf(routerAddress)).to.equal(TOTAL_PAYMENT * 2n);
    });

    it("Should process payment with 1 wei price (truncation check)", async function () {
      // Tests Solidity division truncation with extreme low values (1 wei)
      // to ensure the contract doesn't revert when handling minimal values.
      const lowPrice = 1n;
      const lowAgentUri = "ipfs://LowPriceAgent";

      const tx = await agentMarketplace.connect(agentOwner).register(lowPrice, lowAgentUri, false);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log: any) => {
          try {
            return agentMarketplace.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === "AgentRegistered");
      const lowAgentId = event?.args.agentId;

      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;

      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, lowPrice, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await expect(
        router
          .connect(owner)
          .processAgentPaymentAndReputation(client.address, lowAgentId, lowPrice, validUntil, nonce, sig),
      ).to.not.be.reverted;
    });
  });

  // ─── withdrawAgentEarnings ───────────────────────────────────────────────────

  describe("withdrawAgentEarnings()", function () {
    it("Should transfer accumulated earnings to the agent owner (payToAgentWallet=false)", async function () {
      await processPayment();

      const agentOwnerBefore = await usdc.balanceOf(agentOwner.address);
      await router.withdrawAgentEarnings(agentId);

      expect(await usdc.balanceOf(agentOwner.address)).to.equal(agentOwnerBefore + AGENT_PRICE);
      expect(await router.agentBalances(agentId)).to.equal(0n);
    });

    it("Should reset agent balance to zero after withdrawal", async function () {
      await processPayment();
      await router.withdrawAgentEarnings(agentId);
      expect(await router.agentBalances(agentId)).to.equal(0n);
    });

    it("Should transfer to agentWallet when payToAgentWallet=true", async function () {
      const [, , , , dedicatedWallet] = await ethers.getSigners();

      // Register a second agent configured to receive payments at a dedicated wallet address
      const tx = await agentMarketplace.connect(agentOwner).register(AGENT_PRICE, AGENT_URI, true);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log: any) => {
          try {
            return agentMarketplace.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === "AgentRegistered");
      const agentId2 = event?.args.agentId;

      // Configure the mock registry to return dedicatedWallet for this agentId
      await mockRegistry.setAgentWallet(agentId2, dedicatedWallet.address);

      // Process payment for this agent
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);
      await router
        .connect(owner)
        .processAgentPaymentAndReputation(client.address, agentId2, TOTAL_PAYMENT, validUntil, nonce, sig);

      const walletBefore = await usdc.balanceOf(dedicatedWallet.address);
      await router.withdrawAgentEarnings(agentId2);

      expect(await usdc.balanceOf(dedicatedWallet.address)).to.equal(walletBefore + AGENT_PRICE);
    });
  });

  // ─── withdrawFees ────────────────────────────────────────────────────────────

  describe("withdrawFees()", function () {
    it("Should transfer only the platform fee to treasury after agent withdraws earnings", async function () {
      await processPayment();

      // Agent withdraws their share first so the router only holds the platform fee
      await router.withdrawAgentEarnings(agentId);

      const treasuryBefore = await usdc.balanceOf(treasury.address);
      await router.connect(owner).withdrawFees();

      expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + PLATFORM_FEE);
      expect(await usdc.balanceOf(routerAddress)).to.equal(0n);
    });

    it("Should emit FeesWithdrawn event with correct amount", async function () {
      await processPayment();
      await router.withdrawAgentEarnings(agentId);

      const tx = await router.connect(owner).withdrawFees();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx).to.emit(router, "FeesWithdrawn").withArgs(PLATFORM_FEE, block!.timestamp);
    });

    it("Should accumulate correct total fees after payments to two different agents", async function () {
      const [, , , , secondAgentOwner] = await ethers.getSigners();

      // Register a second agent so we can verify fee accumulation across multiple payments
      const tx = await agentMarketplace.connect(secondAgentOwner).register(AGENT_PRICE, AGENT_URI, false);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log: any) => {
          try {
            return agentMarketplace.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === "AgentRegistered");
      const agentId2 = event?.args.agentId;

      // Process one payment per agent
      await processPayment();

      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);
      await router
        .connect(owner)
        .processAgentPaymentAndReputation(client.address, agentId2, TOTAL_PAYMENT, validUntil, nonce, sig);

      // Both agents withdraw first so only platform fees remain in the router
      await router.withdrawAgentEarnings(agentId);
      await router.withdrawAgentEarnings(agentId2);

      const treasuryBefore = await usdc.balanceOf(treasury.address);
      await router.connect(owner).withdrawFees();

      // Two payments → two platform fees accumulated
      expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + PLATFORM_FEE * 2n);
      expect(await usdc.balanceOf(routerAddress)).to.equal(0n);
    });

    // Previously withdrawFees() would drain agent earnings if called before withdrawAgentEarnings()
    // because the contract used balanceOf(address(this)) without separate accounting.
    // Fixed in b78208b by introducing totalAgentLiabilities to track agent funds separately.
    it("Should NOT drain agent earnings when withdrawFees() is called before withdrawAgentEarnings()", async function () {
      await processPayment();

      // Owner withdraws fees first — should only take the platform fee, not agent funds
      await router.connect(owner).withdrawFees();

      // Agent balance mapping must still show the full earnings
      expect(await router.agentBalances(agentId)).to.equal(AGENT_PRICE);

      // Agent must still be able to withdraw their earnings successfully
      const agentOwnerBefore = await usdc.balanceOf(agentOwner.address);
      await router.withdrawAgentEarnings(agentId);
      expect(await usdc.balanceOf(agentOwner.address)).to.equal(agentOwnerBefore + AGENT_PRICE);
    });
  });

  // ─── updateFeeBps ────────────────────────────────────────────────────────────

  describe("updateFeeBps()", function () {
    it("Should update feeBps correctly", async function () {
      await router.connect(owner).updateFeeBps(500n);
      expect(await router.feeBps()).to.equal(500n);
    });

    it("Should emit FeeBpsUpdated event with old and new values", async function () {
      const tx = await router.connect(owner).updateFeeBps(500n);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx).to.emit(router, "FeeBpsUpdated").withArgs(FEE_BPS, 500n, block!.timestamp);
    });
  });

  // ─── transferOwnership / acceptOwnership ─────────────────────────────────────

  describe("transferOwnership() / acceptOwnership()", function () {
    it("Should set pendingOwner after transferOwnership", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      await router.connect(owner).transferOwnership(newOwner.address);
      expect(await router.pendingOwner()).to.equal(newOwner.address);
    });

    it("Should transfer ownership after waiting period", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      await router.connect(owner).transferOwnership(newOwner.address);

      // Fast-forward 7 days to satisfy the ownership transfer waiting period
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await router.connect(newOwner).acceptOwnership();
      expect(await router.owner()).to.equal(newOwner.address);
      expect(await router.pendingOwner()).to.equal(ethers.ZeroAddress);
    });

    it("Should emit OwnerTransferred event on acceptOwnership", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      await router.connect(owner).transferOwnership(newOwner.address);

      // Fast-forward 7 days to satisfy the ownership transfer waiting period
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      const tx = await router.connect(newOwner).acceptOwnership();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx).to.emit(router, "OwnerTransferred").withArgs(owner.address, newOwner.address, block!.timestamp);
    });
  });

  // ─── changeTreasury ──────────────────────────────────────────────────────────

  describe("changeTreasury()", function () {
    it("Should update the treasury address", async function () {
      const [, , , , , newTreasury] = await ethers.getSigners();
      await router.connect(owner).changeTreasury(newTreasury.address);
      expect(await router.treasury()).to.equal(newTreasury.address);
    });
  });

  // ─── Failure Cases ───────────────────────────────────────────────────────────

  describe("processAgentPaymentAndReputation() — reverts", function () {
    it("Should revert with NotOwner if caller is not the owner", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      // client is not the owner — must revert
      await expect(
        router
          .connect(client)
          .processAgentPaymentAndReputation(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig),
      ).to.be.revertedWithCustomError(router, "NotOwner");
    });

    it("Should revert with TransferFailed if nonce was already used (replay attack)", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));

      // First payment consumes the nonce
      await processPayment(TOTAL_PAYMENT, nonce);

      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      // Second payment with the same nonce must fail — USDC rejects replayed authorizations
      await expect(
        router
          .connect(owner)
          .processAgentPaymentAndReputation(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig),
      ).to.be.revertedWithCustomError(router, "TransferFailed");
    });

    it("Should revert with AgentNotFoundInMarketplace if agent does not exist", async function () {
      const nonExistentAgentId = 999n;
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await expect(
        router
          .connect(owner)
          .processAgentPaymentAndReputation(client.address, nonExistentAgentId, TOTAL_PAYMENT, validUntil, nonce, sig),
      ).to.be.revertedWithCustomError(router, "AgentNotFoundInMarketplace");
    });

    it("Should revert with AgentNotActive if agent is deactivated", async function () {
      // Deactivate the registered agent before attempting the payment
      await agentMarketplace.connect(agentOwner).deactivateAgent(agentId);

      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await expect(
        router
          .connect(owner)
          .processAgentPaymentAndReputation(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig),
      ).to.be.revertedWithCustomError(router, "AgentNotActive");
    });

    it("Should revert with InsufficientAmount if amount is less than agent price", async function () {
      // One wei below the agent price — the router should reject this
      const belowPrice = AGENT_PRICE - 1n;
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, belowPrice, validUntil, nonce, 0);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await expect(
        router
          .connect(owner)
          .processAgentPaymentAndReputation(client.address, agentId, belowPrice, validUntil, nonce, sig),
      ).to.be.revertedWithCustomError(router, "InsufficientAmount");
    });

    it("Should revert if validAfter is in the future", async function () {
      // Verifies that authorizations with a validAfter timestamp in the future
      // are strictly rejected by the USDC contract to prevent processing signatures
      // that are not yet active or "frozen".
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const futureValidAfter = (await getBlockTimestamp()) + 3600; // 1 hour in the future

      // Sign with a future validAfter
      const { v, r, s } = await buildTransferAuthorization(
        client,
        routerAddress,
        TOTAL_PAYMENT,
        validUntil,
        nonce,
        futureValidAfter,
      );
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      // Contract hardcodes '0' as validAfter, mismatching the signature digest
      await expect(
        router
          .connect(owner)
          .processAgentPaymentAndReputation(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig),
      ).to.be.reverted;
    });

    it("Should revert with InvalidAuthorization if signature length is not 65 bytes", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;

      // A 64-byte random blob is not a valid ECDSA signature — router must reject it early
      const invalidSig = ethers.hexlify(ethers.randomBytes(64));

      await expect(
        router
          .connect(owner)
          .processAgentPaymentAndReputation(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, invalidSig),
      ).to.be.revertedWithCustomError(router, "InvalidAuthorization");
    });

    it("Should revert if the signature is from a different signer than the client", async function () {
      const [, , , , attacker] = await ethers.getSigners();
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;

      // Attacker signs an authorization claiming to spend from client's address — USDC will reject
      const { v, r, s } = await buildTransferAuthorization(attacker, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await expect(
        router
          .connect(owner)
          .processAgentPaymentAndReputation(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig),
      ).to.be.reverted;
    });

    it("Should revert if the authorization has expired", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));

      // Set validUntil in the past relative to the current block timestamp
      const expiredUntil = (await getBlockTimestamp()) - 3600;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, expiredUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await expect(
        router
          .connect(owner)
          .processAgentPaymentAndReputation(client.address, agentId, TOTAL_PAYMENT, expiredUntil, nonce, sig),
      ).to.be.reverted;
    });
  });

  describe("withdrawFees() — reverts", function () {
    it("Should revert with NotOwner if caller is not the owner", async function () {
      await processPayment();
      await router.withdrawAgentEarnings(agentId);

      // client is not the owner — must revert
      await expect(router.connect(client).withdrawFees()).to.be.revertedWithCustomError(router, "NotOwner");
    });

    it("Should revert with NoFeesToWithdraw if there are no fees accumulated", async function () {
      // No payments have been processed — router has zero balance
      await expect(router.connect(owner).withdrawFees()).to.be.revertedWithCustomError(router, "NoFeesToWithdraw");
    });
  });

  describe("withdrawAgentEarnings() — reverts", function () {
    it("Should revert with AgentNotFoundInMarketplace if agent does not exist", async function () {
      // agentId 999 was never registered in the marketplace
      await expect(router.withdrawAgentEarnings(999n)).to.be.revertedWithCustomError(
        router,
        "AgentNotFoundInMarketplace",
      );
    });

    it("Should revert with NoFeesToWithdraw if agent has no earnings", async function () {
      // Registered agent but no payment was ever processed for it
      await expect(router.withdrawAgentEarnings(agentId)).to.be.revertedWithCustomError(router, "NoFeesToWithdraw");
    });

    it("Should revert on second withdrawal when agent balance is already zero", async function () {
      await processPayment();

      // First withdrawal drains the balance
      await router.withdrawAgentEarnings(agentId);

      // Second withdrawal must fail — nothing left to withdraw
      await expect(router.withdrawAgentEarnings(agentId)).to.be.revertedWithCustomError(router, "NoFeesToWithdraw");
    });
  });

  describe("updateFeeBps() — reverts", function () {
    it("Should revert with NotOwner if caller is not the owner", async function () {
      await expect(router.connect(client).updateFeeBps(500n)).to.be.revertedWithCustomError(router, "NotOwner");
    });

    it("Should revert with FeeTooHigh if fee exceeds 1000 bps (10%)", async function () {
      // 1001 bps = 10.01% — exceeds the maximum allowed fee
      await expect(router.connect(owner).updateFeeBps(1001n)).to.be.revertedWithCustomError(router, "FeeTooHigh");
    });

    it("Should revert with SameFeeBps if new fee equals current fee", async function () {
      // Setting the same fee that is already configured must be rejected
      await expect(router.connect(owner).updateFeeBps(FEE_BPS)).to.be.revertedWithCustomError(router, "SameFeeBps");
    });
  });

  describe("transferOwnership() — reverts", function () {
    it("Should revert with NotOwner if caller is not the owner", async function () {
      const [, , , , newOwner] = await ethers.getSigners();

      // client is not the owner — must revert
      await expect(router.connect(client).transferOwnership(newOwner.address)).to.be.revertedWithCustomError(
        router,
        "NotOwner",
      );
    });

    it("Should revert with SameOwner if new owner is the current owner", async function () {
      // Transferring ownership to the same address must be rejected
      await expect(router.connect(owner).transferOwnership(owner.address)).to.be.revertedWithCustomError(
        router,
        "SameOwner",
      );
    });
  });

  describe("acceptOwnership() — reverts", function () {
    it("Should revert with NotOwner if caller is not the pending owner", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      await router.connect(owner).transferOwnership(newOwner.address);

      // client was not nominated as pending owner — must revert
      await expect(router.connect(client).acceptOwnership()).to.be.revertedWithCustomError(router, "NotOwner");
    });

    it("Should revert with WaitingPeriodNotOver if called before 7 days", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      await router.connect(owner).transferOwnership(newOwner.address);

      // Attempting to accept immediately without advancing time must fail
      await expect(router.connect(newOwner).acceptOwnership()).to.be.revertedWithCustomError(
        router,
        "WaitingPeriodNotOver",
      );
    });

    it("Should revert with NotOwner if called without a prior transferOwnership", async function () {
      // No pending owner was ever set — any call to acceptOwnership must fail
      await expect(router.connect(client).acceptOwnership()).to.be.revertedWithCustomError(router, "NotOwner");
    });
  });

  describe("changeTreasury() — reverts", function () {
    it("Should revert with NotOwner if caller is not the owner", async function () {
      const [, , , , , newTreasury] = await ethers.getSigners();

      // client is not the owner — must revert
      await expect(router.connect(client).changeTreasury(newTreasury.address)).to.be.revertedWithCustomError(
        router,
        "NotOwner",
      );
    });

    it("Should revert with ZeroAddress if new treasury is address(0)", async function () {
      // Setting treasury to the zero address must be rejected to prevent fund loss
      await expect(router.connect(owner).changeTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        router,
        "ZeroAddress",
      );
    });
  });

  describe("Constructor — reverts", function () {
    it("Should revert with FeeTooHigh if feeBps exceeds 1000 at deploy", async function () {
      const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
      await expect(
        RouterFactory.deploy(await agentMarketplace.getAddress(), USDC_ADDRESS, 1001n, treasury.address),
      ).to.be.revertedWithCustomError(router, "FeeTooHigh");
    });

    it("Should deploy successfully with feeBps at the maximum limit (1000)", async function () {
      const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
      const routerAtLimit = await RouterFactory.deploy(
        await agentMarketplace.getAddress(),
        USDC_ADDRESS,
        1000n,
        treasury.address,
      );
      await routerAtLimit.waitForDeployment();
      expect(await routerAtLimit.feeBps()).to.equal(1000n);
    });

    it("Should deploy successfully with feeBps at zero", async function () {
      const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
      const routerZeroFee = await RouterFactory.deploy(
        await agentMarketplace.getAddress(),
        USDC_ADDRESS,
        0n,
        treasury.address,
      );
      await routerZeroFee.waitForDeployment();
      expect(await routerZeroFee.feeBps()).to.equal(0n);
    });

    it("Should revert with ZeroAddress if treasury is address(0)", async function () {
      const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
      await expect(
        RouterFactory.deploy(await agentMarketplace.getAddress(), USDC_ADDRESS, FEE_BPS, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(router, "ZeroAddress");
    });
  });
});
