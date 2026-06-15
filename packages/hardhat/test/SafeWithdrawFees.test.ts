import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signature } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// ─── Network constants (Base mainnet fork) ────────────────────────────────────
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WHALE_ADDRESS = "0x8da91A6298eA5d1A8Bc985e99798fd0A0f05701a";
// Canonical Safe v1.3.0 contracts already on the Base fork (Create2) — no extra dependency
const SAFE_SINGLETON_ADDRESS = "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552";
const SAFE_PROXY_FACTORY_ADDRESS = "0xa6b71e26c5e0845f74c812102ca7114b6a896ab2";

// ─── Contract parameters ──────────────────────────────────────────────────────
// 10% platform fee expressed in basis points (1 bps = 0.01%)
const FEE_BPS = 1000n;
// Agent price set at registration: 100 USDC (6 decimals)
const AGENT_PRICE = ethers.parseUnits("100", 6);
// Fee added ON TOP of price: client pays price + fee, agent gets price, router keeps fee
const PLATFORM_FEE = (AGENT_PRICE * FEE_BPS) / 10000n;
const TOTAL_PAYMENT = AGENT_PRICE + PLATFORM_FEE;
const AGENT_URI = "ipfs://QmSafeWithdrawFeesTestAgentURI";

// ─── Safe minimal ABI ─────────────────────────────────────────────────────────
// Hand-rolled fragments instead of installing @safe-global/* — only what this suite calls
const SAFE_ABI = [
  "event ProxyCreation(address proxy, address singleton)",
  "function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address proxy)",
  "function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address payable paymentReceiver)",
  "function nonce() view returns (uint256)",
  "function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)",
  "function approveHash(bytes32 hashToApprove)",
  "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address payable refundReceiver, bytes signatures) payable returns (bool success)",
];

// ─── EIP-3009 helpers ─────────────────────────────────────────────────────────

// Signs an EIP-3009 TransferWithAuthorization so the router pulls USDC without a prior approve()
async function buildTransferAuthorization(
  signer: SignerWithAddress,
  to: string,
  value: bigint,
  validUntil: number,
  nonce: string,
): Promise<{ v: number; r: string; s: string }> {
  const rawSig = await signer.signTypedData(
    // Hardhat fork preserves the local chainId (31337), not Base mainnet's (8453)
    { name: "USD Coin", version: "2", chainId: 31337, verifyingContract: USDC_ADDRESS },
    {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    { from: signer.address, to, value, validAfter: 0, validBefore: validUntil, nonce },
  );
  const sig = Signature.from(rawSig);
  return { v: sig.v, r: sig.r, s: sig.s };
}

// ─── Safe signature helpers ───────────────────────────────────────────────────

// Safe requires signatures in strictly ascending signer address order (else GS026)
function sortSigners(signers: SignerWithAddress[]): SignerWithAddress[] {
  return [...signers].sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()));
}

// Pre-validated Safe signatures (v=1): r = signer addr padded to 32 bytes, s = 0; needs prior approveHash()
function buildPreValidatedSignatures(signers: SignerWithAddress[]): string {
  return ethers.concat(
    sortSigners(signers).map(signer =>
      ethers.concat([ethers.zeroPadValue(signer.address, 32), ethers.ZeroHash, ethers.toBeHex(1, 1)]),
    ),
  );
}

