"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const AgentQuestionnaire = () => {
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);
  const [agentURI, setAgentURI] = useState("");
  const [price, setPrice] = useState("");
  const [payToAgentWallet, setPayToAgentWallet] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { writeContractAsync: registerAgent } = useScaffoldWriteContract({
    contractName: "AgentMarketplace",
  });

  const handleNext = () => {
    if (phase === 1 && agentURI.trim()) {
      setPhase(2);
    } else if (phase === 2 && price.trim() && !isNaN(parseFloat(price))) {
      setPhase(3);
    } else if (phase === 3) {
      setPhase(4);
    }
  };

  const handlePrev = () => {
    if (phase > 1) {
      setPhase((phase - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const priceInWei = parseUnits(price, 6); // USDC has 6 decimals
      await registerAgent({
        functionName: "register",
        args: [priceInWei, agentURI, payToAgentWallet],
      });
      // Reset form on success
      setAgentURI("");
      setPrice("");
      setPayToAgentWallet(true);
      setPhase(1);
    } catch (error) {
      console.error("Error registering agent:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const progressPercentage = (phase / 4) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Step {phase} of 4</span>
          <span className="text-sm text-slate-500">{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Phase 1: Agent URI */}
      {phase === 1 && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Agent Information</h2>
            <p className="text-slate-600">First, tell us about your agent</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4">
            <label className="block">
              <span className="block text-sm font-semibold text-slate-900 mb-2">Agent URI *</span>
              <p className="text-xs text-slate-600 mb-3">
                A URL pointing to your agents metadata (must be valid JSON with name, description, and capabilities)
              </p>
              <input
                type="url"
                placeholder="https://example.com/agent-metadata.json"
                value={agentURI}
                onChange={e => setAgentURI(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </label>
          </div>
        </div>
      )}

      {/* Phase 2: Price */}
      {phase === 2 && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Set Your Price</h2>
            <p className="text-slate-600">How much should users pay to access your agent?</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4">
            <label className="block">
              <span className="block text-sm font-semibold text-slate-900 mb-2">Price in USDC *</span>
              <p className="text-xs text-slate-600 mb-3">Enter the cost for accessing your agent</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="0.00"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  step="0.01"
                  min="0"
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold flex items-center">
                  USDC
                </span>
              </div>
            </label>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
              <p>💡 Set a competitive price based on your agents capabilities and market demand.</p>
            </div>
          </div>
        </div>
      )}

      {/* Phase 3: Payment Method */}
      {phase === 3 && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Settings</h2>
            <p className="text-slate-600">Where should payments go?</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border border-slate-300 rounded-lg cursor-pointer hover:bg-white transition">
                <input
                  type="radio"
                  name="payment"
                  checked={payToAgentWallet}
                  onChange={() => setPayToAgentWallet(true)}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-slate-900">Direct to Agent Wallet</p>
                  <p className="text-sm text-slate-600">Payments go directly to your wallet immediately</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border border-slate-300 rounded-lg cursor-pointer hover:bg-white transition">
                <input
                  type="radio"
                  name="payment"
                  checked={!payToAgentWallet}
                  onChange={() => setPayToAgentWallet(false)}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-slate-900">Marketplace Escrow</p>
                  <p className="text-sm text-slate-600">Payments held in escrow until you withdraw</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: Review */}
      {phase === 4 && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Review Your Agent</h2>
            <p className="text-slate-600">Confirm the details before registering</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-sm font-semibold text-slate-600 mb-1">Agent URI</p>
                <p className="text-slate-900 break-all">{agentURI}</p>
              </div>
              <div className="border-b border-slate-200 pb-4">
                <p className="text-sm font-semibold text-slate-600 mb-1">Price</p>
                <p className="text-slate-900 text-lg font-bold">{price} USDC</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-1">Payment Method</p>
                <p className="text-slate-900">{payToAgentWallet ? "Direct to Agent Wallet" : "Marketplace Escrow"}</p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900">
              <p className="font-semibold mb-1">✓ Ready to register</p>
              <p>Click -Register- Agent to complete the process and list your agent on the marketplace.</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={handlePrev}
          disabled={phase === 1}
          className="px-6 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          ← Previous
        </button>
        <div className="flex-1" />
        {phase < 4 ? (
          <button
            onClick={handleNext}
            disabled={
              (phase === 1 && !agentURI.trim()) ||
              (phase === 2 && (!price.trim() || isNaN(parseFloat(price)))) ||
              isLoading
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-8 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? "Registering..." : "Register Agent"}
          </button>
        )}
      </div>
    </div>
  );
};
