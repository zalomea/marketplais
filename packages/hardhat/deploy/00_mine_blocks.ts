import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const mineBlocks: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // Run only on local networks
  const localNets = ["hardhat", "localhost", "anvil"];
  if (!localNets.includes(hre.network.name)) {
    console.log(`Skipping mineBlocks on network ${hre.network.name}`);
    return;
  }

  const blocks = Number(process.env.BLOCKS) || 10;
  console.log(`Mining ${blocks} blocks on network: ${hre.network.name}`);

  for (let i = 0; i < blocks; i++) {
    // evm_mine works on local JSON-RPC providers (Hardhat / Anvil)
    // Use hre.network.provider.send so this runs as part of deploy scripts
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await hre.network.provider.send("evm_mine");
  }

  console.log(`Done — mined ${blocks} blocks.`);
};

export default mineBlocks;
mineBlocks.tags = ["MineBlocks"];
