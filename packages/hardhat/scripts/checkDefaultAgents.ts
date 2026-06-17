// Temporary Phase 3 verification helper for issue-69-agent-seeding (safe to delete).
import { ethers, deployments } from "hardhat";

const PREFIX = "data:application/json;base64,";

async function main() {
  const marketplace = await ethers.getContractAt(
    "AgentMarketplace",
    (await deployments.get("AgentMarketplace")).address,
  );
  // Source of truth: the registry the deployed marketplace actually uses
  // (env loading differs between `yarn deploy` and `hardhat run`).
  const registry = await ethers.getContractAt("IIdentityRegistry", await marketplace.identityRegistry());

  const details = await marketplace.getAgentsFullPaginated(1, 1000);
  let coreCount = 0;
  for (const d of details) {
    if (!d.uri.startsWith(PREFIX)) continue;
    let meta: { name?: string; services?: { name: string; endpoint: string }[] };
    try {
      meta = JSON.parse(Buffer.from(d.uri.slice(PREFIX.length), "base64").toString("utf8"));
    } catch {
      continue;
    }
    if (meta.name !== "analyze" && meta.name !== "summarize") continue;
    coreCount++;
    const owner = await registry.ownerOf(d.agent.agentId);
    console.log(
      `AGENT name=${meta.name} id=${d.agent.agentId} owner=${owner} price=${d.agent.price} active=${d.agent.active} endpoint=${meta.services?.find(s => s.name === "web")?.endpoint}`,
    );
  }
  console.log(`CORE_AGENT_COUNT=${coreCount}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
