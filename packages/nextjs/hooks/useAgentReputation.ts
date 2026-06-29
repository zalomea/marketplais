import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export type AgentFeedback = {
  client: string;
  score: number;
  tag1: string;
  tag2: string;
  isRevoked: boolean;
};

export type ReputationResult = {
  score: number | null;
  count: number;
  feedbacks: AgentFeedback[];
  isLoading: boolean;
};

/**
 * Reads platform execution feedbacks for an agent from ReputationRegistry.
 *
 * Only feedbacks with tag2="x402_payment" and tag1="execution_success"|"execution_failed"
 * are included — these are the ones automatically recorded by MarketplaceRouter
 * when a payment is finalized or refunded.
 *
 * Two chained reads:
 *   1. getClients(agentId) → list of addresses that submitted feedback
 *   2. readAllFeedback(agentId, clients, …) → flat arrays of feedback fields
 *
 * readAllFeedback reverts with "clientAddresses required" when passed an empty
 * array, so the second call is gated on `clients` being non-empty.
 */
export const useAgentReputation = (agentId: bigint): ReputationResult => {
  const { data: clients, isLoading: isLoadingClients } = useScaffoldReadContract({
    contractName: "ReputationRegistry",
    functionName: "getClients",
    args: [agentId],
  });

  const hasClients = !!(clients && clients.length > 0);

  const { data: allFeedback, isLoading: isLoadingFeedback } = useScaffoldReadContract({
    contractName: "ReputationRegistry",
    functionName: "readAllFeedback",
    args: [agentId, clients ?? [], "", "", false],
    query: {
      enabled: hasClients,
    },
  });

  const isLoading = isLoadingClients || (hasClients && isLoadingFeedback);

  if (!hasClients || !allFeedback) {
    return { score: null, count: 0, feedbacks: [], isLoading };
  }

  // readAllFeedback returns a tuple of parallel arrays:
  //   [0] clients (address[])
  //   [1] feedbackIndexes (uint64[])
  //   [2] values (int128[])
  //   [3] valueDecimals (uint8[])
  //   [4] tag1s (string[])
  //   [5] tag2s (string[])
  //   [6] revokedStatuses (bool[])
  const [fbClients, , fbValues, fbDecimals, fbTag1s, fbTag2s, fbRevoked] = allFeedback;

  const feedbacks: AgentFeedback[] = [];

  for (let i = 0; i < fbClients.length; i++) {
    const tag1 = fbTag1s[i];
    const tag2 = fbTag2s[i];

    if (tag2 !== "x402_payment") continue;
    if (tag1 !== "execution_success" && tag1 !== "execution_failed") continue;
    if (fbRevoked[i]) continue;

    feedbacks.push({
      client: fbClients[i],
      score: Number(fbValues[i]) / Math.pow(10, Number(fbDecimals[i])),
      tag1,
      tag2,
      isRevoked: fbRevoked[i],
    });
  }

  const count = feedbacks.length;
  const successCount = feedbacks.filter(f => f.tag1 === "execution_success").length;
  const score = count > 0 ? successCount / count : null;

  return { score, count, feedbacks, isLoading: false };
};
