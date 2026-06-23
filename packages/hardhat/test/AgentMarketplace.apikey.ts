import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentMarketplace, IIdentityRegistry } from "../typechain-types";

const IDENTITY_REGISTRY_ADDRESS = process.env.IDENTITY_REGISTRY_ADDRESS ?? "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

// Test suite for the on-chain nonce that backs stateless API key rotation
// (SDD change: issue-98-api-key-management).
describe("AgentMarketplace — API key nonce", function () {
  const AGENT_PRICE = ethers.parseUnits("1", 6);

  let agentMarketplace: AgentMarketplace;
  let iIdentityRegistry: IIdentityRegistry;

  beforeEach(async function () {
    iIdentityRegistry = await ethers.getContractAt("IIdentityRegistry", IDENTITY_REGISTRY_ADDRESS);

    const AgentMarketplaceFactory = await ethers.getContractFactory("AgentMarketplace");
    agentMarketplace = await AgentMarketplaceFactory.deploy(await iIdentityRegistry.getAddress());
    await agentMarketplace.waitForDeployment();
  });

  // Helper: register an agent as `owner` and return the minted agentId parsed
  // from the AgentRegistered event (matches the pattern in AgentMarketplace.test.ts).
  const registerAgentAs = async (
    ownerSigner: { getAddress: () => Promise<string> } & Awaited<ReturnType<typeof ethers.getSigner>>,
  ) => {
    const tx = await agentMarketplace
      .connect(ownerSigner)
      ["register(uint256,string,bool)"](AGENT_PRICE, "ipfs://apikey-test", false);
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
    return event?.args.agentId as bigint;
  };

  it("initializes a freshly registered agent's nonce to 0", async function () {
    const [, agentOwner] = await ethers.getSigners();
    const agentId = await registerAgentAs(agentOwner);

    const agent = await agentMarketplace.getAgent(agentId);
    expect(agent.nonce).to.equal(0n);
  });

  it("lets the agent owner increment the nonce to 1", async function () {
    const [, agentOwner] = await ethers.getSigners();
    const agentId = await registerAgentAs(agentOwner);

    await agentMarketplace.connect(agentOwner).incrementNonce(agentId);

    const agent = await agentMarketplace.getAgent(agentId);
    expect(agent.nonce).to.equal(1n);
  });

  it("emits NonceIncremented with the indexed agentId and the new nonce", async function () {
    const [, agentOwner] = await ethers.getSigners();
    const agentId = await registerAgentAs(agentOwner);

    await expect(agentMarketplace.connect(agentOwner).incrementNonce(agentId))
      .to.emit(agentMarketplace, "NonceIncremented")
      .withArgs(agentId, 1n);
  });

  it("reverts with NotOwnerOfAgent when a non-owner calls incrementNonce", async function () {
    const [, agentOwner, notOwner] = await ethers.getSigners();
    const agentId = await registerAgentAs(agentOwner);

    await expect(agentMarketplace.connect(notOwner).incrementNonce(agentId)).to.be.revertedWithCustomError(
      agentMarketplace,
      "NotOwnerOfAgent",
    );
  });

  it("reverts with AgentNotFoundInMarketplace when agentId is not registered", async function () {
    const [, agentOwner] = await ethers.getSigners();
    const unregisteredAgentId = 999999n;

    await expect(
      agentMarketplace.connect(agentOwner).incrementNonce(unregisteredAgentId),
    ).to.be.revertedWithCustomError(agentMarketplace, "AgentNotFoundInMarketplace");
  });
});
