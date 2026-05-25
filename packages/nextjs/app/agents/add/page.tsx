"use client";

import React, { useState } from "react";

export default function AddAgentPage() {
  const [price, setPrice] = useState("");
  const [agentURI, setAgentURI] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
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

  return (
    <div className="container mx-auto p-4">
      <div className="card bg-base-100 shadow-md max-w-2xl mx-auto">
        <div className="card-body">
          <h1 className="card-title">🚀 Monetize Your AI Agent in 60 Seconds</h1>
          <p className="mb-4">
            Turn your LLM backend into a revenue stream on Base. No smart contract coding required. We handle the Web3
            heavy lifting while you focus on building the best prompt logic.
          </p>

          <ul className="list-disc pl-5 space-y-2 mb-4">
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

          <form onSubmit={onSubmit} className="space-y-4">
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
        </div>
      </div>
    </div>
  );
}
