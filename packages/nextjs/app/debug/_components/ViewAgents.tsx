"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

interface Agent {
  agentId: bigint;
  price: bigint;
  payToAgentWallet: boolean;
  active: boolean;
}

export const ViewAgents = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { data: agentsData, isLoading: agentsLoading } = useScaffoldReadContract({
    contractName: "AgentMarketplace",
    functionName: "getAgentsPaginated",
    args: [BigInt(page), BigInt(pageSize)],
    watch: true,
  });

  useEffect(() => {
    if (agentsData && Array.isArray(agentsData)) {
      setAgents(agentsData as Agent[]);
      setIsLoading(false);
    }
  }, [agentsData]);

  const handlePageChange = (newPage: number) => {
    setIsLoading(true);
    setPage(newPage);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Available Agents</h2>
        <p className="text-slate-600">Browse all registered agents on the marketplace</p>
      </div>

      {/* Filters */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Items per page:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(parseInt(e.target.value));
                setPage(1);
              }}
              className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <div className="flex-1" />
          <span className="text-sm text-slate-600">
            Page{" "}
            <input
              type="number"
              value={page}
              onChange={e => handlePageChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 px-2 py-1 border border-slate-300 rounded-lg text-sm ml-1"
              min="1"
            />
          </span>
        </div>
      </div>

      {/* Agents Grid */}
      {agentsLoading || isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-blue-600"></span>
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-600 mb-2">No agents found</p>
          <p className="text-sm text-slate-500">Be the first to register an agent on the marketplace!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <div
              key={agent.agentId.toString()}
              className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Agent #{Number(agent.agentId)}</h3>
                  <p className="text-sm text-slate-600 mt-1">ID: {agent.agentId.toString()}</p>
                </div>
                {agent.active ? (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                    Active
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-semibold rounded-full">
                    Inactive
                  </span>
                )}
              </div>

              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Price</p>
                  <p className="text-2xl font-bold text-slate-900">{formatUnits(agent.price, 6)} USDC</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Payment Method</p>
                  <p className="text-sm text-slate-900">
                    {agent.payToAgentWallet ? (
                      <span className="text-green-700 font-semibold">→ Direct Wallet</span>
                    ) : (
                      <span className="text-blue-700 font-semibold">→ Escrow Hold</span>
                    )}
                  </p>
                </div>
              </div>

              <button className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-sm">
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
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            ← Previous
          </button>
          <span className="px-4 py-2 text-slate-600 font-semibold">Page {page}</span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={agents.length < pageSize}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
