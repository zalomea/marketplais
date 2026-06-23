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

  describe("setPaymentDestination", function () {
    it("Should update payToAgentWallet and emit PaymentDestinationUpdated", async function () {
      const [, agentOwner] = await ethers.getSigners();

      const tx = await agentMarketplace
        .connect(agentOwner)
        ["register(uint256,string,bool)"](AGENT_PRICE, "ipfs://wallet-test", false);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log: any) => {
          try {
            return agentMarketplace.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsedLog: any) => parsedLog?.name === "AgentRegistered");
      const agentId = event?.args.agentId;

      await expect(agentMarketplace.connect(agentOwner).setPaymentDestination(agentId, true))
        .to.emit(agentMarketplace, "PaymentDestinationUpdated")
        .withArgs(agentId, true);

      const agent = await agentMarketplace.getAgent(agentId);
      expect(agent.payToAgentWallet).to.equal(true);
    });

    it("Should revert when non-owner calls setPaymentDestination", async function () {
      const [, agentOwner, notOwner] = await ethers.getSigners();

      const tx = await agentMarketplace
        .connect(agentOwner)
        ["register(uint256,string,bool)"](AGENT_PRICE, "ipfs://wallet-test", false);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log: any) => {
          try {
            return agentMarketplace.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsedLog: any) => parsedLog?.name === "AgentRegistered");
      const agentId = event?.args.agentId;

      await expect(
        agentMarketplace.connect(notOwner).setPaymentDestination(agentId, true),
      ).to.be.revertedWithCustomError(agentMarketplace, "NotOwnerOfAgent");
    });

    it("Should revert with SamePaymentDestination if value is unchanged", async function () {
      const [, agentOwner] = await ethers.getSigners();

      const tx = await agentMarketplace
        .connect(agentOwner)
        ["register(uint256,string,bool)"](AGENT_PRICE, "ipfs://wallet-test", false);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log: any) => {
          try {
            return agentMarketplace.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsedLog: any) => parsedLog?.name === "AgentRegistered");
      const agentId = event?.args.agentId;

      await expect(
        agentMarketplace.connect(agentOwner).setPaymentDestination(agentId, false),
      ).to.be.revertedWithCustomError(agentMarketplace, "SamePaymentDestination");
    });

    it("Should revert with AgentNotFoundInMarketplace for unknown agent", async function () {
      const [, agentOwner] = await ethers.getSigners();
      await expect(
        agentMarketplace.connect(agentOwner).setPaymentDestination(999_999n, true),
      ).to.be.revertedWithCustomError(agentMarketplace, "AgentNotFoundInMarketplace");
    });
  });
});
