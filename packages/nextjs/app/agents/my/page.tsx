"use client";

import Link from "next/link";
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
      ) : agentDetails && agentDetails.length > 0 ? (
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
      ) : (
        <div className="text-center mt-10">
          <h2 className="text-2xl font-semibold mb-4">No agents found</h2>
          <p className="mb-6 opacity-70">You haven&apos;t registered any agents yet.</p>
          <Link href="/agents/add" className="btn btn-primary">
            Register your first agent
          </Link>
        </div>
      )}
    </div>
  );
};

export default MyAgentsPage;
