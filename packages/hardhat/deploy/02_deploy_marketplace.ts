import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployMarketplace: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  const FEE_BPS = Number(process.env.MARKETPLACE_FEE_BPS || "1000");
  const treasury = process.env.MARKETPLACE_TREASURY_ADDRESS || deployer;
  const relayer = process.env.RELAYER_ADDRESS || deployer;
  const identityRegistryAddress = process.env.IDENTITY_REGISTRY_ADDRESS;
  const reputationRegistryAddress = process.env.REPUTATION_REGISTRY_ADDRESS;

  if (!identityRegistryAddress || identityRegistryAddress === hre.ethers.ZeroAddress) {
    throw new Error("IDENTITY_REGISTRY_ADDRESS is required for AgentMarketplace deployment");
  }

  if (!reputationRegistryAddress || reputationRegistryAddress === hre.ethers.ZeroAddress) {
    throw new Error("REPUTATION_REGISTRY_ADDRESS is required for AgentMarketplace deployment");
  }

  const agentMarketplaceDeployment = await deploy("AgentMarketplace", {
    from: deployer,
    args: [identityRegistryAddress],
    log: true,
    autoMine: true,
  });

  console.log("✅ AgentMarketplace deployed at:", agentMarketplaceDeployment.address);

  const routerDeployment = await deploy("MarketplaceRouter", {
    from: deployer,
    args: [agentMarketplaceDeployment.address, reputationRegistryAddress, USDC_ADDRESS, FEE_BPS, treasury],
    log: true,
    autoMine: true,
  });

  // Explicitly set the relayer
  const MarketplaceRouter = await hre.ethers.getContractAt(
    "MarketplaceRouter",
    routerDeployment.address,
    await hre.ethers.getSigner(deployer),
  );

  if (relayer !== deployer) {
    await (await MarketplaceRouter.setRelayer(relayer, { gasLimit: 10000000 })).wait();
    console.log("✅ Relayer set to:", relayer);
  } else {
    console.log("✅ Relayer defaults to deployer:", relayer);
  }

  console.log("✅ MarketplaceRouter deployed at:", routerDeployment.address);
  console.log("   ├─ treasury:", treasury);
  console.log("   └─ relayer:", relayer);
  console.log("   └─ feeBps:", FEE_BPS);
};

export default deployMarketplace;
deployMarketplace.tags = ["AgentMarketplace", "MarketplaceRouter"];
