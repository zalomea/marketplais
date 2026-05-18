import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseUnits } from "ethers";

const deployUSDCFaucet: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const WHALE_ADDRESS = "0x8da91A6298eA5d1A8Bc985e99798fd0A0f05701a";

  // 1. Deploy the Faucet
  const faucetDeployment = await deploy("USDCFaucet", {
    from: deployer,
    args: [USDC_ADDRESS],
    log: true,
    autoMine: true,
  });

  console.log("💧 Faucet deployed at:", faucetDeployment.address);

  // 2. Fund the Faucet only if we are on the local network
  if (hre.network.name === "localhost") {
    console.log("🐋 Preparing the whale to fund the Faucet...");

    // Inject 10 ETH into the whale so it can pay for gas
    await hre.network.provider.send("hardhat_setBalance", [
      WHALE_ADDRESS,
      "0x8AC7230489E80000", // 10 ETH in Hexadecimal
    ]);

    // Impersonate the account
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE_ADDRESS],
    });

    const whaleSigner = await hre.ethers.getSigner(WHALE_ADDRESS);
    const usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS, whaleSigner);

    // Transfer 1,000,000 USDC forcing the gas limit
    console.log("💸 Transferring USDC...");
    const fundAmount = parseUnits("1000000", 6);
    await usdc.transfer(faucetDeployment.address, fundAmount, {
      gasLimit: 300000,
    });

    // Stop impersonating
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [WHALE_ADDRESS],
    });

    console.log("✅ Faucet successfully funded with 1,000,000 USDC");
  }
};

export default deployUSDCFaucet;
deployUSDCFaucet.tags = ["USDCFaucet"];
