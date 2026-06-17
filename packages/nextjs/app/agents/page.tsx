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

  const totalCount = agentDetails?.length ?? 0;

  return (
    <div className="w-full mx-auto max-w-7xl px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="mb-8 border border-slate-200 bg-white p-6 border-t-2 border-t-slate-900">
        <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase mb-1">
          Marketplace // Agent_Registry
        </p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-mono text-xl font-bold text-slate-900 uppercase tracking-tight">Registered Agents</h1>
          {!isLoading && (
            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {totalCount} agent{totalCount !== 1 ? "s" : ""} active
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg opacity-40" />
        </div>
      ) : totalCount === 0 ? (
        <div className="border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="font-mono text-xs text-slate-400 uppercase tracking-wider">
            [ No agents registered in the marketplace ]
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
