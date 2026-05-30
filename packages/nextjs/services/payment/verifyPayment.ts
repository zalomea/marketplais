import { parseEventLogs } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import scaffoldConfig from "~~/scaffold.config";
import { getTransactionReceipt } from "~~/services/web3/viemClient";

// MarketplaceRouter address resolved dynamically from the active target network.
const chainId = scaffoldConfig.targetNetworks[0].id as keyof typeof deployedContracts;
const MARKETPLACE_ROUTER_ADDRESS = deployedContracts[chainId]?.MarketplaceRouter?.address?.toLowerCase();

if (!MARKETPLACE_ROUTER_ADDRESS) {
  throw new Error(`MarketplaceRouter not deployed on chain ${chainId}`);
}

// Minimal ABI for the PaymentRouted event, used to decode the logs from the receipt.
// event PaymentRouted(address indexed client, uint256 indexed agentId, uint256 amount)
const PAYMENT_ROUTED_ABI = [
  {
    type: "event",
    name: "PaymentRouted",
    inputs: [
      { name: "client", type: "address", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export type PaymentVerificationResult = {
  client: string;
  agentId: string;
  amount: string;
  blockNumber: string;
};

export class PaymentVerificationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PaymentVerificationError";
  }
}

// Validates that an on-chain payment is legitimate before allowing AI execution.
// Throws PaymentVerificationError with an HTTP status code if any check fails.
export async function verifyPayment(
  txHash: `0x${string}`,
  agentId: string | number,
  expectedAmount: string | number,
): Promise<PaymentVerificationResult> {
  let receipt;

  try {
    receipt = await getTransactionReceipt(txHash);
  } catch {
    // viem throws if the transaction doesn't exist or is still pending.
    throw new PaymentVerificationError("Transaction not found or still pending", 404);
  }

  if (!receipt) {
    throw new PaymentVerificationError("Transaction not found or still pending", 404);
  }

  // Reject if the transaction reverted.
  if (receipt.status !== "success") {
    throw new PaymentVerificationError("Transaction reverted", 402);
  }

  // Reject if the transaction was not sent to our MarketplaceRouter.
  if (receipt.to?.toLowerCase() !== MARKETPLACE_ROUTER_ADDRESS) {
    throw new PaymentVerificationError("Transaction recipient is not MarketplaceRouter", 402);
  }

  // Parse the PaymentRouted event from the receipt logs.
  // We strictly filter by the router's address to prevent malicious contracts from spoofing the event.
  const logs = parseEventLogs({
    abi: PAYMENT_ROUTED_ABI,
    logs: receipt.logs,
  }).filter(log => log.address.toLowerCase() === MARKETPLACE_ROUTER_ADDRESS);

  // Reject if no valid PaymentRouted event was emitted.
  if (logs.length === 0) {
    throw new PaymentVerificationError("No PaymentRouted event found in transaction", 402);
  }

  // Find the event that matches the expected agentId — handles batch transactions with multiple events.
  const event = logs.find(log => log.args.agentId.toString() === agentId.toString());

  if (!event) {
    throw new PaymentVerificationError("AgentId mismatch", 402);
  }

  // Reject if the amount paid is less than the expected amount.
  if (event.args.amount < BigInt(expectedAmount)) {
    throw new PaymentVerificationError("Insufficient payment amount", 402);
  }

  return {
    client: event.args.client,
    agentId: event.args.agentId.toString(),
    amount: event.args.amount.toString(),
    blockNumber: receipt.blockNumber.toString(),
  };
}
