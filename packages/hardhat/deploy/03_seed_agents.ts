import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const seedAgents: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const network = hre.network.name;

  // Define production networks to skip
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
    console.log("🚫 Skipping seeding in production network:", network);
    return;
  }

  console.log("🌱 Seeding agents for non-production network:", network);

  const AgentMarketplace = await hre.ethers.getContractAt(
    "AgentMarketplace",
    (await hre.deployments.get("AgentMarketplace")).address,
    await hre.ethers.getSigner(deployer),
  );

  const agentsToSeed = [
    {
      price: hre.ethers.parseUnits("10", 6),
      uri: "https://ipfs.io/ipfs/QmR27Uj29ogrBwYWty8iKCRhesYzcKVFczLWHbiBKZF9B5",
      payToAgentWallet: false,
    },
    {
      price: hre.ethers.parseUnits("20", 6),
      uri: "data:application/json;base64,eyJ0eXBlIjoiaHR0cHM6Ly9laXBzLmV0aGVyZXVtLm9yZy9FSVBTL2VpcC04MDA0I3JlZ2lzdHJhdGlvbi12MSIsIm5hbWUiOiJteUFnZW50TmFtZSIsImRlc2NyaXB0aW9uIjoiQSBuYXR1cmFsIGxhbmd1YWdlIGRlc2NyaXB0aW9uIG9mIHRoZSBBZ2VudCwgd2hpY2ggTUFZIGluY2x1ZGUgd2hhdCBpdCBkb2VzLCBob3cgaXQgd29ya3MsIHByaWNpbmcsIGFuZCBpbnRlcmFjdGlvbiBtZXRob2RzIiwiaW1hZ2UiOiJodHRwczovL2V4YW1wbGUuY29tL2FnZW50aW1hZ2UucG5nIiwic2VydmljZXMiOlt7Im5hbWUiOiJ3ZWIiLCJlbmRwb2ludCI6Imh0dHBzOi8vd2ViLmFnZW50eHl6LmNvbS8ifSx7Im5hbWUiOiJBMkEiLCJlbmRwb2ludCI6Imh0dHBzOi8vYWdlbnQuZXhhbXBsZS8ud2VsbC1rbm93bi9hZ2VudC1jYXJkLmpzb24iLCJ2ZXJzaW9uIjoiMC4zLjAifSx7Im5hbWUiOiJlbWFpbCIsImVuZHBvaW50IjoibWFpbEBteWFnZW50LmNvbSJ9XSwieDQwMlN1cHBvcnQiOmZhbHNlLCJhY3RpdmUiOnRydWUsInJlZ2lzdHJhdGlvbnMiOlt7ImFnZW50SWQiOjIyLCJhZ2VudFJlZ2lzdHJ5Ijoie25hbWVzcGFjZX06e2NoYWluSWR9OntpZGVudGl0eVJlZ2lzdHJ5fSJ9XSwic3VwcG9ydGVkVHJ1c3QiOlsicmVwdXRhdGlvbiIsImNyeXB0by1lY29ub21pYyIsInRlZS1hdHRlc3RhdGlvbiJdfQ==",
      payToAgentWallet: true,
    },
    {
      price: hre.ethers.parseUnits("50", 6),
      uri: "data:application/json;base64,e30=",
      payToAgentWallet: false,
    },
  ];

  for (const agent of agentsToSeed) {
    console.log(`🚀 Registering agent with URI: ${agent.uri.substring(0, 50)}...`);
    await (
      await AgentMarketplace["register(uint256,string,bool)"](agent.price, agent.uri, agent.payToAgentWallet, {
        gasLimit: 10000000,
      })
    ).wait();
  }
};

export default seedAgents;
seedAgents.tags = ["SeedAgents"];
seedAgents.dependencies = ["AgentMarketplace"];
