import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import { publicClient } from "~~/services/web3/viemClient";
import { deriveApiKey } from "~~/utils/apiKey";

// Reveal a derived API key to an agent's owner after they prove ownership with
// an EIP-191 signature over "Verify ownership: {agentId}". The key is derived
// (never stored) from the on-chain owner + nonce + server secret, so only the
// current NFT owner can obtain a valid key.
export async function POST(req: NextRequest) {
  let agentId: number | string;
  let signature: `0x${string}`;
  let timestamp: number;
  try {
    const body = (await req.json()) as {
      agentId: number | string;
      signature: `0x${string}`;
      timestamp: number;
    };
    agentId = body.agentId;
    signature = body.signature;
    timestamp = body.timestamp;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (agentId === undefined || agentId === null || !signature || timestamp === undefined || timestamp === null) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Reject replayed or future-dated signatures: the challenge is only valid
  // within a 5-minute window centered on the server's clock.
  if (Math.abs(Date.now() - timestamp) > 300000) {
    return NextResponse.json({ error: "Signature expired" }, { status: 401 });
  }

  // The signature must be a 0x-prefixed hex string; reject malformed input early.
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) {
    return NextResponse.json({ error: "Invalid signature format" }, { status: 400 });
  }

  const secret = process.env.API_KEY_SECRET;
  if (!secret) {
    console.error("[reveal-key] API_KEY_SECRET is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const chainId = publicClient.chain.id;
  const contracts = (deployedContracts as any)[chainId];
  if (!contracts?.AgentMarketplace) {
    return NextResponse.json({ error: "Contracts not deployed on this network" }, { status: 503 });
  }
  const agentMarketplace = contracts.AgentMarketplace;

  // Use getAgentFullDetails so the owner is the live IdentityRegistry owner
  // (top-level `owner`), not the stale cached `agent.owner` that drifts after
  // an NFT transfer until syncAgentOwnership is called. getAgentFullDetails
  // reverts with AgentNotFoundInMarketplace for unknown ids — map to 404.
  let fullDetails: { agent: { agentId: bigint; nonce: bigint }; owner: string };
  try {
    fullDetails = (await publicClient.readContract({
      address: agentMarketplace.address,
      abi: agentMarketplace.abi,
      functionName: "getAgentFullDetails",
      args: [BigInt(agentId)],
    })) as { agent: { agentId: bigint; nonce: bigint }; owner: string };
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (!fullDetails.agent.agentId || !isAddress(fullDetails.owner)) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Reconstruct the exact signed message (must match the client side).
  const message = `Verify ownership: ${agentId} at ${timestamp}`;
  const valid = await verifyMessage({ address: fullDetails.owner, message, signature });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Owner proven — derive and return the current API key using the live owner
  // and on-chain nonce.
  const apiKey = deriveApiKey(fullDetails.agent.agentId, fullDetails.owner, fullDetails.agent.nonce, secret);
  return NextResponse.json({ apiKey });
}
