import { NextRequest, NextResponse } from "next/server";
import { PaymentVerificationError, verifyPayment } from "~~/services/payment/verifyPayment";

// Checks that the hash looks like a real Ethereum tx hash: starts with 0x followed by 64 hex characters.
const isValidTxHash = (hash: any): hash is `0x${string}` =>
  typeof hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(hash);

// Checks that the value is a non-negative integer string or number, safe to pass to BigInt().
const isValidAmount = (value: any): boolean => {
  if (typeof value !== "string" && typeof value !== "number") return false;
  return /^\d+$/.test(String(value));
};

// POST /api/payment/verify
// Receives a txHash, agentId, and expectedAmount from the client.
// Validates that the on-chain payment was successful before allowing AI execution.
export async function POST(req: NextRequest) {
  let txHash: any;
  let agentId: any;
  let expectedAmount: any;

  try {
    const body = await req.json();
    txHash = body?.txHash;
    agentId = body?.agentId;
    expectedAmount = body?.expectedAmount;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Reject if txHash is missing or has the wrong format.
  if (!txHash || !isValidTxHash(txHash)) {
    return NextResponse.json({ error: "Invalid or missing txHash" }, { status: 400 });
  }

  // Reject if agentId or expectedAmount are missing or have the wrong format.
  if (agentId === undefined || agentId === null || expectedAmount === undefined || expectedAmount === null) {
    return NextResponse.json({ error: "Missing agentId or expectedAmount" }, { status: 400 });
  }

  if (!isValidAmount(agentId) || !isValidAmount(expectedAmount)) {
    return NextResponse.json({ error: "Invalid agentId or expectedAmount" }, { status: 400 });
  }

  try {
    const result = await verifyPayment(txHash, agentId, expectedAmount);
    return NextResponse.json({ valid: true, ...result }, { status: 200 });
  } catch (err) {
    if (err instanceof PaymentVerificationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
