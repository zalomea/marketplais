import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import deployedContracts from "~~/contracts/deployedContracts";
import externalContracts from "~~/contracts/externalContracts";
import { publicClient } from "~~/services/web3/viemClient";

// Expected request payload (application/json):
// {
//   "agentId": 1, // number or string identifier of the AI agent to execute
//   "request": {
//     "prompt": "What is the weather today?", // user query or instruction
//     "metadata": { "lang": "en" } // optional additional data sent to the agent
//   }
// }
// The `request` object follows the `AgentUserRequest` interface defined below.

/**
 * x402 Interceptor endpoint.
 *
 * POST body must contain `{ agentId: number | string, request: AgentUserRequest }`.
 * `request` holds the user’s original query (prompt and optional metadata) that will be forwarded to the AI agent after payment.
 * If the required payment headers are present, the request is accepted (200).
 * Otherwise, the route queries the AgentMarketplace for the agent price,
 * reads the platform fee (bps) from the MarketplaceRouter, calculates the total
 * amount (price + fee) using BigInt to preserve USDC precision (6 decimals),
 * and returns a 402 Payment Required response with a cryptographic challenge.
 */

// Structured type for the user request forwarded to the AI agent
interface AgentUserRequest {
  /** The actual user prompt or instruction sent to the AI agent. */
  prompt: string;
  /** Optional free‑form metadata that can be used by the agent implementation. */
  metadata?: Record<string, any>;
}
export async function POST(request: Request) {
  // Parse agent identifier and user request from request body
  const { agentId, request: userRequest } = (await request.json()) as {
    agentId: number | string;
    request: AgentUserRequest;
  };

  // Check for payment headers – early return if they exist (verification handled later)
  const signature = request.headers.get("x-payment-signature");
  const headerNonce = request.headers.get("x-payment-nonce");
  const headerDeadline = request.headers.get("x-payment-deadline");
  if (signature && headerNonce && headerDeadline) {
    console.log("Payment headers found");
    console.log("Signature:", signature);
    console.log("Nonce:", headerNonce);
    console.log("Deadline:", headerDeadline);

    // Verify payment
    // 1. Recover the signer using the signature (v, r, s) and the EIP‑712 typed data.

    // 2. Verify that the deadline has not expired (the nonce in the header should match the one you generated in step 2).

    // 3. Verify that the token and amount match what the agent contract requires.

    // 4. Verify that the spender is the agent contract itself.

    // 5. (Optional) If the user has already approved the USDC spend, verify that approval using the ERC‑20 approve(spender, value) function.

    // If all verifications pass, the payment is considered valid.

    // Forward the request to the AI agent (HTTP POST to `/agents/{agentId}/execute`)

    // Make the transfer of funds to the contract

    // Execute payment on marketplace router contract

    // Return success response

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Resolve contract addresses for the active network
  const chainId = publicClient.chain.id;
  const contracts = (deployedContracts as any)[chainId];
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

  // Retrieve the platform fee (basis points) from MarketplaceRouter
  const feeBps = (await publicClient.readContract({
    address: marketplaceRouter.address,
    abi: marketplaceRouter.abi,
    functionName: "feeBps",
    args: [],
  })) as bigint;

  // Compute fee and total amount using high‑precision integer arithmetic
  const platformFee = (agent.price * feeBps) / 10000n; // feeBps expressed in bps (1 % = 100 bps)
  const totalAmount = agent.price + platformFee;

  // Build the 402 challenge payload – EIP‑3009 styled data for signTypedData
  // Retrieve USDC contract address from external contracts configuration
  const { USDC } = externalContracts[publicClient.chain.id] || {};

  // Generate a random nonce (32‑byte hex) – in production this should come from the contract
  const nonce = "0x" + randomBytes(32).toString("hex");

  // Set a deadline 5 minutes from now (in seconds)
  const deadline = Math.floor(Date.now() / 1000) + 5 * 60;

  const challengePayload = {
    agentId,
    // Include the original user request that will be sent to the AI agent after payment
    request: userRequest,
    token: USDC?.address || "0x", // USDC address on the active network
    amount: totalAmount.toString(), // raw USDC amount (6 decimals)
    fee: platformFee.toString(),
    spender: marketplaceRouter.address,
    nonce,
    deadline,
    chainId: publicClient.chain.id,
  };

  // Respond with HTTP 402 indicating payment required
  return NextResponse.json(challengePayload, { status: 402 });
}
