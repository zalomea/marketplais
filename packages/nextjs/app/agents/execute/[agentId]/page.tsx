"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { NextPage } from "next";
import { formatUnits } from "viem";
import { useAccount, useSignTypedData } from "wagmi";
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

  // Fetch Event History for Agent Activity
  const { data: finalizedEvents } = useScaffoldEventHistory({
    contractName: "MarketplaceRouter",
    eventName: "PaymentFinalized",
    filters: { agentId: parsedAgentId || 0n },
    blockData: true,
  });

  // Filter and merge events
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
            TransferWithAuthorization: [
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "validAfter", type: "uint256" },
              { name: "validBefore", type: "uint256" },
              { name: "nonce", type: "bytes32" },
            ],
          },
          primaryType: "TransferWithAuthorization",
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

  return (
    <div className="flex items-center flex-col pt-10">
      {isLoadingDetails ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : !agentDetails ? (
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Agent not found</h1>
          <p className="mb-8">The agent you are looking for does not exist.</p>
          <Link href="/agents" className="btn btn-primary">
            Back to Agents
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-4xl font-bold mb-2">{metadata?.name || `Agent #${agentId}`}</h1>
          <p className="mb-8 opacity-70 max-w-lg text-center">{metadata?.description || "No description available"}</p>
          <p className="mb-8 font-mono text-sm">
            Price: {agentDetails?.agent.price ? formatUnits(agentDetails.agent.price, 6) : "0"} USDC
          </p>
        </>
      )}

      {!isLoadingDetails && agentDetails && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-lg">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="textarea textarea-bordered h-32"
            required
          />
          <button type="submit" className="btn btn-primary" disabled={isLoading || !connectedAddress}>
            {isLoading ? "Executing..." : !connectedAddress ? "Connect Wallet" : "Execute"}
          </button>
        </form>
      )}

      {response && (
        <div className="mt-8 p-4 bg-base-200 rounded w-full max-w-lg whitespace-pre-wrap">
          <h2 className="font-bold">Response:</h2>
          {response}
        </div>
      )}

      {/* Recent Activity Section */}
      <div className="mt-8 p-4 bg-base-100 shadow rounded w-full max-w-lg">
        <h3 className="font-bold mb-4">Recent Agent Activity</h3>
        {allEvents.length > 0 ? (
          <table className="table table-xs">
            <thead>
              <tr>
                <th>Type</th>
                <th>Block</th>
              </tr>
            </thead>
            <tbody>
              {allEvents.map((event, i) => (
                <tr key={i}>
                  <td>{event.type}</td>
                  <td>{event.blockNumber.toString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm opacity-50 text-center py-4">No recent activity.</p>
        )}
      </div>
    </div>
  );
};

export default AgentExecutePage;
