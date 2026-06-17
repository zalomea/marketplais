"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

interface AgentData {
  agentId: bigint;
  price: bigint;
  payToAgentWallet: boolean;
  active: boolean;
}

interface AgentFullDetails {
  agent: AgentData;
  owner: string;
  uri: string;
}

export const ViewAgents = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [agents, setAgents] = useState<AgentFullDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { data: agentsData, isLoading: agentsLoading } = useScaffoldReadContract({
    contractName: "AgentMarketplace",
    functionName: "getAgentsFullPaginated",
    args: [BigInt(page), BigInt(pageSize)],
    watch: true,
  });

  useEffect(() => {
    if (agentsData && Array.isArray(agentsData)) {
      setAgents(agentsData as AgentFullDetails[]);
      setIsLoading(false);
    }
  }, [agentsData]);

  const handlePageChange = (newPage: number) => {
    setIsLoading(true);
    setPage(newPage);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-slate-50 border border-slate-200 rounded-none p-4">
        <div className="flex items-center gap-4 flex-wrap font-mono">
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Items per page:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(parseInt(e.target.value));
                setPage(1);
              }}
              className="px-3 py-1 border border-slate-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <div className="flex-1" />
          <span className="text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1">
            Page
            <input
              type="number"
              value={page}
              onChange={e => handlePageChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 px-2 py-1 border border-slate-300 rounded-none text-sm ml-1 bg-white"
              min="1"
            />
          </span>
        </div>
      </div>

      {/* Agents Grid */}
      {agentsLoading || isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-slate-900"></span>
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-none p-8 text-center">
          <p className="text-slate-600 mb-2">No agents found</p>
          <p className="text-sm text-slate-500">Be the first to register an agent on the marketplace!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(({ agent }) => (
            <div
              key={agent.agentId.toString()}
              className="bg-slate-50 border border-slate-200 border-t-2 border-t-slate-800 rounded-none p-5 shadow-sm hover:shadow transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                  <div>
                    <span className="font-mono text-[10px] tracking-wider text-slate-500 uppercase block mb-1">
                      SYS // RECORD_00{agent.agentId.toString()}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 font-mono">AGENT_#{agent.agentId.toString()}</h3>
                  </div>
                  {agent.active ? (
                    <span className="flex items-center gap-1.5 text-[10px] tracking-wider font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2.5 py-1">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      ACTIVE // ONLINE
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[10px] tracking-wider font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200/50 px-2.5 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                      INACTIVE // OFFLINE
                    </span>
                  )}
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 uppercase">PRICE</span>
                    <span className="font-bold text-slate-900">{formatUnits(agent.price, 6)} USDC</span>
                  </div>

                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 uppercase">ROUTING</span>
                    <span className="font-medium text-slate-900">
                      {agent.payToAgentWallet ? (
                        <span className="text-emerald-700">DIRECT_WALLET</span>
                      ) : (
                        <span className="text-blue-700">ESCROW_HOLD</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <button className="w-full mt-5 px-4 py-2 bg-slate-900 text-white rounded-none font-semibold hover:bg-slate-800 transition text-xs font-mono uppercase tracking-wider">
                View Details
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {agents.length > 0 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => handlePageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-slate-300 rounded-none text-slate-900 font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-slate-600 font-semibold">Page {page}</span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={agents.length < pageSize}
            className="px-4 py-2 border border-slate-300 rounded-none text-slate-900 font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
