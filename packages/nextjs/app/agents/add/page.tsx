"use client";

import React, { useState } from "react";

export default function AddAgentPage() {
  const [activeTab, setActiveTab] = useState<"new" | "existing">("new");

  // Tab 1: New Agent with agentURI
  const [price, setPrice] = useState("");
  const [agentURI, setAgentURI] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Tab 2: Existing Agent with agentID
  const [agentID, setAgentID] = useState("");
  const [priceExisting, setPriceExisting] = useState("");
  const [messageExisting, setMessageExisting] = useState("");
  const [submittedExisting, setSubmittedExisting] = useState(false);

  const onSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!price || Number(price) <= 0) {
      setMessage("Please enter a valid price");
      return;
    }
    if (!agentURI.trim()) {
      setMessage("Please enter an agentURI");
      return;
    }
    setMessage("");
    setSubmitted(true);
    // Frontend-only for now: log the values
    // Backend integration can be added later if desired

    console.log({ price, agentURI });
  };

  const onSubmitExisting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceExisting || Number(priceExisting) <= 0) {
      setMessageExisting("Please enter a valid price");
      return;
    }
    if (!agentID.trim()) {
      setMessageExisting("Please enter an agentID");
      return;
    }
    setMessageExisting("");
    setSubmittedExisting(true);
    // Frontend-only for now: log the values
    // Backend integration can be added later if desired

    console.log({ agentID, priceExisting });
  };

  return (
    <div className="container mx-auto p-4">
      <div className="card bg-base-100 shadow-md max-w-2xl mx-auto">
        <div className="card-body">
          <h1 className="card-title">🚀 Monetize Your AI Agent in 60 Seconds</h1>
          <p className="mb-4">
            Turn your LLM backend into a revenue stream on Base. No smart contract coding required. We handle the Web3
            heavy lifting while you focus on building the best prompt logic.
          </p>

          <ul className="list-disc pl-5 space-y-2 mb-6">
            <li>
              <strong>Set your rate:</strong> Define a fixed price in USDC per API call.
            </li>
            <li>
              <strong>Link your identity:</strong> Provide an existing ERC-8004 Agent ID or submit a new agentURI (IPFS
              or base64 JSON).
            </li>
            <li>
              <strong>Get your MarketplAIs API Key:</strong> Get your MarketplAIs API Key instantly and start earning.
            </li>
          </ul>

          {/* Tabs */}
          <div className="tabs tabs-bordered mb-4">
            <button
              className={`tab ${activeTab === "new" ? "tab-active" : ""}`}
              onClick={() => {
                setActiveTab("new");
                setMessageExisting("");
                setSubmittedExisting(false);
              }}
            >
              Create New Agent
            </button>
            <button
              className={`tab ${activeTab === "existing" ? "tab-active" : ""}`}
              onClick={() => {
                setActiveTab("existing");
                setMessage("");
                setSubmitted(false);
              }}
            >
              Register Existing Agent
            </button>
          </div>

          {/* Tab 1: Create New Agent */}
          {activeTab === "new" && (
            <form onSubmit={onSubmitNew} className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">Price (USDC per call)</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="e.g. 1.00"
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">agentURI</span>
                </label>
                <textarea
                  value={agentURI}
                  onChange={e => setAgentURI(e.target.value)}
                  className="textarea textarea-bordered w-full"
                  rows={4}
                  placeholder="https://... or data:application/json;base64,..."
                />
              </div>

              {message && <div className="text-error">{message}</div>}

              {submitted && (
                <div className="text-success">Entry ready (frontend-only): {JSON.stringify({ price, agentURI })}</div>
              )}

              <div className="card-actions justify-end">
                <button type="submit" className="btn btn-primary">
                  Submit
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Register Existing Agent */}
          {activeTab === "existing" && (
            <form onSubmit={onSubmitExisting} className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">Price (USDC per call)</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={priceExisting}
                  onChange={e => setPriceExisting(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="e.g. 1.00"
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">agentID (from IdentityRegistry)</span>
                </label>
                <input
                  type="text"
                  value={agentID}
                  onChange={e => setAgentID(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="e.g. 0x1234567890abcdef..."
                />
              </div>

              {messageExisting && <div className="text-error">{messageExisting}</div>}

              {submittedExisting && (
                <div className="text-success">
                  Entry ready (frontend-only): {JSON.stringify({ agentID, priceExisting })}
                </div>
              )}

              <div className="card-actions justify-end">
                <button type="submit" className="btn btn-primary">
                  Submit
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
