import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAgentReputation } from "~~/hooks/useAgentReputation";

interface AgentCardProps {
  agentId: bigint;
  price: bigint;
  owner: string;
  uri: string;
  active: boolean;
}

interface AgentMetadata {
  name: string;
  description: string;
  image: string;
}

// Renders a row of 5 stars filled proportionally to the score (assumes 0–5 scale)
const StarRating = ({ score }: { score: number }) => {
  const stars = Math.round(score);
  return <span className="text-warning">{Array.from({ length: 5 }, (_, i) => (i < stars ? "★" : "☆")).join("")}</span>;
};

export const AgentCard = ({ agentId, price, owner, uri, active }: AgentCardProps) => {
  const { score, count, feedbacks, isLoading: isLoadingReputation } = useAgentReputation(agentId);
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [metadataError, setMetadataError] = useState(false);

  const modalId = `reviews-modal-${agentId.toString()}`;

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
            const parsed = JSON.parse(jsonContent);
            setMetadata(parsed);
          } catch (parseError) {
            console.warn("CRITICAL: Failed to parse JSON metadata for AgentId", agentId.toString());
            console.warn("Raw JSON Content (truncated):", jsonContent.substring(0, 100) + "...");
            console.warn("Parsing Error:", parseError);
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
      <div className="card w-96 bg-base-100 shadow-xl">
        <figure className="h-48 overflow-hidden relative">
          {metadata?.image ? (
            <Image src={metadata.image} alt={metadata.name || "Agent"} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-base-300 flex items-center justify-center">
              {metadataError ? "Error loading image" : "No Image"}
            </div>
          )}
        </figure>
        <div className="card-body">
          <h2 className="card-title">{isLoading ? "Loading..." : metadata?.name || `Agent #${agentId.toString()}`}</h2>
          {metadataError && <p className="text-error text-sm">Failed to load metadata</p>}
          <p>{isLoading ? "..." : metadata?.description || "No description provided."}</p>
          <p className="text-sm opacity-70">Price: {price.toString()}</p>
          <p className="text-sm opacity-70">
            Owner: {owner.slice(0, 6)}...{owner.slice(-4)}
          </p>

          {/* Reputation summary — click to open detailed reviews modal */}
          <button
            className="flex items-center gap-1 text-sm w-fit hover:opacity-70 transition-opacity"
            onClick={() => (document.getElementById(modalId) as HTMLDialogElement)?.showModal()}
            disabled={isLoadingReputation}
          >
            {isLoadingReputation ? (
              <span className="loading loading-dots loading-xs"></span>
            ) : score !== null ? (
              <>
                <span className="text-warning font-medium">{score.toFixed(1)}</span>
                <StarRating score={score} />
                <span className="opacity-50">({count})</span>
              </>
            ) : (
              <span className="opacity-40 text-xs">No reviews yet</span>
            )}
          </button>

          <div className="card-actions justify-end">
            <Link href={`/agents/execute/${agentId.toString()}`} className="btn btn-primary btn-sm">
              Execute
            </Link>
            <div className={`badge ${active ? "badge-success" : "badge-error"}`}>{active ? "Active" : "Inactive"}</div>
          </div>
        </div>
      </div>

      {/* Reviews modal — shown when user clicks on the rating */}
      <dialog id={modalId} className="modal">
        <div className="modal-box w-11/12 max-w-lg">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>

          <h3 className="font-bold text-lg mb-1">{metadata?.name || `Agent #${agentId.toString()}`}</h3>

          {/* Overall score header */}
          {score !== null && (
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-base-300">
              <span className="text-5xl font-bold">{score.toFixed(1)}</span>
              <div>
                <StarRating score={score} />
                <p className="text-sm opacity-60 mt-1">
                  {count} {count === 1 ? "review" : "reviews"}
                </p>
              </div>
            </div>
          )}

          {/* Individual reviews list */}
          <div className="flex flex-col gap-4 max-h-80 overflow-y-auto">
            {feedbacks.length === 0 ? (
              <p className="text-sm opacity-50 text-center py-4">No reviews yet</p>
            ) : (
              feedbacks.map((feedback, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs opacity-60 font-mono">
                      {feedback.client.slice(0, 6)}...{feedback.client.slice(-4)}
                    </span>
                    <StarRating score={feedback.score} />
                  </div>
                  {(feedback.tag1 || feedback.tag2) && (
                    <div className="flex gap-1">
                      {feedback.tag1 && <span className="badge badge-ghost badge-sm">{feedback.tag1}</span>}
                      {feedback.tag2 && <span className="badge badge-ghost badge-sm">{feedback.tag2}</span>}
                    </div>
                  )}
                  <div className="divider my-0"></div>
                </div>
              ))
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
};
