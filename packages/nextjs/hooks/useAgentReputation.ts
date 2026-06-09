import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export type AgentFeedback = {
  client: string;
  score: number;
  tag1: string;
  tag2: string;
  isRevoked: boolean;
};

export type ReputationResult = {
  score: number | null; // null when no feedback exists yet
  count: number; // total number of feedback entries
  feedbacks: AgentFeedback[]; // individual feedback entries
  isLoading: boolean;
};

/**
 * Reads an agent's aggregated reputation from the ReputationRegistry.
 * Requires two chained calls: first fetch the list of clients who gave feedback,
 * then use that list to compute the summary score and individual feedbacks.
 */
export const useAgentReputation = (agentId: bigint): ReputationResult => {
  // Step 1: fetch all addresses that submitted feedback for this agent
  const { data: clients, isLoading: isLoadingClients } = useScaffoldReadContract({
    contractName: "ReputationRegistry",
    functionName: "getClients",
    args: [agentId],
  });

  // Step 2: compute the aggregated score — only runs once clients is resolved
  const { data: summary, isLoading: isLoadingSummary } = useScaffoldReadContract({
    contractName: "ReputationRegistry",
    functionName: "getSummary",
    args: [agentId, clients ?? [], "", ""],
    query: {
      enabled: clients !== undefined,
    },
  });

  // Step 3: fetch all individual feedbacks for the detail view
  const { data: allFeedback, isLoading: isLoadingFeedback } = useScaffoldReadContract({
    contractName: "ReputationRegistry",
    functionName: "readAllFeedback",
    args: [agentId, clients ?? [], "", "", false],
    query: {
      enabled: clients !== undefined,
    },
  });

  const isLoading = isLoadingClients || isLoadingSummary || isLoadingFeedback;

  // Guard: data not yet resolved
  if (!summary) {
    return { score: null, count: 0, feedbacks: [], isLoading };
  }

  // getSummary returns a tuple: [count, summaryValue, summaryValueDecimals]
  const [summaryCount, summaryValue, summaryValueDecimals] = summary;

  // No feedback recorded yet
  if (summaryCount === 0n) {
    return { score: null, count: 0, feedbacks: [], isLoading };
  }

  // summaryValue is a fixed-point int128; divide by 10^decimals to get the human-readable score
  const score = Number(summaryValue) / Math.pow(10, Number(summaryValueDecimals));

  // readAllFeedback returns a tuple: [clients, feedbackIndexes, values, valueDecimals, tag1s, tag2s, revokedStatuses]
  const feedbacks: AgentFeedback[] = allFeedback
    ? allFeedback[0]
        .map((client, i) => ({
          client,
          score: Number(allFeedback[2][i]) / Math.pow(10, Number(allFeedback[3][i])),
          tag1: allFeedback[4][i],
          tag2: allFeedback[5][i],
          isRevoked: allFeedback[6][i],
        }))
        .filter(f => !f.isRevoked)
    : [];

  return {
    score,
    count: Number(summaryCount),
    feedbacks,
    isLoading: false,
  };
};
