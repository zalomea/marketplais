import { useEffect, useState } from "react";
import Image from "next/image";

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

export const AgentCard = ({ agentId, price, owner, uri, active }: AgentCardProps) => {
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [metadataError, setMetadataError] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoading(true);
      setMetadataError(false);
      try {
        let jsonContent: string = "";

        // Handle data:base64 or just base64 string
        if (uri.startsWith("data:application/json;base64,")) {
          jsonContent = atob(uri.split(",")[1]);
        } else if (uri.startsWith("data:application/json,")) {
          jsonContent = decodeURIComponent(uri.split(",")[1]);
        } else if (uri.startsWith("http")) {
          const response = await fetch(uri);
          jsonContent = await response.text();
        } else {
          // Assume it's a raw base64 string if it doesn't start with http
          try {
            jsonContent = atob(uri);
          } catch {
            console.error("Unknown URI format");
            setMetadataError(true);
          }
        }

        if (jsonContent) {
          try {
            // Attempt to parse directly, assuming the URI provided structural valid JSON
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
        <div className="card-actions justify-end">
          <div className={`badge ${active ? "badge-success" : "badge-error"}`}>{active ? "Active" : "Inactive"}</div>
        </div>
      </div>
    </div>
  );
};
