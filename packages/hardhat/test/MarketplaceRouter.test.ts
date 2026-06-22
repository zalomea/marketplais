import { expect } from "chai";
import { ethers } from "hardhat";
import { Signature } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AgentMarketplace, IUSDC, MarketplaceRouter, IIdentityRegistry, IReputationRegistry } from "../typechain-types";

// ─── Network constants (Base mainnet fork) ────────────────────────────────────
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WHALE_ADDRESS = "0x8da91A6298eA5d1A8Bc985e99798fd0A0f05701a";

const IDENTITY_REGISTRY_ADDRESS = process.env.IDENTITY_REGISTRY_ADDRESS ?? "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY_ADDRESS =
  process.env.REPUTATION_REGISTRY_ADDRESS ?? "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";

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
  let iIdentityRegistry: IIdentityRegistry;
  let iReputationRegistry: IReputationRegistry;
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

    iIdentityRegistry = await ethers.getContractAt("IIdentityRegistry", IDENTITY_REGISTRY_ADDRESS);
    iReputationRegistry = await ethers.getContractAt("IReputationRegistry", REPUTATION_REGISTRY_ADDRESS);

    const AgentMarketplaceFactory = await ethers.getContractFactory("AgentMarketplace");
    agentMarketplace = await AgentMarketplaceFactory.deploy(await iIdentityRegistry.getAddress(), {
      gasLimit: 10000000,
    });
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
      await iReputationRegistry.getAddress(),
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

  // Helper: Builds EIP-712 signature for IdentityRegistry.setAgentWallet.
  // The signature must come from the *newWallet* itself (verified by the registry).
  async function buildSetAgentWalletSignature(
    signer: SignerWithAddress,
    agentOwnerAddress: string,
    agentId: bigint,
    newWallet: string,
    deadline: number,
  ): Promise<string> {
    const domainData = await iIdentityRegistry.eip712Domain();
    const domain = {
      name: domainData.name,
      version: domainData.version,
      chainId: domainData.chainId,
      verifyingContract: domainData.verifyingContract,
      ...(domainData.salt !== ethers.ZeroHash ? { salt: domainData.salt } : {}),
    };

    const types = {
      AgentWalletSet: [
        { name: "agentId", type: "uint256" },
        { name: "newWallet", type: "address" },
        { name: "owner", type: "address" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const message = {
      agentId,
      newWallet,
      owner: agentOwnerAddress,
      deadline,
    };

    return signer.signTypedData(domain, types, message);
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

    // Regression test for escrow leak
    it("Should not sweep locked funds in escrow and should allow refund after withdrawFees call", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await router.connect(owner).lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig);

      await expect(router.connect(owner).withdrawFees()).to.be.revertedWithCustomError(router, "NoFeesToWithdraw");

      const clientBefore = await usdc.balanceOf(client.address);
      await router.connect(owner).refundPayment(nonce);
      expect(await usdc.balanceOf(client.address)).to.equal(clientBefore + TOTAL_PAYMENT);
    });

    // Mixed state: withdrawable fee surplus must coexist with a still-locked payment without touching escrow
    it("Should withdraw only fee surplus while another payment is still locked in escrow", async function () {
      // Payment A: lock and finalize so its fee becomes withdrawable surplus (totalLocked back to 0)
      const nonceA = ethers.hexlify(ethers.randomBytes(32));
      const validUntilA = (await getBlockTimestamp()) + 86400;
      const sigA = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntilA, nonceA);
      const rawSigA = ethers.concat([sigA.r, sigA.s, ethers.toBeHex(sigA.v, 1)]);
      await router.connect(owner).lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntilA, nonceA, rawSigA);
      await router.connect(owner).finalizePayment(nonceA);

      // Payment B: lock but do NOT finalize, so it stays escrowed
      const nonceB = ethers.hexlify(ethers.randomBytes(32));
      const validUntilB = (await getBlockTimestamp()) + 86400;
      const sigB = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntilB, nonceB);
      const rawSigB = ethers.concat([sigB.r, sigB.s, ethers.toBeHex(sigB.v, 1)]);
      await router.connect(owner).lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntilB, nonceB, rawSigB);

      expect(await router.totalLocked()).to.equal(TOTAL_PAYMENT);

      // withdrawFees must release only the fee surplus (TOTAL_PAYMENT - AGENT_PRICE), not B's escrow nor A's earnings
      const expectedFee = TOTAL_PAYMENT - AGENT_PRICE;
      const treasuryBefore = await usdc.balanceOf(treasury.address);
      await router.connect(owner).withdrawFees();
      expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + expectedFee);

      // B's escrow is intact: refund returns the full amount and clears totalLocked
      const clientBefore = await usdc.balanceOf(client.address);
      await router.connect(owner).refundPayment(nonceB);
      expect(await usdc.balanceOf(client.address)).to.equal(clientBefore + TOTAL_PAYMENT);
      expect(await router.totalLocked()).to.equal(0n);
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

  // ─── Payment Flow reverts and boundaries ────────────────────────────────────
  describe("Payment Flow (lockPayment + finalizePayment) — reverts and boundaries", function () {
    // Reverts with NotOwner when lockPayment is called by a non-relayer
    it("Should revert lockPayment with NotOwner when called by a non-relayer", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);
      await expect(
        router.connect(client).lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig),
      ).to.be.revertedWithCustomError(router, "NotOwner");
    });

    // Reverts with NotOwner when finalizePayment is called by a non-relayer
    it("Should revert finalizePayment with NotOwner when called by a non-relayer", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      await expect(router.connect(client).finalizePayment(nonce)).to.be.revertedWithCustomError(router, "NotOwner");
    });

    // Reverts with NotOwner when refundPayment is called by a non-relayer
    it("Should revert refundPayment with NotOwner when called by a non-relayer", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      await expect(router.connect(client).refundPayment(nonce)).to.be.revertedWithCustomError(router, "NotOwner");
    });

    // Reverts with PaymentAlreadyProcessed when the same nonce is locked twice
    it("Should revert lockPayment with PaymentAlreadyProcessed when the same nonce is locked twice", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await router.connect(owner).lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig);

      await expect(
        router.connect(owner).lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig),
      ).to.be.revertedWithCustomError(router, "PaymentAlreadyProcessed");
    });

    // Reverts with InsufficientAmount when amount < price + fee
    it("Should revert lockPayment with InsufficientAmount when amount < price + fee", async function () {
      const belowAmount = TOTAL_PAYMENT - 1n;
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, belowAmount, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await expect(
        router.connect(owner).lockPayment(client.address, agentId, belowAmount, validUntil, nonce, sig),
      ).to.be.revertedWithCustomError(router, "InsufficientAmount");
    });

    // Reverts with InvalidAuthorization when the signature is not 65 bytes
    it("Should revert lockPayment with InvalidAuthorization when the signature is not 65 bytes", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const invalidSig = ethers.hexlify(ethers.randomBytes(64));

      await expect(
        router.connect(owner).lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, invalidSig),
      ).to.be.revertedWithCustomError(router, "InvalidAuthorization");
    });

    // Reverts with PaymentNotLocked for an unknown nonce
    it("Should revert finalizePayment with PaymentNotLocked for an unknown nonce", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      await expect(router.connect(owner).finalizePayment(nonce)).to.be.revertedWithCustomError(
        router,
        "PaymentNotLocked",
      );
    });

    // Reverts with PaymentNotLocked for an unknown nonce
    it("Should revert refundPayment with PaymentNotLocked for an unknown nonce", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      await expect(router.connect(owner).refundPayment(nonce)).to.be.revertedWithCustomError(
        router,
        "PaymentNotLocked",
      );
    });

    // Reverts with PaymentNotLocked if called twice (already finalized)
    it("Should revert finalizePayment with PaymentNotLocked if called twice", async function () {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

      await router.connect(owner).lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig);
      await router.connect(owner).finalizePayment(nonce);

      await expect(router.connect(owner).finalizePayment(nonce)).to.be.revertedWithCustomError(
        router,
        "PaymentNotLocked",
      );
    });
  });

  // ─── withdrawFees reverts ───────────────────────────────────────────────────
  describe("withdrawFees() — reverts", function () {
    // Reverts with NotOwner for a non-owner
    it("Should revert withdrawFees with NotOwner for a non-owner", async function () {
      await expect(router.connect(client).withdrawFees()).to.be.revertedWithCustomError(router, "NotOwner");
    });
  });

  // ─── Ownership, Config, and Constructor reverts and events ──────────────────
  describe("Ownership, Config, and Constructor — reverts and events", function () {
    // Reverts with NotOwner for a non-owner on updateFeeBps
    it("Should revert updateFeeBps with NotOwner for a non-owner", async function () {
      await expect(router.connect(client).updateFeeBps(500n)).to.be.revertedWithCustomError(router, "NotOwner");
    });

    // Reverts with FeeTooHigh if fee exceeds 1000 bps
    it("Should revert updateFeeBps with FeeTooHigh if fee exceeds 1000 bps", async function () {
      await expect(router.connect(owner).updateFeeBps(1001n)).to.be.revertedWithCustomError(router, "FeeTooHigh");
    });

    // Reverts with SameFeeBps if new fee equals current fee
    it("Should revert updateFeeBps with SameFeeBps if new fee equals current fee", async function () {
      await expect(router.connect(owner).updateFeeBps(FEE_BPS)).to.be.revertedWithCustomError(router, "SameFeeBps");
    });

    // Emits FeeBpsUpdated when feeBps is successfully updated
    it("Should emit FeeBpsUpdated when feeBps is successfully updated", async function () {
      const tx = await router.connect(owner).updateFeeBps(500n);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      await expect(tx).to.emit(router, "FeeBpsUpdated").withArgs(FEE_BPS, 500n, block!.timestamp);
    });

    // Reverts with NotOwner for a non-owner on transferOwnership
    it("Should revert transferOwnership with NotOwner for a non-owner", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      await expect(router.connect(client).transferOwnership(newOwner.address)).to.be.revertedWithCustomError(
        router,
        "NotOwner",
      );
    });

    // Reverts with SameOwner if new owner is current owner
    it("Should revert transferOwnership with SameOwner if new owner is current owner", async function () {
      await expect(router.connect(owner).transferOwnership(owner.address)).to.be.revertedWithCustomError(
        router,
        "SameOwner",
      );
    });

    // Sets pendingOwner after a valid transferOwnership call
    it("Should set pendingOwner after a valid transferOwnership call", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      await router.connect(owner).transferOwnership(newOwner.address);
      expect(await router.pendingOwner()).to.equal(newOwner.address);
    });

    // Reverts with NotOwner if caller is not the pending owner on acceptOwnership
    it("Should revert acceptOwnership with NotOwner if caller is not the pending owner", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      await router.connect(owner).transferOwnership(newOwner.address);
      await expect(router.connect(client).acceptOwnership()).to.be.revertedWithCustomError(router, "NotOwner");
    });

    // Reverts with WaitingPeriodNotOver if acceptOwnership is called before 7 days
    it("Should revert acceptOwnership with WaitingPeriodNotOver if called before 7 days", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      await router.connect(owner).transferOwnership(newOwner.address);
      await expect(router.connect(newOwner).acceptOwnership()).to.be.revertedWithCustomError(
        router,
        "WaitingPeriodNotOver",
      );
    });

    // Emits OwnerTransferred when acceptOwnership is successful
    it("Should emit OwnerTransferred when acceptOwnership is successful", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      await router.connect(owner).transferOwnership(newOwner.address);
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      const tx = await router.connect(newOwner).acceptOwnership();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      await expect(tx).to.emit(router, "OwnerTransferred").withArgs(owner.address, newOwner.address, block!.timestamp);
    });

    // Reverts with NotOwner for a non-owner on changeTreasury
    it("Should revert changeTreasury with NotOwner for a non-owner", async function () {
      const [, , , , , newTreasury] = await ethers.getSigners();
      await expect(router.connect(client).changeTreasury(newTreasury.address)).to.be.revertedWithCustomError(
        router,
        "NotOwner",
      );
    });

    // Reverts with ZeroAddress if new treasury is address(0)
    it("Should revert changeTreasury with ZeroAddress if new treasury is address(0)", async function () {
      await expect(router.connect(owner).changeTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        router,
        "ZeroAddress",
      );
    });

    // Updates the treasury successfully and verifies it in state
    it("Should update the treasury successfully and verify it in state", async function () {
      const [, , , , , newTreasury] = await ethers.getSigners();
      await router.connect(owner).changeTreasury(newTreasury.address);
      expect(await router.treasury()).to.equal(newTreasury.address);
    });

    // Reverts constructor with ZeroAddress if treasury is address(0)
    it("Should revert constructor with ZeroAddress if treasury is address(0)", async function () {
      const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
      await expect(
        RouterFactory.deploy(
          await agentMarketplace.getAddress(),
          await iReputationRegistry.getAddress(),
          USDC_ADDRESS,
          FEE_BPS,
          ethers.ZeroAddress,
        ),
      ).to.be.revertedWithCustomError(router, "ZeroAddress");
    });

    // Reverts constructor with ZeroAddress if marketplace is address(0)
    it("Should revert constructor with ZeroAddress if marketplace is address(0)", async function () {
      const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
      await expect(
        RouterFactory.deploy(
          ethers.ZeroAddress,
          await iReputationRegistry.getAddress(),
          USDC_ADDRESS,
          FEE_BPS,
          treasury.address,
        ),
      ).to.be.revertedWithCustomError(router, "ZeroAddress");
    });

    // Reverts constructor with ZeroAddress if token is address(0)
    it("Should revert constructor with ZeroAddress if token is address(0)", async function () {
      const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
      await expect(
        RouterFactory.deploy(
          await agentMarketplace.getAddress(),
          await iReputationRegistry.getAddress(),
          ethers.ZeroAddress,
          FEE_BPS,
          treasury.address,
        ),
      ).to.be.revertedWithCustomError(router, "ZeroAddress");
    });

    // Reverts constructor with FeeTooHigh if feeBps exceeds 1000
    it("Should revert constructor with FeeTooHigh if feeBps exceeds 1000", async function () {
      const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
      await expect(
        RouterFactory.deploy(
          await agentMarketplace.getAddress(),
          await iReputationRegistry.getAddress(),
          USDC_ADDRESS,
          1001n,
          treasury.address,
        ),
      ).to.be.revertedWithCustomError(router, "FeeTooHigh");
    });
  });

  // ─── Escrow trap fix: settlement must survive a reverting reputation registry ─
  describe("finalizePayment / refundPayment with reverting reputation registry", function () {
    let mockReputation: any;
    let mockRouter: MarketplaceRouter;

    before(async function () {
      const MockReputationFactory = await ethers.getContractFactory("ReputationRegistryMock");
      mockReputation = await MockReputationFactory.deploy();
      await mockReputation.waitForDeployment();

      const RouterFactory = await ethers.getContractFactory("MarketplaceRouter");
      mockRouter = await RouterFactory.deploy(
        await agentMarketplace.getAddress(),
        await mockReputation.getAddress(),
        USDC_ADDRESS,
        FEE_BPS,
        treasury.address,
        { gasLimit: 10000000 },
      );
      await mockRouter.waitForDeployment();
    });

    async function lockWithMockRouter(customNonce?: string): Promise<string> {
      const nonce = customNonce ?? ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(
        client,
        await mockRouter.getAddress(),
        TOTAL_PAYMENT,
        validUntil,
        nonce,
      );
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);
      await mockRouter.connect(owner).lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig);
      return nonce;
    }

    it("Should finalize payment and credit agent even if giveFeedback reverts", async function () {
      const nonce = await lockWithMockRouter();
      await mockReputation.setShouldRevert(true);

      await expect(mockRouter.connect(owner).finalizePayment(nonce))
        .to.emit(mockRouter, "PaymentFinalized")
        .withArgs(nonce, agentId, AGENT_PRICE)
        .and.to.emit(mockRouter, "ReputationFeedbackFailed")
        .withArgs(nonce, agentId, "giveFeedback reverted");

      expect(await mockRouter.agentBalances(agentId)).to.equal(AGENT_PRICE);
      expect(await mockRouter.totalLocked()).to.equal(0n);
    });

    it("Should refund payment to client even if giveFeedback reverts", async function () {
      const nonce = await lockWithMockRouter();
      const clientBefore = await usdc.balanceOf(client.address);
      await mockReputation.setShouldRevert(true);

      await expect(mockRouter.connect(owner).refundPayment(nonce))
        .to.emit(mockRouter, "PaymentRefunded")
        .withArgs(nonce, client.address, TOTAL_PAYMENT)
        .and.to.emit(mockRouter, "ReputationFeedbackFailed")
        .withArgs(nonce, agentId, "giveFeedback reverted");

      expect(await usdc.balanceOf(client.address)).to.equal(clientBefore + TOTAL_PAYMENT);
      expect(await mockRouter.totalLocked()).to.equal(0n);
  // ─── payToAgentWallet withdrawal paths ────────────────────────────────────────
  describe("withdrawAgentEarnings — payToAgentWallet paths", function () {
    let walletAgentId: bigint;

    beforeEach(async function () {
      const tx = await agentMarketplace
        .connect(agentOwner)
        ["register(uint256,string,bool)"](AGENT_PRICE, "ipfs://wallet-agent", true);
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
      walletAgentId = event?.args.agentId;
    });

    async function lockAndFinalizeForWalletAgent(customNonce?: string): Promise<string> {
      const nonce = customNonce ?? ethers.hexlify(ethers.randomBytes(32));
      const validUntil = (await getBlockTimestamp()) + 86400;
      const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
      const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);
      await router.connect(owner).lockPayment(client.address, walletAgentId, TOTAL_PAYMENT, validUntil, nonce, sig);
      await router.connect(owner).finalizePayment(nonce);
      return nonce;
    }

    it("Should revert withdrawal when payToAgentWallet=true but wallet is unset", async function () {
      await lockAndFinalizeForWalletAgent();
      await expect(router.withdrawAgentEarnings(walletAgentId)).to.be.reverted;
    });

    it("Should allow recovery by toggling payToAgentWallet back to false", async function () {
      await lockAndFinalizeForWalletAgent();
      await expect(router.withdrawAgentEarnings(walletAgentId)).to.be.reverted;

      await agentMarketplace.connect(agentOwner).setPaymentDestination(walletAgentId, false);

      const ownerBefore = await usdc.balanceOf(agentOwner.address);
      await router.withdrawAgentEarnings(walletAgentId);
      expect(await usdc.balanceOf(agentOwner.address)).to.equal(ownerBefore + AGENT_PRICE);
      expect(await router.agentBalances(walletAgentId)).to.equal(0n);
    });

    it("Should withdraw to agent wallet when payToAgentWallet=true and wallet is set", async function () {
      const [, , , , agentWallet] = await ethers.getSigners();
      await lockAndFinalizeForWalletAgent();

      // Registry enforces MAX_DEADLINE_DELAY = 5 minutes.
      const deadline = (await getBlockTimestamp()) + 120;
      const signature = await buildSetAgentWalletSignature(
        agentWallet,
        agentOwner.address,
        walletAgentId,
        agentWallet.address,
        deadline,
      );
      await iIdentityRegistry
        .connect(agentOwner)
        .setAgentWallet(walletAgentId, agentWallet.address, deadline, signature);

      const walletBefore = await usdc.balanceOf(agentWallet.address);
      await router.withdrawAgentEarnings(walletAgentId);
      expect(await usdc.balanceOf(agentWallet.address)).to.equal(walletBefore + AGENT_PRICE);
      expect(await router.agentBalances(walletAgentId)).to.equal(0n);
    });
  });
});
