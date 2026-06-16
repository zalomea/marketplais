import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatUnits, parseUnits } from "viem";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useAgentReputation } from "~~/hooks/useAgentReputation";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

interface AgentCardProps {
  agentId: bigint;
  price: bigint;
  owner: string;
  uri: string;
  active: boolean;
  showActions?: boolean;
}

interface AgentMetadata {
  name: string;
  description: string;
  image: string;
}

const StarRating = ({ score }: { score: number }) => {
  const stars = Math.round(score);
  return <span className="text-warning">{Array.from({ length: 5 }, (_, i) => (i < stars ? "★" : "☆")).join("")}</span>;
};

export const AgentCard = ({ agentId, price, owner, uri, active, showActions = false }: AgentCardProps) => {
  const { score, count, feedbacks, isLoading: isLoadingReputation } = useAgentReputation(agentId);
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [metadataError, setMetadataError] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const { data: balance, refetch: refetchBalance } = useScaffoldReadContract({
    contractName: "MarketplaceRouter",
    functionName: "agentBalances",
    args: [agentId],
  });

  const { writeContractAsync: marketplaceRouter } = useScaffoldWriteContract({ contractName: "MarketplaceRouter" });
  const { writeContractAsync: agentMarketplace } = useScaffoldWriteContract({ contractName: "AgentMarketplace" });

  const handleWithdraw = async () => {
    setPendingAction(`withdraw-${agentId}`);
    try {
      await marketplaceRouter({
        functionName: "withdrawAgentEarnings",
        args: [agentId],
      });
      notification.success("Earnings withdrawn");
      await refetchBalance();
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  const updatePrice = async () => {
    if (!priceInput || Number(priceInput) <= 0) {
      notification.error("Please enter a valid price");
      return;
    }
    setPendingAction(`price-${agentId}`);
    try {
      await agentMarketplace({
        functionName: "updatePrice",
        args: [agentId, parseUnits(priceInput, 6)],
      });
      notification.success("Agent price updated");
      (document.getElementById(manageModalId) as HTMLDialogElement)?.close();
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  const toggleStatus = async () => {
    setPendingAction(`status-${agentId}`);
    try {
      await agentMarketplace({
        functionName: active ? "deactivateAgent" : "reactivateAgent",
        args: [agentId],
      });
      notification.success("Agent status updated");
      (document.getElementById(manageModalId) as HTMLDialogElement)?.close();
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  const reviewsModalId = `reviews-modal-${agentId.toString()}`;
  const manageModalId = `manage-modal-${agentId.toString()}`;

  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoading(true);
      setMetadataError(false);
      try {
        let jsonContent: string = "";

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
          } catch {
            console.error("Unknown URI format");
            setMetadataError(true);
          }
        }

        if (jsonContent) {
          try {
            setMetadata(JSON.parse(jsonContent));
          } catch {
            console.warn("CRITICAL: Failed to parse JSON metadata for AgentId", agentId.toString());
            setMetadataError(true);
          }
        } else if (uri !== "") {
          console.warn("Empty JSON content for AgentId", agentId.toString());
          setMetadataError(true);
        }
      } catch (error) {
        console.error("Error fetching or parsing metadata:", error);
        setMetadataError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [uri, agentId]);

  return (
    <>
      <div className="card w-full bg-base-100 shadow-xl">
        <figure className="h-48 overflow-hidden relative">
          {metadata?.image ? (
            <Image src={metadata.image} alt={metadata.name || "Agent"} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-base-300 flex items-center justify-center">
              {metadataError ? "Error loading image" : "No Image"}
            </div>
          )}
        </figure>
        <div className="card-body gap-1 p-4">
          <h2 className="card-title text-lg">
            {isLoading ? "Loading..." : metadata?.name || `Agent #${agentId.toString()}`}
          </h2>
          {metadataError && <p className="text-error text-xs">Failed to load metadata</p>}
          <p className="text-sm">{isLoading ? "..." : metadata?.description || "No description provided."}</p>
          <p className="text-xs opacity-70">Price: {formatUnits(price, 6)} USDC</p>
          <p className="text-xs opacity-70">
            Owner: {owner.slice(0, 6)}...{owner.slice(-4)}
          </p>

          <button
            className="flex items-center gap-1 text-xs w-fit hover:opacity-70 transition-opacity my-1"
            onClick={() => (document.getElementById(reviewsModalId) as HTMLDialogElement)?.showModal()}
            disabled={isLoadingReputation}
          >
            {isLoadingReputation ? (
              <span className="loading loading-dots loading-xs"></span>
            ) : score !== null ? (
              <>
                <span className="text-warning">{score.toFixed(1)}</span>
                <StarRating score={score} />({count})
              </>
            ) : (
              <span className="opacity-40">No reviews</span>
            )}
          </button>

          <div className="card-actions justify-end mt-2 items-center">
            {showActions ? (
              <>
                <p className="text-xs font-bold text-success">
                  Balance: {balance !== undefined ? formatUnits(balance, 6) : "0"} USDC
                </p>
                <button className="btn btn-primary btn-xs" onClick={handleWithdraw} disabled={!!pendingAction}>
                  {pendingAction === `withdraw-${agentId}` ? "..." : "Withdraw"}
                </button>
                <button
                  className="btn btn-secondary btn-xs"
                  onClick={() => (document.getElementById(manageModalId) as HTMLDialogElement)?.showModal()}
                >
                  Manage
                </button>
              </>
            ) : (
              <Link href={`/agents/execute/${agentId.toString()}`} className="btn btn-primary btn-sm">
                Execute
              </Link>
            )}
            <div className={`badge badge-xs ${active ? "badge-success" : "badge-error"}`}>
              {active ? "Active" : "Inactive"}
            </div>
          </div>
        </div>
      </div>

      {/* Manage Modal */}
      <dialog id={manageModalId} className="modal">
        <div className="modal-box">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h3 className="font-bold text-lg mb-4">Manage Agent #{agentId.toString()}</h3>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="number"
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                placeholder="New price (USDC)"
                className="input input-bordered input-sm w-full"
              />
              <button className="btn btn-primary btn-sm" onClick={updatePrice} disabled={!!pendingAction}>
                {pendingAction === `price-${agentId}` ? "Updating..." : "Update Price"}
              </button>
            </div>
            <button
              className={`btn btn-sm w-full ${active ? "btn-warning" : "btn-success"}`}
              onClick={toggleStatus}
              disabled={!!pendingAction}
            >
              {pendingAction === `status-${agentId}` ? "Updating..." : active ? "Deactivate Agent" : "Reactivate Agent"}
            </button>
          </div>
        </div>
      </dialog>

      {/* Reviews modal */}
      <dialog id={reviewsModalId} className="modal">
        <div className="modal-box w-11/12 max-w-lg">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h3 className="font-bold text-lg mb-1">{metadata?.name || `Agent #${agentId.toString()}`}</h3>
          <div className="flex flex-col gap-4 max-h-80 overflow-y-auto">
            {feedbacks.length === 0 ? (
              <p className="text-sm opacity-50 text-center py-4">No reviews yet</p>
            ) : (
              feedbacks.map((f, i) => (
                <div key={i} className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between">
                    <span className="opacity-60 font-mono">{f.client.slice(0, 6)}...</span>
                    <StarRating score={Number(f.score)} />
                  </div>
                  <div className="divider my-0"></div>
                </div>
              ))
            )}
          </div>
        </div>
      </dialog>
    </>
  );
};
