import { NextResponse } from "next/server";
import deployedContracts from "~~/contracts/deployedContracts";
import { publicClient } from "~~/services/web3/viemClient";

// Helper function to parse agent URI
const parseAgentMetadata = (uri: string) => {
  try {
    let jsonContent = "";
    if (uri.startsWith("data:application/json;base64,")) {
      jsonContent = Buffer.from(uri.split(",")[1], "base64").toString("utf-8");
    } else if (uri.startsWith("data:application/json,")) {
      jsonContent = decodeURIComponent(uri.split(",")[1]);
    } else {
      // Fallback for raw base64 or other formats
      try {
        jsonContent = Buffer.from(uri, "base64").toString("utf-8");
      } catch {
        return { name: "Unknown Agent", description: "No description available" };
      }
    }
    const parsed = JSON.parse(jsonContent);
    return { name: parsed.name || "Unknown Agent", description: parsed.description || "" };
  } catch {
    return { name: "Unknown Agent", description: "No description available" };
  }
};

export async function GET() {
  const chainId = publicClient.chain.id;
  const contracts = (deployedContracts as any)[chainId];

  if (!contracts || !contracts.AgentMarketplace) {
    return NextResponse.json({ error: "AgentMarketplace not found" }, { status: 503 });
  }

  try {
    const agents = (await publicClient.readContract({
      address: contracts.AgentMarketplace.address,
      abi: contracts.AgentMarketplace.abi,
      functionName: "getAgentsFullPaginated",
      args: [1n, 100n],
    })) as any[];

    // Map agents and inject parsed metadata
    const serialized = agents.map(agent => {
      const metadata = parseAgentMetadata(agent.uri);
      return {
        agent: {
          agentId: agent.agent.agentId.toString(),
          price: agent.agent.price.toString(),
          payToAgentWallet: agent.agent.payToAgentWallet,
          active: agent.agent.active,
        },
        owner: agent.owner,
        uri: agent.uri,
        name: metadata.name,
        description: metadata.description,
      };
    });

    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error("[api/agents] Error:", error.message);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}
