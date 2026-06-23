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
  try {
    const body = (await req.json()) as { agentId: number | string; signature: `0x${string}` };
    agentId = body.agentId;
    signature = body.signature;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (agentId === undefined || agentId === null || !signature) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
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

  // Read the agent (owner + nonce) from the marketplace. getAgent reverts with
  // AgentNotFoundInMarketplace for unknown ids — map that to 404.
  let agent: { owner: string; agentId: bigint; nonce: bigint };
  try {
    agent = (await publicClient.readContract({
      address: agentMarketplace.address,
      abi: agentMarketplace.abi,
      functionName: "getAgent",
      args: [BigInt(agentId)],
    })) as { owner: string; agentId: bigint; nonce: bigint };
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (!agent.agentId || !isAddress(agent.owner)) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Verify the EIP-191 personal_sign signature over the ownership challenge.
  const message = `Verify ownership: ${agentId}`;
  const valid = await verifyMessage({ address: agent.owner, message, signature });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Owner proven — derive and return the current API key.
  const apiKey = deriveApiKey(agent.agentId, agent.owner, agent.nonce, secret);
  return NextResponse.json({ apiKey });
}
