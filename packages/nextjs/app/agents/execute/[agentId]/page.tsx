"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { NextPage } from "next";
import { formatUnits } from "viem";
import { useAccount, useSignTypedData } from "wagmi";
import AgentAvatar from "~~/components/AgentAvatar";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const AgentExecutePage: NextPage = () => {
  const { agentId } = useParams();
  const [parsedAgentId, setParsedAgentId] = useState<bigint | null>(null);

  useEffect(() => {
    if (agentId) setParsedAgentId(BigInt(agentId as string));
  }, [agentId]);

  const { data: agentDetails, isLoading: isLoadingDetails } = useScaffoldReadContract({
    contractName: "AgentMarketplace",
    functionName: "getAgentFullDetails",
    args: [parsedAgentId ?? undefined] as const,
  });

  // Read feeBps to show the payment breakdown to the user
  const { data: feeBps } = useScaffoldReadContract({
    contractName: "MarketplaceRouter",
    functionName: "feeBps",
  });

  // Fetch Event History for Agent Activity (PaymentFinalized)
  const { data: finalizedEvents } = useScaffoldEventHistory({
    contractName: "MarketplaceRouter",
    eventName: "PaymentFinalized",
    filters: { agentId: parsedAgentId || 0n },
    blockData: true,
  });

  const allEvents = [...(finalizedEvents || []).map(e => ({ ...e, type: "Finalized" }))]
    .sort((a, b) => Number(b.blockNumber - a.blockNumber))
    .slice(0, 5);

  const [metadata, setMetadata] = useState<{ name: string; description: string } | null>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!agentDetails?.uri) return;
      try {
        let jsonContent = "";
        const uri = agentDetails.uri;
        if (uri.startsWith("data:application/json;base64,")) {
          jsonContent = atob(uri.split(",")[1]);
        } else if (uri.startsWith("data:application/json,")) {
          jsonContent = decodeURIComponent(uri.split(",")[1]);
        } else if (uri.startsWith("http")) {
          const response = await fetch(uri);
          jsonContent = await response.text();
        } else {
          try {
            jsonContent = atob(uri);
          } catch {}
        }
        if (jsonContent) {
          const parsed = JSON.parse(jsonContent);
          setMetadata({ name: parsed.name, description: parsed.description });
        }
      } catch (err) {
        console.error("Failed to parse metadata", err);
      }
    };
    fetchMetadata();
  }, [agentDetails?.uri]);

  const { address: connectedAddress } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectedAddress) {
      setResponse("Please connect your wallet first.");
      return;
    }

    setIsLoading(true);
    setResponse("");

    try {
      // 1. Initial request (Phase 1)
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, request: { prompt } }),
      });

      if (res.status === 402) {
        const challenge = await res.json();

        // 2. Sign the challenge (Phase 2)
        const signature = await signTypedDataAsync({
          domain: {
            name: "USD Coin",
            version: "2",
            chainId: challenge.chainId,
            verifyingContract: challenge.token,
          },
          types: {
            ReceiveWithAuthorization: [
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "validAfter", type: "uint256" },
              { name: "validBefore", type: "uint256" },
              { name: "nonce", type: "bytes32" },
            ],
          },
          primaryType: "ReceiveWithAuthorization",
          message: {
            from: connectedAddress,
            to: challenge.spender,
            value: BigInt(challenge.amount),
            validAfter: 0n,
            validBefore: BigInt(challenge.deadline),
            nonce: challenge.nonce,
          },
        });

        // 3. Resubmit request with headers (Phase 3)
        const res2 = await fetch("/api/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-payment-signature": signature,
            "x-payment-nonce": challenge.nonce,
            "x-payment-deadline": challenge.deadline.toString(),
            "x-payment-from": connectedAddress,
          },
          body: JSON.stringify({ agentId, request: { prompt } }),
        });

        if (res2.ok) {
          const data = await res2.json();
          setResponse(JSON.stringify(data, null, 2));
        } else {
          const error = await res2.json();
          setResponse(`Execution error: ${error.error}`);
        }
      } else if (res.ok) {
        const data = await res.json();
        setResponse(JSON.stringify(data, null, 2));
      } else {
        const error = await res.json();
        setResponse(`Error: ${error.error}`);
      }
    } catch (err) {
      setResponse(`Execution failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const name = metadata?.name || `Agent #${agentId}`;

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8 py-10">
      {isLoadingDetails ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg opacity-40" />
        </div>
      ) : !agentDetails ? (
        /* Empty / Not found state */
        <div className="border border-slate-200 bg-slate-50 p-12 text-center border-t-2 border-t-slate-900">
          <p className="font-mono text-sm font-bold text-slate-700 uppercase tracking-tight mb-2">Agent not found</p>
          <p className="text-xs text-slate-400 mb-6">The agent you are looking for does not exist.</p>
          <Link
            href="/agents"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white font-mono text-xs uppercase tracking-wider px-5 py-2.5 transition-colors"
          >
            ← Back to Agents
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Technical page header */}
          <div className="border border-slate-200 bg-white border-t-2 border-t-slate-900">
            <div className="bg-slate-950 px-6 py-3">
              <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase">
                Console // EXECUTE_AGENT_{String(agentId).padStart(3, "0")}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 px-6 py-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <h1 className="font-mono text-xl font-bold text-slate-900 uppercase tracking-tight">{name}</h1>
                <p className="text-xs text-slate-500 leading-5 max-w-md">
                  {metadata?.description || "No description available"}
                </p>
              </div>
              <div className="shrink-0 flex items-center justify-center p-4 border border-slate-200 bg-white">
                <AgentAvatar agentId={BigInt(agentId as string)} size={72} />
              </div>
            </div>
            {/* Metadata parameters */}
            <div className="px-6 py-4 grid grid-cols-2 gap-4 font-mono text-[10px] text-slate-500">
              <div>
                <span className="uppercase tracking-wider block text-[9px] text-slate-400">Rate / Call</span>
                <span className="text-slate-800 font-semibold text-xs mt-0.5 block">
                  {agentDetails?.agent.price ? formatUnits(agentDetails.agent.price, 6) : "0"} USDC
                </span>
              </div>
              <div>
                <span className="uppercase tracking-wider block text-[9px] text-slate-400">Attestation</span>
                <span className="text-emerald-600 font-bold text-xs mt-0.5 block">EIP-3009 VERIFIED</span>
              </div>
            </div>
          </div>

          {/* Payment breakdown */}
          {agentDetails?.agent.price && (
            <div className="border border-slate-200 bg-slate-50/50 p-5 space-y-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Payment Breakdown</p>
              {(() => {
                const agentPrice = Number(formatUnits(agentDetails.agent.price, 6));
                const feePct = feeBps !== undefined ? Number(feeBps) / 100 : 10;
                const fee = (agentPrice * feePct) / 100;
                const total = agentPrice + fee;
                return (
                  <>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between text-slate-500">
                        <span>Agent price</span>
                        <span className="text-slate-800">{agentPrice.toFixed(6)} USDC</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Platform fee ({feePct.toFixed(0)}%)</span>
                        <span className="text-slate-800">{fee.toFixed(6)} USDC</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-1.5 text-slate-700 font-bold">
                        <span>Total</span>
                        <span>{total.toFixed(6)} USDC</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-4 font-mono">
                      If the agent fails, the agent price is refunded. The platform fee covers relayer gas costs and is
                      non-refundable.
                    </p>
                  </>
                );
              })()}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Prompt Payload</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Enter prompt parameters or payload instruction..."
                className="w-full font-mono text-sm text-slate-800 bg-white border border-slate-200 px-3 py-2.5 focus:outline-none focus:border-[#0ea5a5] transition-colors placeholder:text-slate-300 resize-none"
                rows={5}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !connectedAddress}
              className="w-full font-mono text-xs uppercase tracking-wider bg-[#0ea5a5] hover:bg-[#0d9494] text-white py-3 transition-colors disabled:opacity-40"
            >
              {isLoading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : !connectedAddress ? (
                "Connect Wallet to Execute"
              ) : (
                "Authorize & Execute ▸"
              )}
            </button>
          </form>

          {/* Response payload */}
          {response && (
            <div className="border border-slate-200">
              <div className="bg-slate-950 px-4 py-2 flex items-center justify-between">
                <span className="font-mono text-[9px] tracking-[0.2em] text-slate-400 uppercase">
                  Response // Payload_Output
                </span>
              </div>
              <pre className="font-mono text-[11px] text-slate-700 bg-slate-50 p-4 overflow-auto max-h-80 leading-relaxed border-t border-slate-100">
                {response}
              </pre>
            </div>
          )}

          {/* Recent Activity Log */}
          <div className="border border-slate-200">
            <div className="bg-slate-900 px-4 py-2 flex items-center justify-between">
              <span className="font-mono text-[9px] tracking-[0.2em] text-slate-400 uppercase">
                Activity // Execution_Log
              </span>
            </div>
            {allEvents.length > 0 ? (
              <table className="w-full text-left bg-white font-mono text-[10px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2 font-normal text-slate-400 uppercase tracking-wider">Event</th>
                    <th className="px-4 py-2 font-normal text-slate-400 uppercase tracking-wider text-right">Block</th>
                  </tr>
                </thead>
                <tbody>
                  {allEvents.map((event, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 font-semibold text-emerald-600">✓ {event.type}</td>
                      <td className="px-4 py-2 text-slate-500 text-right">{event.blockNumber.toString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider text-center py-6">
                No recent executions
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentExecutePage;
