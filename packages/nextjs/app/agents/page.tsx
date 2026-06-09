"use client";

import type { NextPage } from "next";
import { AgentCard } from "~~/components/AgentCard";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const AgentsPage: NextPage = () => {
  const pageSize = 10;

  const { data: agentDetails, isLoading } = useScaffoldReadContract({
    contractName: "AgentMarketplace",
    functionName: "getAgentsFullPaginated",
    args: [BigInt(1), BigInt(pageSize)],
  });

  return (
    <div className="flex items-center flex-col pt-10">
      <h1 className="text-4xl font-bold mb-8">Registered Agents</h1>
      {isLoading ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agentDetails?.map(details => (
            <AgentCard
              key={details.agent.agentId.toString()}
              agentId={details.agent.agentId}
              price={details.agent.price}
              owner={details.owner}
              uri={details.uri}
              active={details.agent.active}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentsPage;
