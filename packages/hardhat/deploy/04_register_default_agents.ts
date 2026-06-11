import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  DEFAULT_AGENTS,
  DEFAULT_AGENT_PRICES,
  buildAgentMetadata,
  extractAgentNameFromUri,
  isInvalidPageError,
  resolveDefaultAgentOwner,
} from "../utils/defaultAgents";

const DEFAULT_BASE_URL = "http://localhost:3000";

const registerDefaultAgents: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const network = hre.network.name;

  // Never auto-register on production networks: core agents require manual registration there.
  const productionNetworks = [
    "mainnet",
    "arbitrum",
    "optimism",
    "polygon",
    "polygonZkEvm",
    "gnosis",
    "base",
    "scroll",
    "celo",
  ];

  if (productionNetworks.includes(network)) {
    console.log("🚫 Skipping default agent registration on production network:", network);
    console.log("   Core agents (analyze, summarize) require manual registration on production networks.");
    return;
  }

  // Throws on malformed/zero address, aborting the deploy with a clear message.
  const { owner, fallback } = resolveDefaultAgentOwner(process.env.DEFAULT_AGENT_OWNER_ADDRESS);
  if (fallback) {
    console.warn("⚠️  WARNING: DEFAULT_AGENT_OWNER_ADDRESS is not set.");
    console.warn("⚠️  The deployer account will KEEP OWNERSHIP of the default agents (analyze, summarize).");
    console.warn("⚠️  Set DEFAULT_AGENT_OWNER_ADDRESS in packages/hardhat/.env to transfer them automatically.");
  }

  const baseUrl = process.env.AGENT_SERVICE_BASE_URL?.trim() || DEFAULT_BASE_URL;
  if (!baseUrl.startsWith("https://")) {
    console.log(
      `ℹ️  AGENT_SERVICE_BASE_URL is non-https (${baseUrl}): agents will be browsable but the execute route rejects non-https endpoints (SSRF guard).`,
    );
  }

  const deployerSigner = await hre.ethers.getSigner(deployer);
  const marketplaceAddress = (await hre.deployments.get("AgentMarketplace")).address;
  const marketplace = await hre.ethers.getContractAt("AgentMarketplace", marketplaceAddress, deployerSigner);

  // Idempotency scan: chain state is the source of truth. getAgentsFullPaginated
  // reverts with InvalidPage on an empty marketplace, so a revert means "no agents yet".
  // We keep agentId and current owner per name so ownership can be reconciled below.
  const existingByName = new Map<string, { agentId: bigint; owner: string }>();
  try {
    const details = await marketplace.getAgentsFullPaginated(1, 1000);
    for (const detail of details) {
      const name = extractAgentNameFromUri(detail.uri);
      if (name !== null && !existingByName.has(name)) {
        existingByName.set(name, { agentId: detail.agent.agentId, owner: detail.owner });
      }
    }
  } catch (error) {
    // Only an InvalidPage revert means "empty marketplace — nothing seeded yet".
    // Any other failure (RPC error, wrong address) must abort: treating it as
    // empty would re-register the core agents and create duplicates.
    // Detection is selector-based: the node only decodes the error name when it
    // holds compiled artifacts, which is not guaranteed (e.g. CI starts the
    // chain before compiling).
    if (!isInvalidPageError(error)) {
      throw error;
    }
  }

  const registeredAgentIds: { name: string; agentId: bigint }[] = [];

  for (const name of DEFAULT_AGENTS) {
    const existing = existingByName.get(name);
    if (existing) {
      // Ownership reconciliation: if a previous deploy ran in fallback mode the
      // deployer still owns the agent. When a target owner is configured now,
      // transfer it instead of silently leaving the env var unfulfilled.
      // Agents owned by anyone else (sold or manually transferred) are never touched.
      if (
        owner &&
        owner.toLowerCase() !== deployer.toLowerCase() &&
        existing.owner.toLowerCase() === deployer.toLowerCase()
      ) {
        console.log(`🔁 Agent "${name}" already registered but owned by the deployer — reconciling ownership.`);
        registeredAgentIds.push({ name, agentId: existing.agentId });
      } else {
        console.log(`⏭️  Agent "${name}" is already registered — skipping.`);
      }
      continue;
    }

    const price = DEFAULT_AGENT_PRICES[name];
    const uri = buildAgentMetadata(name, baseUrl);

    console.log(`🚀 Registering default agent "${name}" (price: ${price} micro-USDC)...`);
    const register = marketplace.getFunction("register(uint256,string,bool)");
    const registerGas = await register.estimateGas(price, uri, false);
    const tx = await register(price, uri, false, { gasLimit: (registerGas * 120n) / 100n });
    const receipt = await tx.wait();

    let agentId: bigint | undefined;
    for (const log of receipt?.logs ?? []) {
      if (log.address.toLowerCase() !== marketplaceAddress.toLowerCase()) continue;
      const parsed = marketplace.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "AgentRegistered") {
        agentId = parsed.args.agentId as bigint;
        break;
      }
    }

    if (agentId === undefined) {
      throw new Error(`AgentRegistered event not found in receipt for agent "${name}"`);
    }

    console.log(`✅ Registered "${name}" with agentId ${agentId}`);
    registeredAgentIds.push({ name, agentId });
  }

  // Skip transfers when the configured owner IS the deployer: ownership is already correct.
  if (owner && owner.toLowerCase() !== deployer.toLowerCase() && registeredAgentIds.length > 0) {
    const identityRegistry = await hre.ethers.getContractAt(
      "IIdentityRegistry",
      await marketplace.identityRegistry(),
      deployerSigner,
    );

    for (const { name, agentId } of registeredAgentIds) {
      console.log(`📦 Transferring agent "${name}" (id ${agentId}) to ${owner}...`);
      const gas = await identityRegistry.safeTransferFrom.estimateGas(deployer, owner, agentId);
      await (
        await identityRegistry.safeTransferFrom(deployer, owner, agentId, { gasLimit: (gas * 120n) / 100n })
      ).wait();
      console.log(`✅ Agent "${name}" transferred to ${owner}`);
    }
  }
};

export default registerDefaultAgents;
registerDefaultAgents.tags = ["DefaultAgents"];
registerDefaultAgents.dependencies = ["AgentMarketplace"];
