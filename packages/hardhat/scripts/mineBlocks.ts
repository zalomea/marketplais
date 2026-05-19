/**
 * Script de Hardhat para minar bloques en la red local.
 *
 * Uso:
 *  - Ejecutar en localhost: `npx hardhat run --network localhost packages/hardhat/scripts/mineBlocks.ts`
 *  - Cambiar número de bloques: `BLOCKS=20 npx hardhat run --network localhost packages/hardhat/scripts/mineBlocks.ts`
 *
 * Por defecto minará 10 bloques.
 */
import { network } from "hardhat";

async function main() {
  const blocks = Number(process.env.BLOCKS) || 10;
  console.log(`Mining ${blocks} blocks on network: ${network.name}`);

  for (let i = 0; i < blocks; i++) {
    // evm_mine works on local JSON-RPC providers (Hardhat / Anvil)
    await network.provider.send("evm_mine");
  }

  console.log(`Done — mined ${blocks} blocks.`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
