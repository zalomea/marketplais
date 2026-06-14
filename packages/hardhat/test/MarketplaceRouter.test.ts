import { expect } from "chai";
import { ethers } from "hardhat";
import { Signature } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  AgentMarketplace,
  IUSDC,
  MarketplaceRouter,
  MockIdentityRegistry,
  MockReputationRegistry,
} from "../typechain-types";

// ─── Network constants (Base mainnet fork) ────────────────────────────────────
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WHALE_ADDRESS = "0x8da91A6298eA5d1A8Bc985e99798fd0A0f05701a";

// ─── Contract parameters ──────────────────────────────────────────────────────

// 10% platform fee expressed in basis points (1 bps = 0.01%)
const FEE_BPS = 1000n;

// Agent price set at registration: 100 USDC (6 decimals)
const AGENT_PRICE = ethers.parseUnits("100", 6);
const PLATFORM_FEE = (AGENT_PRICE * FEE_BPS) / 10000n;
const TOTAL_PAYMENT = AGENT_PRICE + PLATFORM_FEE;

const AGENT_URI = "ipfs://QmTestAgentURI";

// ─── EIP-3009 helpers ─────────────────────────────────────────────────────────

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
  let router: MarketplaceRouter;
  let agentMarketplace: AgentMarketplace;
  let mockRegistry: MockIdentityRegistry;
  let mockReputation: MockReputationRegistry;
  let usdc: IUSDC;

  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let agentOwner: SignerWithAddress;
  let client: SignerWithAddress;

  let agentId: bigint;
  let routerAddress: string;

  let snapshotId: string;

  before(async function () {
    [owner, treasury, agentOwner, client] = await ethers.getSigners();
    usdc = await ethers.getContractAt("IUSDC", USDC_ADDRESS);
    await ethers.provider.send("hardhat_setBalance", [WHALE_ADDRESS, "0x8AC7230489E80000"]);
    await ethers.provider.send("hardhat_impersonateAccount", [WHALE_ADDRESS]);
    const whaleSigner = await ethers.getSigner(WHALE_ADDRESS);
    await usdc.connect(whaleSigner).transfer(client.address, ethers.parseUnits("1000", 6), { gasLimit: 1000000 });
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [WHALE_ADDRESS]);

    const MockRegistryFactory = await ethers.getContractFactory("MockIdentityRegistry");
    mockRegistry = await MockRegistryFactory.deploy({ gasLimit: 5000000 });
    await mockRegistry.waitForDeployment();

    const MockReputationFactory = await ethers.getContractFactory("MockReputationRegistry");
    mockReputation = await MockReputationFactory.deploy({ gasLimit: 5000000 });
    await mockReputation.waitForDeployment();

    const AgentMarketplaceFactory = await ethers.getContractFactory("AgentMarketplace");
    agentMarketplace = await AgentMarketplaceFactory.deploy(await mockRegistry.getAddress(), { gasLimit: 10000000 });
    await agentMarketplace.waitForDeployment();

    const tx = await agentMarketplace
      .connect(agentOwner)
      ["register(uint256,string,bool)"](AGENT_PRICE, AGENT_URI, false, { gasLimit: 10000000 });
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

    const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
    router = await RouterFactory.deploy(
      await agentMarketplace.getAddress(),
      await mockReputation.getAddress(),
      USDC_ADDRESS,
      FEE_BPS,
      treasury.address,
      { gasLimit: 10000000 },
    );
    await router.waitForDeployment();
    routerAddress = await router.getAddress();
  });

  beforeEach(async function () {
    snapshotId = await ethers.provider.send("evm_snapshot", []);
  });

  afterEach(async function () {
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  async function getBlockTimestamp(): Promise<number> {
    const block = await ethers.provider.getBlock("latest");
    return block!.timestamp;
  }

  // Helper: Executes a full locked payment flow and finalizes it
  async function lockAndProcessPayment(amount: bigint = TOTAL_PAYMENT, customNonce?: string): Promise<string> {
    const nonce = customNonce ?? ethers.hexlify(ethers.randomBytes(32));
    const validUntil = (await getBlockTimestamp()) + 86400;
    const { v, r, s } = await buildTransferAuthorization(client, routerAddress, amount, validUntil, nonce);
    const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

    await router.connect(owner).lockPayment(client.address, agentId, amount, validUntil, nonce, sig);

    await router.connect(owner).finalizePayment(nonce);

    return nonce;
  }

  // ─── Initial Setup ───────────────────────────────────────────────────────────

  describe("Payment Flow (lockPayment + finalizePayment)", function () {
    it("Should accumulate agent earnings after finalization", async function () {
      await lockAndProcessPayment();
      expect(await router.agentBalances(agentId)).to.equal(AGENT_PRICE);
    });

    it("Should emit PaymentLocked and PaymentFinalized events", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      const txLock = await router
        .connect(owner)
        .lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig);
      await expect(txLock)
        .to.emit(router, "PaymentLocked")
        .withArgs(nonce, client.address, agentId, TOTAL_PAYMENT, AGENT_PRICE);

      const txFinal = await router.connect(owner).finalizePayment(nonce);
      await expect(txFinal).to.emit(router, "PaymentFinalized").withArgs(nonce, agentId, AGENT_PRICE);
    });

    it("Should allow refunding payment if agent fails", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await router.connect(owner).lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig);

      const clientBefore = await usdc.balanceOf(client.address);
      const txRefund = await router.connect(owner).refundPayment(nonce);

      await expect(txRefund).to.emit(router, "PaymentRefunded").withArgs(nonce, client.address, TOTAL_PAYMENT);
      expect(await usdc.balanceOf(client.address)).to.equal(clientBefore + TOTAL_PAYMENT);

      await expect(router.connect(owner).finalizePayment(nonce)).to.be.revertedWithCustomError(
        router,
        "PaymentNotLocked",
      );
    });
  });

  describe("withdrawAgentEarnings()", function () {
    it("Should transfer accumulated earnings to the agent owner", async function () {
      await lockAndProcessPayment();
      const agentOwnerBefore = await usdc.balanceOf(agentOwner.address);
      await router.withdrawAgentEarnings(agentId);
      expect(await usdc.balanceOf(agentOwner.address)).to.equal(agentOwnerBefore + AGENT_PRICE);
      expect(await router.agentBalances(agentId)).to.equal(0n);
    });
  });

  describe("withdrawFees()", function () {
    it("Should transfer only the platform fee to treasury", async function () {
      await lockAndProcessPayment();
      await router.withdrawAgentEarnings(agentId);
      const treasuryBefore = await usdc.balanceOf(treasury.address);
      await router.connect(owner).withdrawFees();
      expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + PLATFORM_FEE);
    });
  });

  describe("Ownership and Config", function () {
    it("Should update feeBps correctly", async function () {
      await router.connect(owner).updateFeeBps(500n);
      expect(await router.feeBps()).to.equal(500n);
    });

    it("Should transfer ownership after waiting period", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      await router.connect(owner).transferOwnership(newOwner.address);
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await router.connect(newOwner).acceptOwnership();
      expect(await router.owner()).to.equal(newOwner.address);
    });
  });
});
