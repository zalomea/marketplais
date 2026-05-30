import { NextRequest, NextResponse } from "next/server";
import { getTransactionReceipt } from "~~/services/web3/viemClient";

// Checks that the hash looks like a real Ethereum tx hash: starts with 0x followed by 64 hex characters.
const isValidTxHash = (hash: any): hash is `0x${string}` =>
  typeof hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(hash);

// POST /api/payment/verify
// Receives a txHash from the client and returns the on-chain receipt.
// Used to confirm that a payment transaction was submitted before allowing AI execution.
export async function POST(req: NextRequest) {
  let txHash: any;

  try {
    const body = await req.json();
    txHash = body?.txHash;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Reject the request if txHash is missing or has the wrong format.
  if (!txHash || !isValidTxHash(txHash)) {
    return NextResponse.json({ error: "Invalid or missing txHash" }, { status: 400 });
  }

  try {
    // Fetch the receipt from the blockchain using viem.
    const receipt = await getTransactionReceipt(txHash);

    if (!receipt) {
      return NextResponse.json({ error: "Transaction not found or still pending" }, { status: 404 });
    }

    // 200 OK — transaction found, return the key fields needed to validate the payment in the next step (#53).
    return NextResponse.json(
      {
        status: receipt.status,
        from: receipt.from,
        to: receipt.to,
        blockNumber: receipt.blockNumber.toString(),
      },
      { status: 200 },
    );
  } catch {
    // viem throws an error (e.g. TransactionReceiptNotFoundError) if the transaction doesn't exist or is still pending.
    return NextResponse.json({ error: "Transaction not found or still pending" }, { status: 404 });
  }
}