// ─── Test suite ───────────────────────────────────────────────────────────────
// Issue #39: withdrawFees() is gated behind a Safe 2-of-3 acting as owner AND treasury
describe("SafeWithdrawFees", function () {
  let router: Contract;
  let agentMarketplace: Contract;
  let mockRegistry: Contract;
  let mockReputation: Contract;
  let usdc: Contract;
  let safe: Contract;
  let safeAddress: string;
  // Impersonated Safe signer — deploys the router and calls deployer-restricted functions
  let safeSigner: SignerWithAddress;
  // The three Safe owners (team wallets); threshold is 2-of-3
  let safeOwner1: SignerWithAddress;
  let safeOwner2: SignerWithAddress;
  let safeOwner3: SignerWithAddress;
  // Registered agent owner — receives earnings on withdrawAgentEarnings()
  let agentOwner: SignerWithAddress;
  // Signs EIP-3009 authorizations and pays for agent services
  let client: SignerWithAddress;
  // Unrelated EOA with no role at all — must never be able to withdraw fees
  let attacker: SignerWithAddress;
  let agentId: bigint;
  let routerAddress: string;
  // Snapshot ID used to restore blockchain state between tests
  let snapshotId: string;

  // ─── before ─────────────────────────────────────────────────────────────────
  // Runs ONCE: deploys the Safe, the marketplace contracts and a router owned by the Safe
  before(async function () {
    [, safeOwner1, safeOwner2, safeOwner3, agentOwner, client, attacker] = await ethers.getSigners();

    // Guard: the canonical Safe contracts must exist on the fork
    expect(await ethers.provider.getCode(SAFE_SINGLETON_ADDRESS)).to.not.equal("0x");
    expect(await ethers.provider.getCode(SAFE_PROXY_FACTORY_ADDRESS)).to.not.equal("0x");

    // Attach to the real USDC contract already deployed on the Base mainnet fork
    usdc = await ethers.getContractAt("IUSDC", USDC_ADDRESS);
    // Deploy a fresh 2-of-3 Safe through the canonical proxy factory
    safeAddress = await deploySafe2of3([safeOwner1, safeOwner2, safeOwner3]);
    safe = new ethers.Contract(safeAddress, SAFE_ABI, ethers.provider);
    safeSigner = await ethers.getSigner(safeAddress);

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
    const tx = await agentMarketplace
      .connect(agentOwner)
      ["register(uint256,string,bool)"](AGENT_PRICE, AGENT_URI, false);
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map(log => {
        try {
          return agentMarketplace.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(parsedLog => parsedLog?.name === "AgentRegistered");
    agentId = event?.args.agentId;

    // Constructor sets owner = msg.sender, so deploy FROM the Safe to make it owner from genesis
    await ethers.provider.send("hardhat_setBalance", [safeAddress, "0x8AC7230489E80000"]);
    await ethers.provider.send("hardhat_impersonateAccount", [safeAddress]);

    const RouterFactory = await ethers.getContractFactory("MarketplaceRouter", safeSigner);
    router = await RouterFactory.deploy(
      await agentMarketplace.getAddress(),
      await mockReputation.getAddress(),
      USDC_ADDRESS,
      FEE_BPS,
      // treasury: fees withdrawn via withdrawFees() land in the Safe itself
      safeAddress,
    );
    await router.waitForDeployment();
    routerAddress = await router.getAddress();

    // Sanity check the scenario premise: the Safe is BOTH owner and treasury
    expect(await router.owner()).to.equal(safeAddress);
    expect(await router.treasury()).to.equal(safeAddress);
  });

  // ─── beforeEach / afterEach ──────────────────────────────────────────────────
  // Snapshot the EVM state before each test and revert after.
  beforeEach(async function () {
    snapshotId = await ethers.provider.send("evm_snapshot", []);
  });

  afterEach(async function () {
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  // Deploys a fresh Safe proxy (2-of-3) via the canonical factory; returns the proxy address
  async function deploySafe2of3(owners: SignerWithAddress[]): Promise<string> {
    const factory = new ethers.Contract(SAFE_PROXY_FACTORY_ADDRESS, SAFE_ABI, safeOwner1);
    const singleton = new ethers.Contract(SAFE_SINGLETON_ADDRESS, SAFE_ABI, safeOwner1);
    const initializer = singleton.interface.encodeFunctionData("setup", [
      owners.map(owner => owner.address),
      // threshold: 2 signatures required out of 3 owners
      2,
      // no delegatecall target during setup
      ethers.ZeroAddress,
      "0x",
      // no fallback handler — not needed for this suite
      ethers.ZeroAddress,
      // no payment token
      ethers.ZeroAddress,
      0,
      ethers.ZeroAddress,
    ]);

    const tx = await factory.createProxyWithNonce(SAFE_SINGLETON_ADDRESS, initializer, Date.now());
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map(log => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(parsedLog => parsedLog?.name === "ProxyCreation");

    return event?.args.proxy;
  }

  async function getBlockTimestamp(): Promise<number> {
    const block = await ethers.provider.getBlock("latest");
    return block!.timestamp;
  }

  // Issue #39 "pay()" step: a full payment so the router holds price (agent liability) + fee (surplus)
  async function accumulateFees(): Promise<void> {
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const validUntil = (await getBlockTimestamp()) + 86400;
    const { v, r, s } = await buildTransferAuthorization(client, routerAddress, TOTAL_PAYMENT, validUntil, nonce);
    const sig = ethers.concat([r, s, ethers.toBeHex(v, 1)]);

    await router.connect(safeSigner).lockPayment(client.address, agentId, TOTAL_PAYMENT, validUntil, nonce, sig);

    await router.connect(safeSigner).finalizePayment(nonce);
  }

  // Safe "propose" step: computes the SafeTx hash and records approveHash() from each owner
  async function approveWithdrawFees(signers: SignerWithAddress[]): Promise<string> {
    const data = router.interface.encodeFunctionData("withdrawFees");
    const safeNonce = await safe.nonce();
    const safeTxHash = await safe.getTransactionHash(
      routerAddress,
      // value: 0 (fees are ERC20, no ETH); operation: 0 (CALL); safeTxGas: 0 (delegate to caller)
      0,
      data,
      0,
      0,
      0,
      0,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      safeNonce,
    );

    for (const signer of signers) {
      await safe.connect(signer).approveHash(safeTxHash);
    }

    return data;
  }

  // Safe "execute" step: execTransaction with pre-validated signatures; checks threshold (GS020 if short)
  async function execWithdrawFees(signers: SignerWithAddress[]) {
    const data = await approveWithdrawFees(signers);
    return safe
      .connect(signers[0])
      .execTransaction(
        routerAddress,
        0,
        data,
        0,
        0,
        0,
        0,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        buildPreValidatedSignatures(signers),
      );
  }

  it("Should accumulate fees via pay() and increase totalAgentLiabilities", async function () {
    await accumulateFees();

    // The agent's share is tracked as a liability — NOT withdrawable by the owner
    expect(await router.totalAgentLiabilities()).to.equal(AGENT_PRICE);
    expect(await router.agentBalances(agentId)).to.equal(AGENT_PRICE);
    // The router holds the full payment: agent share + platform fee
    expect(await usdc.balanceOf(routerAddress)).to.equal(TOTAL_PAYMENT);
  });

  it("Should reject withdrawFees from unrelated EOA", async function () {
    await accumulateFees();

    await expect(router.connect(attacker).withdrawFees()).to.be.revertedWithCustomError(router, "NotOwner");
  });

  it("Should reject withdrawFees from individual Safe signer", async function () {
    await accumulateFees();

    // Being a Safe owner grants NO individual power: the router's owner is the Safe contract itself
    await expect(router.connect(safeOwner1).withdrawFees()).to.be.revertedWithCustomError(router, "NotOwner");
  });

  it("Should fail Safe execTransaction with insufficient approvals (1 of 3)", async function () {
    await accumulateFees();

    // GS020 = "Signatures data too short": only 1 approval against threshold 2
    await expect(execWithdrawFees([safeOwner1])).to.be.revertedWith("GS020");
  });

  it("Should surface the inner revert as GS013 when the Safe withdraws with no surplus", async function () {
    // No fees accrued: withdrawFees() reverts NoFeesToWithdraw, surfaced by the Safe as GS013
    await expect(execWithdrawFees(sortSigners([safeOwner1, safeOwner2]))).to.be.revertedWith("GS013");
  });

  it("Should execute withdrawFees via Safe with 2-of-3 approvals", async function () {
    await accumulateFees();

    const treasuryBefore = await usdc.balanceOf(safeAddress);
    const routerBalanceBefore = await usdc.balanceOf(routerAddress);
    const liabilitiesBefore = await router.totalAgentLiabilities();
    const sortedOwners = sortSigners([safeOwner2, safeOwner1]);

    await expect(execWithdrawFees(sortedOwners)).to.not.be.reverted;

    // The Safe receives EXACTLY the surplus (balance − liabilities); more would rob the agents
    expect(await usdc.balanceOf(safeAddress)).to.equal(treasuryBefore + routerBalanceBefore - liabilitiesBefore);
    // Agent accounting must be untouched by the fee withdrawal
    expect(await router.totalAgentLiabilities()).to.equal(liabilitiesBefore);
    expect(await router.agentBalances(agentId)).to.equal(AGENT_PRICE);

    // The agent can still withdraw afterwards — proof withdrawFees() only took the platform share
    const agentOwnerBefore = await usdc.balanceOf(agentOwner.address);
    await router.withdrawAgentEarnings(agentId);
    expect(await usdc.balanceOf(agentOwner.address)).to.equal(agentOwnerBefore + AGENT_PRICE);
  });
});
