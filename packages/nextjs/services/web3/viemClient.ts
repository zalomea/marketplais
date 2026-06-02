import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import scaffoldConfig from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

// Read-only client connected to the active target network, used server-side to verify on-chain payments.
const targetNetwork = scaffoldConfig.targetNetworks[0];

// Resolves the RPC URL dynamically using existing configurations:
// 1. RPC_URL environment variable if set.
// 2. Custom RPC override from scaffold.config.ts if configured for this chain.
// 3. NEXT_PUBLIC_RPC_URL environment variable for local hardhat network.
// 4. Alchemy URL built using NEXT_PUBLIC_ALCHEMY_API_KEY.
// 5. Fallback to the default public RPC for the active target network.
const getRpcUrl = () => {
  if (process.env.RPC_URL) return process.env.RPC_URL;

  const override = (scaffoldConfig.rpcOverrides as Record<number, string>)?.[targetNetwork.id];
  if (override) return override;

  if (targetNetwork.id === 31337 && process.env.NEXT_PUBLIC_RPC_URL) {
    return process.env.NEXT_PUBLIC_RPC_URL;
  }

  const alchemyUrl = getAlchemyHttpUrl(targetNetwork.id);
  if (alchemyUrl) return alchemyUrl;

  return undefined;
};

export const publicClient = createPublicClient({
  chain: targetNetwork,
  transport: http(getRpcUrl()),
});

// Factory (not singleton) so RELAYER_PRIVATE_KEY is read fresh on each request.
// Dev default: Hardhat account 0 (deployer = owner = relayer). Replace in production.
export function getRelayerWalletClient() {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) throw new Error("RELAYER_PRIVATE_KEY is not set");
  // FIX 10 — validate format before passing to privateKeyToAccount
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error("RELAYER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string");
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: targetNetwork,
    transport: http(getRpcUrl()),
  });
}

/** Returns the raw transaction data (sender, recipient, input data, etc.) for a given hash. */
export async function getTransaction(txHash: `0x${string}`) {
  return publicClient.getTransaction({ hash: txHash });
}

/**
 * Returns the transaction receipt for a given hash.
 * The receipt contains the execution status ("success" | "reverted") and the emitted logs.
 * Returns null if the transaction is still pending.
 */
export async function getTransactionReceipt(txHash: `0x${string}`) {
  return publicClient.getTransactionReceipt({ hash: txHash });
}
