import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

// Read-only client connected to Base mainnet, used server-side to verify on-chain payments.
// Falls back to the public Base RPC if BASE_RPC_URL is not set (not recommended for production).
export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
});

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
