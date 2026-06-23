import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentMarketplace, MockIdentityRegistry } from "../typechain-types";

describe("AgentMarketplace — burned token resilience", function () {
  const AGENT_PRICE = ethers.parseUnits("1", 6);
  const UPDATED_PRICE = ethers.parseUnits("2", 6);

  let agentMarketplace: AgentMarketplace;
  let mockRegistry: MockIdentityRegistry;

  beforeEach(async function () {
    const MockRegistryFactory = await ethers.getContractFactory("MockIdentityRegistry");
    mockRegistry = await MockRegistryFactory.deploy();
    await mockRegistry.waitForDeployment();

    const AgentMarketplaceFactory = await ethers.getContractFactory("AgentMarketplace");
    agentMarketplace = await AgentMarketplaceFactory.deploy(await mockRegistry.getAddress());
    await agentMarketplace.waitForDeployment();
  });

  it("Should return inactive record for burned agent without reverting", async function () {
    const [, agentOwnerA, agentOwnerB] = await ethers.getSigners();

    const txA = await agentMarketplace
      .connect(agentOwnerA)
      ["register(uint256,string,bool)"](AGENT_PRICE, "ipfs://burn-test-a", false);
    const receiptA = await txA.wait();
    const eventA = receiptA?.logs
      .map((log: any) => {
        try {
          return agentMarketplace.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsedLog: any) => parsedLog?.name === "AgentRegistered");
    const agentIdA = eventA?.args.agentId;

    const txB = await agentMarketplace
      .connect(agentOwnerB)
      ["register(uint256,string,bool)"](UPDATED_PRICE, "ipfs://burn-test-b", true);
    const receiptB = await txB.wait();
    const eventB = receiptB?.logs
      .map((log: any) => {
        try {
          return agentMarketplace.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsedLog: any) => parsedLog?.name === "AgentRegistered");
    const agentIdB = eventB?.args.agentId;

    // Burn agent A's token in the external registry
    await mockRegistry.connect(agentOwnerA).burn(agentIdA);

    // Before the fix this reverted because ownerOf reverts on burned tokens.
    // After the fix it returns the page with an inactive, zeroed-out record.
    const results = await agentMarketplace.getAgentsFullPaginated(1n, 10n);

    expect(results).to.have.length(2);

    const burned = results.find(r => r.agent.agentId === agentIdA);
    if (!burned) throw new Error("Burned agent not found in results");
    expect(burned.owner).to.equal(ethers.ZeroAddress);
    expect(burned.agent.active).to.equal(false);
    expect(burned.uri).to.equal("");

    const healthy = results.find(r => r.agent.agentId === agentIdB);
    if (!healthy) throw new Error("Healthy agent not found in results");
    expect(healthy.owner).to.equal(agentOwnerB.address);
    expect(healthy.agent.active).to.equal(true);
    expect(healthy.uri).to.equal("ipfs://burn-test-b");
  });
});
