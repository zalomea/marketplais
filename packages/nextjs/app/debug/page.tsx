import { DebugContracts } from "./_components/DebugContracts";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Debug Contracts",
  description: "Debug your deployed Scaffold-ETH 2 contracts",
});

const Debug: NextPage = () => {
  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="mb-8 border border-slate-200 bg-white border-t-2 border-t-slate-900">
        <div className="bg-slate-950 px-6 py-3">
          <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase">Debug // Contract_Inspector</p>
        </div>
        <div className="px-6 py-5">
          <h1 className="font-mono text-xl font-bold text-slate-900 uppercase tracking-tight">Debug Contracts</h1>
          <p className="text-sm text-slate-500 mt-1 leading-6">
            Inspect and interact with deployed contracts directly from the browser.
          </p>
        </div>
      </div>

      <DebugContracts />
    </div>
  );
};

export default Debug;
