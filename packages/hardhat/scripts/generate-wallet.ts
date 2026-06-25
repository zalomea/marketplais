import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

async function main() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  console.log("--- NEW WALLET GENERATED ---");
  console.log("Private Key (SAVE THIS SECURELY!):", privateKey);
  console.log("Public Address:", account.address);
  console.log("----------------------------");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
