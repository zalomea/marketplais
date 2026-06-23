import { createHmac } from "crypto";

/**
 * Derives a deterministic API key for an agent using HMAC-SHA256.
 *
 * The key is a pure function of (agentId, ownerAddress, nonce, server secret),
 * so the relayer and the demo agents can independently compute the same key
 * without ever storing it. Rotating the key = incrementing the on-chain nonce.
 *
 * @param agentId      On-chain agent identifier.
 * @param ownerAddress Owner of the agent (checksummed or lowercase — normalized here).
 * @param nonce        Current on-chain nonce for the agent.
 * @param secret       Server-side `API_KEY_SECRET`. Must be kept private.
 * @returns 64-char lowercase hex HMAC-SHA256 digest.
 */
export function deriveApiKey(agentId: bigint, ownerAddress: string, nonce: bigint, secret: string): string {
  // Owner address is normalized to lowercase so checksummed and lowercase
  // forms produce the same key. Colons act as unambiguous separators,
  // preventing collisions like (agentId=1, owner="2:3") vs (agentId=12, owner=":3").
  const data = `${agentId}:${ownerAddress.toLowerCase()}:${nonce}`;
  return createHmac("sha256", secret).update(data).digest("hex");
}
