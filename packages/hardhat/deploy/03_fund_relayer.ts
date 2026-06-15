import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const fundRelayer: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const network = hre.network.name;

  if (network !== "localhost") {
    console.log("Not localhost, skipping relayer funding.");
    return;
  }

  // Use the relayer address from env or default to deployer
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer;
  const deployerSigner = await hre.ethers.getSigner(deployer);

  console.log(`🌱 Funding relayer ${relayerAddress} with 1 ETH on localhost...`);

  const tx = await deployerSigner.sendTransaction({
    to: relayerAddress,
    value: hre.ethers.parseEther("1"),
    gasLimit: 30000, // Small amount of gas for simple transfer
  });
  await tx.wait();
  console.log("✅ Relayer funded.");
};

export default fundRelayer;
fundRelayer.tags = ["FundRelayer"];
// Run this before default agents registration, but after marketplace deployment
fundRelayer.dependencies = ["AgentMarketplace"];
