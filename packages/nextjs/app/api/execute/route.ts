import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isAddress } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import externalContracts from "~~/contracts/externalContracts";
import { getRelayerWalletClient, publicClient } from "~~/services/web3/viemClient";
import { deriveApiKey } from "~~/utils/apiKey";

// Fail closed: without the server secret we cannot derive API keys, so the
// execute gateway must not operate (neither the 402 challenge nor escrow flow).
if (!process.env.API_KEY_SECRET) {
  throw new Error("API_KEY_SECRET is not set");
}
// Captured once at module load (narrowed to `string` by the guard above) so the
// per-request handler can use it without re-checking or non-null assertions.
const API_KEY_SECRET = process.env.API_KEY_SECRET;

// Expected request payload (application/json):
// {
//   "agentId": 1, // number or string identifier of the AI agent to execute
//   "request": {
//     "prompt": "What is the weather today?", // user query or instruction
//     "metadata": { "lang": "en" } // optional additional data sent to the agent
//   }
// }
// The `request` object follows the `AgentUserRequest` interface defined below.

// Phase 1 (no headers): reads price + fee from contracts and returns a 402 challenge.
// Phase 2 (headers present): verifies the EIP-3009 signature, settles payment on-chain,
// and calls the AI agent only after settlement succeeds.
interface AgentUserRequest {
  /** The actual user prompt or instruction sent to the AI agent. */
  prompt: string;
  /** Optional free‑form metadata that can be used by the agent implementation. */
  metadata?: Record<string, any>;
}
export async function POST(request: Request) {
  // malformed body returns 400, not an unhandled 500
  let agentId: number | string;
  let userRequest: AgentUserRequest;
  try {
    const body = (await request.json()) as { agentId: number | string; request: AgentUserRequest };
    agentId = body.agentId;
    userRequest = body.request;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (agentId === undefined || agentId === null) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }
  if (!userRequest || typeof userRequest.prompt !== "string") {
    return NextResponse.json({ error: "request.prompt is required and must be a string" }, { status: 400 });
  }

  const signature = request.headers.get("x-payment-signature");
  const headerNonce = request.headers.get("x-payment-nonce");
  const headerDeadline = request.headers.get("x-payment-deadline");
  const clientAddress = request.headers.get("x-payment-from");

  if (signature && headerNonce && headerDeadline && clientAddress) {
    // reject malformed address early — viem throws an unguarded 500 on invalid input
    if (!isAddress(clientAddress)) {
      return NextResponse.json({ error: "x-payment-from must be a valid Ethereum address" }, { status: 400 });
    }

    // nonce must be exactly 32 bytes (bytes32 in Solidity) — reject early to avoid silent ABI encoding errors
    if (!/^0x[0-9a-fA-F]{64}$/.test(headerNonce)) {
      return NextResponse.json({ error: "x-payment-nonce must be a 0x-prefixed 32-byte hex string" }, { status: 400 });
    }

    // BigInt() throws on non-integer strings — validate format first
    if (!/^\d+$/.test(headerDeadline)) {
      return NextResponse.json({ error: "x-payment-deadline must be a positive integer" }, { status: 400 });
    }
    // expired deadline is a bad request (400), not a payment prompt (402)
    if (BigInt(headerDeadline) <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Payment deadline has expired" }, { status: 400 });
    }

    const chainId = publicClient.chain.id;
    const contracts = (deployedContracts as any)[chainId];
    if (!contracts) return NextResponse.json({ error: "Contracts not deployed on this network" }, { status: 503 });
    const agentMarketplace = contracts.AgentMarketplace;
    const marketplaceRouter = contracts.MarketplaceRouter;
    const extContracts = (externalContracts as any)[chainId];
    if (!extContracts) return NextResponse.json({ error: "Contracts not deployed on this network" }, { status: 503 });
    const { USDC, IdentityRegistry } = extContracts;

    // Step 1 — recompute amount from chain; never trust what the client claims to have signed.
    let agent: { owner: string; agentId: bigint; price: bigint; nonce: bigint; active: boolean };
    try {
      agent = (await publicClient.readContract({
        address: agentMarketplace.address,
        abi: agentMarketplace.abi,
        functionName: "getAgent",
        args: [BigInt(agentId)],
      })) as { owner: string; agentId: bigint; price: bigint; nonce: bigint; active: boolean };
    } catch {
      return NextResponse.json({ error: "Failed to fetch agent data" }, { status: 500 });
    }

    if (!agent.active) {
      return NextResponse.json({ error: "Agent not active" }, { status: 400 });
    }

    let feeBps: bigint;
    try {
      feeBps = (await publicClient.readContract({
        address: marketplaceRouter.address,
        abi: marketplaceRouter.abi,
        functionName: "feeBps",
        args: [],
      })) as bigint;
    } catch (err: any) {
      console.error("[execute] Failed to read feeBps:", err?.message);
      return NextResponse.json({ error: "Failed to read platform fee" }, { status: 500 });
    }

    const platformFee = (agent.price * feeBps) / 10000n;
    const totalAmount = agent.price + platformFee;

    // Step 2 — verify TransferWithAuthorization signature off-chain (no gas).
    const nonce = headerNonce as `0x${string}`;
    const deadline = BigInt(headerDeadline);

    const isValid = await publicClient.verifyTypedData({
      address: clientAddress as `0x${string}`,
      domain: {
        name: "USD Coin",
        version: "2",
        chainId,
        verifyingContract: USDC.address,
      },
      types: {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      message: {
        from: clientAddress as `0x${string}`,
        to: marketplaceRouter.address as `0x${string}`,
        value: totalAmount,
        validAfter: 0n,
        validBefore: deadline,
        nonce,
      },
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 402 });
    }

    // Step 3 — read tokenURI from IdentityRegistry, decode EIP-8004 JSON, extract "web" endpoint.
    let agentEndpoint: string;
    try {
      const agentURI = (await publicClient.readContract({
        address: IdentityRegistry.address,
        abi: IdentityRegistry.abi,
        functionName: "tokenURI",
        args: [BigInt(agentId)],
      })) as string;

      let json: any;
      if (agentURI.startsWith("data:application/json;base64,")) {
        // Buffer.from is idiomatic Node.js; atob is a browser API
        const b64 = agentURI.split(",")[1];
        if (!b64) throw new Error("Malformed base64 data URI");
        json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
      } else {
        // block non-https to prevent SSRF against internal metadata endpoints
        if (!agentURI.startsWith("https://")) {
          throw new Error("Agent URI must use https");
        }
        json = await fetch(agentURI, { signal: AbortSignal.timeout(15_000) }).then(r => r.json());
      }

      agentEndpoint = json?.services?.find((s: { name: string }) => s.name === "web")?.endpoint;
      if (!agentEndpoint) throw new Error("No web service endpoint found in agent metadata");
    } catch (err: any) {
      console.error("[execute] Failed to resolve agent endpoint:", err?.message);
      return NextResponse.json({ error: "Could not resolve agent endpoint" }, { status: 502 });
    }

    // Derive the agent's API key from its on-chain owner + nonce so the agent
    // endpoint can authenticate the relayer without a shared static secret.
    const apiKey = deriveApiKey(BigInt(agentId), agent.owner, agent.nonce, API_KEY_SECRET);

    // security policy violation is 422 — 502 would imply a retryable network error
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev && !agentEndpoint.startsWith("https://")) {
      return NextResponse.json({ error: "Agent endpoint must use https" }, { status: 422 });
    }

    // Step 4 — Relayer locks payment on-chain (Escrow).
    let txHash: `0x${string}`;
    try {
      const relayerClient = getRelayerWalletClient();
      txHash = await relayerClient.writeContract({
        address: marketplaceRouter.address,
        abi: marketplaceRouter.abi,
        functionName: "lockPayment",
        chain: publicClient.chain,
        args: [
          clientAddress as `0x${string}`,
          BigInt(agentId),
          totalAmount,
          deadline,
          nonce,
          signature as `0x${string}`,
        ],
      });
      // a mined-but-reverted lock does not throw — guard against silently serving the agent unpaid
      const lockReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
      if (lockReceipt.status !== "success") {
        return NextResponse.json({ error: "Payment lock reverted", txHash }, { status: 502 });
      }
    } catch (err: any) {
      console.error("[execute] Payment lock failed:", err?.message);
      return NextResponse.json({ error: "Payment lock failed" }, { status: 500 });
    }

    // Step 5 — Forward prompt to the agent; funds are locked in escrow.
    let agentResponseData: unknown;
    let agentSucceeded = false;
    try {
      const agentResponse = await fetch(agentEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(userRequest),
        signal: AbortSignal.timeout(15_000),
      });

      if (!agentResponse.ok) {
        console.error("[execute] Agent returned non-200:", agentResponse.status);
      } else {
        agentResponseData = await agentResponse.json();
        agentSucceeded = true;
      }
    } catch (err: any) {
      console.error("[execute] Failed to reach agent:", err?.message);
    }

    // Step 6 — Finalize or Refund based on agent execution result.
    let txHashFinal: `0x${string}` | undefined;
    try {
      const relayerClient = getRelayerWalletClient();
      const functionName = agentSucceeded ? "finalizePayment" : "refundPayment";

      txHashFinal = await relayerClient.writeContract({
        address: marketplaceRouter.address,
        abi: marketplaceRouter.abi,
        functionName,
        chain: publicClient.chain,
        args: [nonce],
      });
      const finalReceipt = await publicClient.waitForTransactionReceipt({ hash: txHashFinal, timeout: 30_000 });
      if (finalReceipt.status !== "success") {
        return NextResponse.json(
          { error: `${agentSucceeded ? "Finalize" : "Refund"} reverted on-chain`, txHash: txHashFinal },
          { status: 502 },
        );
      }
    } catch (err: any) {
      console.error(`[execute] Finalization/Refund (${agentSucceeded ? "finalize" : "refund"}) failed:`, err?.message);
      // Even if finalization fails, we report the agent's outcome if it was successful,
      // but warn about trapped funds/refund.
    }

    if (agentSucceeded) {
      return NextResponse.json(agentResponseData, { status: 200 });
    } else {
      return NextResponse.json({ error: "Agent execution failed, payment refunded (if possible)" }, { status: 502 });
    }
  }

  // Resolve contract addresses for the active network
  const chainId = publicClient.chain.id;
  const contracts = (deployedContracts as any)[chainId];
  if (!contracts) return NextResponse.json({ error: "Contracts not deployed on this network" }, { status: 503 });
  const agentMarketplace = contracts.AgentMarketplace;
  const marketplaceRouter = contracts.MarketplaceRouter;

  // Query the AgentMarketplace for the agent data with error handling
  let agent: { price: bigint; active: boolean };
  try {
    agent = (await publicClient.readContract({
      address: agentMarketplace.address,
      abi: agentMarketplace.abi,
      functionName: "getAgent",
      args: [BigInt(agentId)],
    })) as { price: bigint; active: boolean };
  } catch (err: any) {
    // Expanded revert handling for AgentMarketplace calls
    const revertMsg = err?.data?.error?.errorMessage as string | undefined;
    if (revertMsg) {
      // Known revert signatures from the contract
      if (revertMsg.includes("AgentNotFoundInMarketplace")) {
        return NextResponse.json(
          { error: "Agent not found in marketplace (invalid or inactive agentId)" },
          { status: 400 },
        );
      }
      if (revertMsg.includes("AgentInactive")) {
        return NextResponse.json({ error: "Agent is inactive" }, { status: 400 });
      }
      if (revertMsg.includes("InvalidAgentId")) {
        return NextResponse.json({ error: "Invalid agent identifier supplied" }, { status: 400 });
      }
      if (revertMsg.includes("PriceNotSet")) {
        return NextResponse.json({ error: "Agent price not configured" }, { status: 500 });
      }
    }
    // Fallback for unexpected errors
    console.error("Unexpected error while fetching agent:", err);
    return NextResponse.json({ error: "Failed to fetch agent data from marketplace" }, { status: 500 });
  }

  // Validate agent activation flag
  if (!agent.active) {
    return NextResponse.json({ error: "Agent not active" }, { status: 400 });
  }

  let feeBps: bigint;
  try {
    feeBps = (await publicClient.readContract({
      address: marketplaceRouter.address,
      abi: marketplaceRouter.abi,
      functionName: "feeBps",
      args: [],
    })) as bigint;
  } catch (err: any) {
    console.error("[execute] Failed to read feeBps:", err?.message);
    return NextResponse.json({ error: "Failed to read platform fee" }, { status: 500 });
  }

  // Compute fee and total amount using high‑precision integer arithmetic
  const platformFee = (agent.price * feeBps) / 10000n; // feeBps expressed in bps (1 % = 100 bps)
  const totalAmount = agent.price + platformFee;

  // Build the 402 challenge payload — EIP-3009 typed data for the client to sign
  const extContracts = (externalContracts as any)[publicClient.chain.id];
  if (!extContracts) return NextResponse.json({ error: "Contracts not deployed on this network" }, { status: 503 });
  const { USDC } = extContracts;

  // Generate a random nonce (32‑byte hex) – in production this should come from the contract
  const nonce = "0x" + randomBytes(32).toString("hex");

  // Set a deadline 5 minutes from now (in seconds)
  const deadline = Math.floor(Date.now() / 1000) + 5 * 60;

  const challengePayload = {
    agentId,
    // Include the original user request that will be sent to the AI agent after payment
    request: userRequest,
    token: USDC.address, // USDC address on the active network
    amount: totalAmount.toString(), // raw USDC amount (6 decimals)
    fee: platformFee.toString(),
    spender: marketplaceRouter.address,
    nonce,
    deadline,
    chainId: publicClient.chain.id,
  };

  // Respond with HTTP 402 indicating payment required
  return NextResponse.json(challengePayload, { status: 402 });
}
