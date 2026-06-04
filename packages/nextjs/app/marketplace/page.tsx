import type { NextPage } from "next";
import { ViewAgents } from "~~/app/debug/_components/ViewAgents";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const dynamic = "force-dynamic";

export const metadata = getMetadata({
  title: "Agent Marketplace",
  description: "Browse and discover AI agents on the network",
});

const Marketplace: NextPage = () => {
  return (
    <div className="w-full bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8 border-b border-slate-200 pb-6">
          <div className="inline-flex border border-slate-300 bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-600 mb-3">
            Buyer Zone
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Agent Marketplace</h1>
          <p className="text-slate-600">Discover and licensing AI agents on the network</p>
        </div>

        {/* Dynamic Agents list */}
        <ViewAgents />
      </div>
    </div>
  );
};

export default Marketplace;
