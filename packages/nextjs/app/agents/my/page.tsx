"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { zeroAddress } from "viem";
import { useAccount } from "wagmi";
import { AgentCard } from "~~/components/AgentCard";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const MyAgentsPage: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();

  const { data: agentDetails, isLoading } = useScaffoldReadContract({
    contractName: "AgentMarketplace",
    functionName: "getAgentsByOwner",
    args: [connectedAddress],
  }) as { data: any[] | undefined; isLoading: boolean };

  const validAgents = agentDetails?.filter(details => details.owner !== zeroAddress) ?? [];

  const shortAddress = connectedAddress ? `${connectedAddress.slice(0, 6)}…${connectedAddress.slice(-4)}` : null;

  return (
    <div className="w-full mx-auto max-w-7xl px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="mb-8 border border-slate-200 bg-white p-6 border-t-2 border-t-slate-900">
        <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase mb-1">
          My Agents // {shortAddress ?? "Not connected"}
        </p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-mono text-xl font-bold text-slate-900 uppercase tracking-tight">Agent Management</h1>
          {isConnected && !isLoading && (
            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0ea5a5]" />
              <span>{validAgents.length} owned</span>
            </div>
          )}
        </div>
      </div>

      {/* States */}
      {!isConnected ? (
        <div className="border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="font-mono text-xs text-slate-400 uppercase tracking-wider">
            [ Connect your wallet to view your agents ]
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg opacity-40" />
        </div>
      ) : validAgents.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {validAgents.map(details => (
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
        /* Empty state (from main #93) — restyled to the new system */
        <div className="border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="font-mono text-sm font-bold text-slate-700 uppercase tracking-tight mb-2">No agents found</p>
          <p className="text-xs text-slate-400 mb-6">You haven&apos;t registered any agents yet.</p>
          <Link
            href="/agents/add"
            className="inline-flex items-center gap-2 bg-[#0ea5a5] hover:bg-[#0d9494] text-white font-mono text-xs uppercase tracking-wider px-5 py-2.5 transition-colors"
          >
            Register your first agent ▸
          </Link>
        </div>
      )}
    </div>
  );
};

export default MyAgentsPage;
