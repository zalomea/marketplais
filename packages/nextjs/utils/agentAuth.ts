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
 * - If the agent ID is missing, returns an error so the request is rejected.
 * - If set, reads the agent from AgentMarketplace, derives the expected key, and
 *   compares it to the header with a constant-time comparison.
 *
 * @returns `{ ok: true }` on success, or `{ ok: false, response }` with a 401
 *          NextResponse the caller must return immediately.
 */
export async function verifyAgentApiKey(
  req: NextRequest,
  agentId: string | number | undefined,
): Promise<{ ok: boolean; response?: NextResponse }> {
  const agentIdStr = typeof agentId === "number" ? String(agentId) : (agentId ?? req.headers.get("x-agent-id") ?? "");
  if (!agentIdStr) {
    // Fail closed: a missing agent ID is a server misconfiguration, not a
    // dev-friendly state. Returning ok:true would let anyone bypass the x402
    // escrow flow by hitting the agent endpoint directly.
    return {
      ok: false,
      response: NextResponse.json({ error: "Server misconfiguration: agent ID missing" }, { status: 500 }),
    };
  }

  const providedKey = req.headers.get("X-API-Key");
  const secret = process.env.API_KEY_SECRET || "secretdev";
  if (!secret) {
    return { ok: false, response: NextResponse.json({ error: "Invalid API Key" }, { status: 401 }) };
  }

  const chainId = publicClient.chain.id;
  const contracts = (deployedContracts as any)[chainId];
  if (!contracts?.AgentMarketplace) {
    return { ok: false, response: NextResponse.json({ error: "Invalid API Key" }, { status: 401 }) };
  }
  const agentMarketplace = contracts.AgentMarketplace;

  // Use getAgentFullDetails so the owner comes from the live IdentityRegistry
  // (top-level `owner`), not the stale cached `agent.owner`. The cached owner
  // drifts after an NFT transfer until syncAgentOwnership is called, which
  // would let a previous owner derive a still-valid key.
  let fullDetails: { agent: { nonce: bigint }; owner: string };
  try {
    fullDetails = (await publicClient.readContract({
      address: agentMarketplace.address,
      abi: agentMarketplace.abi,
      functionName: "getAgentFullDetails",
      args: [BigInt(agentIdStr)],
    })) as { agent: { nonce: bigint }; owner: string };
  } catch {
    // Agent missing or contract read failed — treat as unauthorized, not a 500,
    // so probes can't distinguish "bad key" from "bad agent id".
    return { ok: false, response: NextResponse.json({ error: "Invalid API Key" }, { status: 401 }) };
  }

  const expectedKey = deriveApiKey(BigInt(agentIdStr), fullDetails.owner, fullDetails.agent.nonce, secret);

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
