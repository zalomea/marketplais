"use client";

import { useState } from "react";
import { AgentQuestionnaire } from "./AgentQuestionnaire";
import { ViewAgents } from "./ViewAgents";

export const SellAgentPage = () => {
  const [activeTab, setActiveTab] = useState<"sell" | "view">("sell");

  return (
    <div className="w-full bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Agent Marketplace</h1>
          <p className="text-slate-600">Manage your AI agents on the network</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("sell")}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === "sell" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sell Agent
          </button>
          <button
            onClick={() => setActiveTab("view")}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === "view" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            View Agents
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
