import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WHALE_ADDRESS = "0x8da91A6298eA5d1A8Bc985e99798fd0A0f05701a";

describe("MarketplaceRouter", function () {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let router: Contract;
  let usdc: Contract;
  let faucet: Contract;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let owner: SignerWithAddress; // Platform treasury
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let agent: SignerWithAddress; // AI Agent owner
  let client: SignerWithAddress; // Payer

  beforeEach(async function () {
    [owner, agent, client] = await ethers.getSigners();

    // 1. Get USDC contract instance
    usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);

    // 2. Fund the whale with ETH so it can pay for gas
    await ethers.provider.send("hardhat_setBalance", [WHALE_ADDRESS, "0x8AC7230489E80000"]);

    // 3. Impersonate the whale
    await ethers.provider.send("hardhat_impersonateAccount", [WHALE_ADDRESS]);
    const whaleSigner = await ethers.getSigner(WHALE_ADDRESS);

    // 4. Deploy the Faucet using the whale as signer
    const FaucetFactory = await ethers.getContractFactory("USDCFaucet", whaleSigner);
    faucet = await FaucetFactory.deploy(USDC_ADDRESS);
    await faucet.waitForDeployment();

    // 5. Fund the Faucet with 1,000,000 USDC from the whale
    const usdcAsWhale = usdc.connect(whaleSigner);
    await usdcAsWhale.transfer(await faucet.getAddress(), ethers.parseUnits("1000000", 6));

    // 6. Stop impersonating
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [WHALE_ADDRESS]);

    // 7. Client requests 1,000 USDC from the faucet
    const faucetAsClient = faucet.connect(client);
    await faucetAsClient.requestTokens();

    // TODO: Deploy MockERC8004Registry (issue #22) and MarketplaceRouter (issue #9) here
  });

  describe("Initial Setup", function () {
    it("Should fund the client with 1,000 USDC via the Faucet", async function () {
      // Read the USDC balance of the client account from the real USDC contract
      // This verifies the full setup chain worked correctly:
      // Whale was impersonated -> Faucet was deployed -> Faucet was funded -> client called requestTokens()
      // USDC uses 6 decimals, so 1,000 USDC = 1,000 * 10^6 = 1_000_000_000
      const balance = await usdc.balanceOf(client.address);
      expect(balance).to.equal(ethers.parseUnits("1000", 6));
    });
  });

  describe("Success cases", function () {
    it("Should route payment to agent's ERC-8004 wallet, retain platform fee, and emit event for x402", async function () {
      // 1. Client approves Router for 100 USDC
      // 2. Client calls router.payAgent(agentId, amount)
      // 3. Router fetches agent wallet from ERC-8004 Registry
      // 4. Verify Agent wallet received 90 USDC
      // 5. Verify Platform received 10 USDC
      // 6. Verify PaymentRouted event is emitted (critical for x402 middleware)
      expect(true).to.equal(true);
    });

    it("Should maintain the total supply of USDC intact (Invariant)", async function () {
      // Total sum before payment == total sum after payment
      expect(true).to.equal(true);
    });
  });

  describe("Failure cases", function () {
    it("Should fail if the client has insufficient balance", async function () {
      // Try to pay 1000 USDC when client only has 100
      expect(true).to.equal(true);
    });

    it("Should fail if the client did not provide allowance to the router", async function () {
      // Client has funds but no approve() was called
      expect(true).to.equal(true);
    });

    it("Should fail if the payment amount is 0", async function () {
      expect(true).to.equal(true);
    });

    it("Should fail if the agent does not exist (0x0 wallet)", async function () {
      expect(true).to.equal(true);
    });
  });
});
