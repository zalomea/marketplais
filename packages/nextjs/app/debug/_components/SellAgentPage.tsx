"use client";

import { useState } from "react";
import { AgentQuestionnaire } from "./AgentQuestionnaire";
import { ViewAgents } from "./ViewAgents";

export const SellAgentPage = () => {
  const [activeTab, setActiveTab] = useState<"sell" | "view">("sell");

  return (
    <div className="w-full bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8 border-b border-slate-200 pb-6">
          <div className="inline-flex border border-slate-300 bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-600 mb-3">
            Publisher Zone
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Agent Publisher</h1>
          <p className="text-slate-600">Register and manage your AI agents on the network</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-6 mb-8 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("sell")}
            className={`px-2 py-3 font-mono text-sm uppercase tracking-wider transition ${
              activeTab === "sell"
                ? "border-b-2 border-slate-900 text-slate-900 font-bold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Register Agent
          </button>
          <button
            onClick={() => setActiveTab("view")}
            className={`px-2 py-3 font-mono text-sm uppercase tracking-wider transition ${
              activeTab === "view"
                ? "border-b-2 border-slate-900 text-slate-900 font-bold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            My Agents
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white">
          {activeTab === "sell" && <AgentQuestionnaire />}
          {activeTab === "view" && <ViewAgents />}
        </div>
      </div>
    </div>
  );
};
