import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import deployedContracts from "~~/contracts/deployedContracts";
import { publicClient } from "~~/services/web3/viemClient";
import { deriveApiKey } from "~~/utils/apiKey";

/**
 * Verifies the `X-API-Key` header against the HMAC key derived from an agent's
 * on-chain owner + nonce. Demo agent endpoints use this to reject requests that
 * bypass the x402 escrow flow (fixes the unauthenticated-proxy issue, bug C2).
 *
 * Behavior:
 * - If the env var named by `agentIdEnvVar` is unset, logs a warning and returns
 *   `ok: true` so local dev works without a deployed agent ID.
 * - If set, reads the agent from AgentMarketplace, derives the expected key, and
 *   compares it to the header with a constant-time comparison.
 *
 * @returns `{ ok: true }` on success, or `{ ok: false, response }` with a 401
 *          NextResponse the caller must return immediately.
 */
export async function verifyAgentApiKey(
  req: NextRequest,
  agentIdEnvVar: string,
): Promise<{ ok: boolean; response?: NextResponse }> {
  const agentIdStr = process.env[agentIdEnvVar];
  if (!agentIdStr) {
    console.warn(`[agentAuth] ${agentIdEnvVar} not set — skipping API key validation (dev fallback)`);
    return { ok: true };
  }

  const providedKey = req.headers.get("X-API-Key");
  const secret = process.env.API_KEY_SECRET;
  if (!secret) {
    return { ok: false, response: NextResponse.json({ error: "Invalid API Key" }, { status: 401 }) };
  }

  const chainId = publicClient.chain.id;
  const contracts = (deployedContracts as any)[chainId];
  if (!contracts?.AgentMarketplace) {
    return { ok: false, response: NextResponse.json({ error: "Invalid API Key" }, { status: 401 }) };
  }
  const agentMarketplace = contracts.AgentMarketplace;

  let agent: { owner: string; nonce: bigint };
  try {
    agent = (await publicClient.readContract({
      address: agentMarketplace.address,
      abi: agentMarketplace.abi,
      functionName: "getAgent",
      args: [BigInt(agentIdStr)],
    })) as { owner: string; nonce: bigint };
  } catch {
    // Agent missing or contract read failed — treat as unauthorized, not a 500,
    // so probes can't distinguish "bad key" from "bad agent id".
    return { ok: false, response: NextResponse.json({ error: "Invalid API Key" }, { status: 401 }) };
  }

  const expectedKey = deriveApiKey(BigInt(agentIdStr), agent.owner, agent.nonce, secret);

  // Constant-time comparison to avoid timing side-channels. Length mismatch
  // short-circuits (the expected HMAC is always 64 hex chars, which is public).
  const providedBuf = Buffer.from(providedKey ?? "", "utf8");
  const expectedBuf = Buffer.from(expectedKey, "utf8");
  const matched = providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);

  if (!matched) {
    return { ok: false, response: NextResponse.json({ error: "Invalid API Key" }, { status: 401 }) };
  }

  return { ok: true };
}
