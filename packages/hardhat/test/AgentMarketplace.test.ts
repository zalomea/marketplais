import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentMarketplace, IIdentityRegistry } from "../typechain-types";

const IDENTITY_REGISTRY_ADDRESS = process.env.IDENTITY_REGISTRY_ADDRESS ?? "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

describe("AgentMarketplace", function () {
  const AGENT_PRICE = ethers.parseUnits("1", 6);
  const UPDATED_PRICE = ethers.parseUnits("2", 6);

  let agentMarketplace: AgentMarketplace;
  let iIdentityRegistry: IIdentityRegistry;

  beforeEach(async function () {
    iIdentityRegistry = await ethers.getContractAt("IIdentityRegistry", IDENTITY_REGISTRY_ADDRESS);

    const AgentMarketplaceFactory = await ethers.getContractFactory("AgentMarketplace");
    agentMarketplace = await AgentMarketplaceFactory.deploy(await iIdentityRegistry.getAddress());
    await agentMarketplace.waitForDeployment();
  });

  it("returns only agents owned by the requested owner", async function () {
    const [, ownerA, ownerB] = await ethers.getSigners();

    await agentMarketplace.connect(ownerA)["register(uint256,string,bool)"](AGENT_PRICE, "ipfs://owner-a-1", false);
    await agentMarketplace.connect(ownerB)["register(uint256,string,bool)"](AGENT_PRICE, "ipfs://owner-b-1", false);
    await agentMarketplace.connect(ownerA)["register(uint256,string,bool)"](UPDATED_PRICE, "ipfs://owner-a-2", true);

    const ownerAAgents = await agentMarketplace.getAgentsByOwner(ownerA.address);

    expect(ownerAAgents).to.have.length(2);
    expect(ownerAAgents[0].owner).to.equal(ownerA.address);
    expect(ownerAAgents[0].agent.price).to.equal(AGENT_PRICE);
    expect(ownerAAgents[1].owner).to.equal(ownerA.address);
    expect(ownerAAgents[1].agent.price).to.equal(UPDATED_PRICE);
  });

  it("rejects zero address owner lookups", async function () {
    await expect(agentMarketplace.getAgentsByOwner(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      agentMarketplace,
      "ZeroAddress",
    );
  });
});
