"use client";

import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { AgentCard } from "~~/components/AgentCard";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const MyAgentsPage: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();

  const { data: agentDetails, isLoading } = useScaffoldReadContract({
    contractName: "AgentMarketplace",
    functionName: "getAgentsByOwner",
    args: [connectedAddress],
  });

  return (
    <div className="flex items-center flex-col pt-10">
      <h1 className="text-4xl font-bold mb-8">My Agents</h1>

      {!isConnected && <p>Please connect your wallet.</p>}

      {isLoading ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl px-4">
          {agentDetails?.map(details => (
            <AgentCard
              key={details.agent.agentId.toString()}
              agentId={details.agent.agentId}
              price={details.agent.price}
              owner={details.owner}
              uri={details.uri}
              active={details.agent.active}
              showActions={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyAgentsPage;
