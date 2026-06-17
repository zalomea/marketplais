"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const USDC_DECIMALS = 6;

const MyAgentsPage: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "AgentMarketplace" });
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const {
    data: agentDetails,
    isLoading,
    refetch,
  } = useScaffoldReadContract({
    contractName: "AgentMarketplace",
    functionName: "getAgentsByOwner",
    args: [connectedAddress],
  });

  useEffect(() => {
    if (!agentDetails) return;

    setPriceInputs(currentInputs => {
      const nextInputs = { ...currentInputs };
      for (const details of agentDetails) {
        const agentId = details.agent.agentId.toString();
        if (nextInputs[agentId] === undefined) {
          nextInputs[agentId] = formatUnits(details.agent.price, USDC_DECIMALS);
        }
      }
      return nextInputs;
    });
  }, [agentDetails]);

  const updatePrice = async (agentId: bigint) => {
    const actionKey = `price-${agentId.toString()}`;
    const nextPrice = priceInputs[agentId.toString()];

    if (!nextPrice || Number(nextPrice) <= 0) {
      notification.error("Please enter a valid price");
      return;
    }

    setPendingAction(actionKey);
    try {
      await writeContractAsync({
        functionName: "updatePrice",
        args: [agentId, parseUnits(nextPrice, USDC_DECIMALS)],
      });
      notification.success("Agent price updated");
      await refetch();
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  const toggleStatus = async (agentId: bigint, active: boolean) => {
    const actionKey = `status-${agentId.toString()}`;

    setPendingAction(actionKey);
    try {
      await writeContractAsync({
        functionName: active ? "deactivateAgent" : "reactivateAgent",
        args: [agentId],
      });
      notification.success(active ? "Agent deactivated" : "Agent reactivated");
      await refetch();
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="flex items-center flex-col pt-10 px-4">
      <h1 className="text-4xl font-bold mb-8">My Agents</h1>

      {!isConnected ? (
        <div className="card bg-base-100 shadow-xl w-full max-w-xl">
          <div className="card-body items-center text-center">
            <h2 className="card-title">Connect your wallet</h2>
            <p className="opacity-70">Your registered agents will appear here.</p>
          </div>
        </div>
      ) : isLoading ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : !agentDetails?.length ? (
        <div className="card bg-base-100 shadow-xl w-full max-w-xl">
          <div className="card-body items-center text-center">
            <h2 className="card-title">No agents registered</h2>
            <p className="opacity-70">Agents owned by your connected wallet will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agentDetails.map(details => {
            const agentId = details.agent.agentId.toString();
            const isPricePending = pendingAction === `price-${agentId}`;
            const isStatusPending = pendingAction === `status-${agentId}`;

            return (
              <div key={agentId} className="card w-96 bg-base-100 shadow-xl">
                <div className="card-body">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="card-title">Agent #{agentId}</h2>
                    <div className={`badge ${details.agent.active ? "badge-success" : "badge-error"}`}>
                      {details.agent.active ? "Active" : "Inactive"}
                    </div>
                  </div>

                  <p className="text-sm opacity-70">Current price: {formatUnits(details.agent.price, USDC_DECIMALS)}</p>
                  <p className="text-sm opacity-70 break-all">URI: {details.uri || "No URI"}</p>

                  <div>
                    <label className="label">
                      <span className="label-text">Price (USDC per call)</span>
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      min="0"
                      value={priceInputs[agentId] ?? ""}
                      onChange={e =>
                        setPriceInputs(currentInputs => ({
                          ...currentInputs,
                          [agentId]: e.target.value,
                        }))
                      }
                      className="input input-bordered w-full"
                      placeholder="e.g. 1.00"
                    />
                  </div>

                  <div className="card-actions justify-end">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={pendingAction !== null}
                      onClick={() => updatePrice(details.agent.agentId)}
                    >
                      {isPricePending ? <span className="loading loading-spinner loading-sm"></span> : "Update Price"}
                    </button>
                    <button
                      type="button"
                      className={details.agent.active ? "btn btn-warning" : "btn btn-primary"}
                      disabled={pendingAction !== null}
                      onClick={() => toggleStatus(details.agent.agentId, details.agent.active)}
                    >
                      {isStatusPending ? (
                        <span className="loading loading-spinner loading-sm"></span>
                      ) : details.agent.active ? (
                        "Deactivate"
                      ) : (
                        "Reactivate"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyAgentsPage;
