#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// --- Types & Interfaces ---
interface Agent {
  id: string | number;
  name: string;
  description: string;
  agent: {
    price: string | number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ChallengePayload {
  chainId: number | string;
  token: string;
  spender: string;
  amount: string | number;
  deadline: string | number;
  nonce: string;
}

// --- Configuration ---
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const PRIVATE_KEY = process.env.PRIVATE_KEY?.trim() as Hex; 
const USDC_DECIMALS = 1_000_000;

const mcpServer = new Server(
  {
    name: "marketplais-mcp",
    version: "0.2.0",
  },
  {
    capabilities: { tools: {} },
  }
);

// --- Core Functions ---

/**
 * Generates the EIP-712 signature for the USDC ReceiveWithAuthorization payment flow.
 */
async function signTypedDataX402(challengePayload: ChallengePayload) {
  if (!PRIVATE_KEY) {
    throw new Error(
      "CRITICAL ERROR: The MCP server's private key is not configured. " +
      "Configure 'PRIVATE_KEY' in your opencode.jsonc file within the 'env' property of the 'marketplais' server, or in .env."
    );
  }
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  const clientAddress = account.address;

  const typedData = {
    domain: {
      name: "USD Coin",
      version: "2",
      chainId: Number(challengePayload.chainId),
      verifyingContract: challengePayload.token as Hex, 
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
    primaryType: "ReceiveWithAuthorization" as const,
    message: {
      from: clientAddress,
      to: challengePayload.spender as Hex, 
      value: BigInt(challengePayload.amount), 
      validAfter: 0n, 
      validBefore: BigInt(challengePayload.deadline),
      nonce: challengePayload.nonce as Hex, 
    },
  };

  const signature = await account.signTypedData(typedData);

  return {
    signature,
    nonce: challengePayload.nonce,
    deadline: challengePayload.deadline,
    clientAddress,
  };
}

// --- Tool Handlers ---

/**
 * Fetches all agents from the marketplace and filters them in-memory based on the task.
 */
async function handleSearchAgents(task: string) {
  const response = await fetch(`${API_BASE_URL}/api/agents`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.status} ${response.statusText}`);
  }
  
  const agents: Agent[] = await response.json();

  // Format the price for better LLM readability
  const formattedAgents = agents.map(a => ({
    ...a,
    priceFormatted: `${(Number(a.agent.price) / USDC_DECIMALS).toFixed(2)} USDC`
  }));

  const taskLower = task.toLowerCase();
  
  // In-memory filtering since the API does not support query parameters yet
  const filtered = formattedAgents.filter(a => 
    a.description?.toLowerCase().includes(taskLower) ||
    a.name?.toLowerCase().includes(taskLower)
  );

  const resultData = filtered.length > 0 ? filtered : formattedAgents;
  
  return { 
    content: [{ type: "text", text: JSON.stringify(resultData, null, 2) }] 
  };
}

/**
 * Handles the 2-phase execution flow (Request -> 402 Challenge -> Sign -> Execute).
 */
async function handleExecuteAgent(agentId: string, prompt: string) {
  const requestBody = { 
    agentId, 
    request: { 
      prompt,
      metadata: { source: "mcp-server" }
    }
  };

  // Phase 1: Initiate execution (Expecting 402 Payment Required)
  const res1 = await fetch(`${API_BASE_URL}/api/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (res1.status !== 402) {
    const errorText = await res1.text().catch(() => "No text body");
    throw new Error(`Expected 402 Payment Required, got ${res1.status}. Details: ${errorText}`);
  }

  const challengePayload: ChallengePayload = await res1.json(); 

  // Phase 2: Sign the challenge payload
  const { signature, nonce, deadline, clientAddress } = await signTypedDataX402(challengePayload);
  
  // Phase 3: Retry execution with payment headers
  const res2 = await fetch(`${API_BASE_URL}/api/execute`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-payment-signature": signature,
      "x-payment-nonce": nonce,
      "x-payment-deadline": deadline.toString(),
      "x-payment-from": clientAddress
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await res2.text();
  
  if (!res2.ok) {
    throw new Error(`Execution failed with status ${res2.status}: ${responseText}`);
  }

  try {
    const data = JSON.parse(responseText);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (e) {
    // Fallback to raw text if response is not valid JSON
    return { content: [{ type: "text", text: responseText }] };
  }
}

// --- Server Setup ---

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_agents",
        description: "Searches the MarketplAIs directory to find AI agents suitable for a specific task. AGENT INSTRUCTION: Before calling this tool, explicitly tell the user: 'I am going to search the MarketplAIs directory to find an agent that can help with [Task]...'",
        inputSchema: {
          type: "object",
          properties: {
            task: { type: "string", description: "A natural language description of the task or the capability required." },
          },
          required: ["task"],
        },
      },
      {
        name: "execute_agent",
        description: "Executes a task using a specific AI agent by its ID. It handles the payment authorization automatically. AGENT INSTRUCTION: Before calling this tool, explicitly tell the user: 'I am going to execute agent [AgentId] and authorize the necessary USDC payment for this request...'",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "The unique numeric ID of the agent." },
            prompt: { type: "string", description: "The detailed prompt or instruction to send to the chosen agent." },
          },
          required: ["agentId", "prompt"],
        },
      },
    ] as Tool[],
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === "search_agents") {
      return await handleSearchAgents((args as { task: string }).task);
    } 
    
    if (name === "execute_agent") {
      const { agentId, prompt } = args as { agentId: string, prompt: string };
      return await handleExecuteAgent(agentId, prompt);
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`DEBUG [${request.params.name}]: Tool execution error:`, errorMessage);
    return {
      content: [{ type: "text", text: `ERROR: ${errorMessage}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await mcpServer.connect(transport);

console.error("MarketplAIs MCP server running on stdio");