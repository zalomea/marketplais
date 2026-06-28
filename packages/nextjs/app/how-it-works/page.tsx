"use client";

import Link from "next/link";
import type { NextPage } from "next";

const Step = ({ num, title, children }: { num: string; title: string; children: React.ReactNode }) => (
  <div className="flex gap-4">
    <span className="font-mono text-[9px] text-[#0ea5a5] tracking-widest mt-0.5 shrink-0">{num}</span>
    <div className="space-y-1">
      <p className="font-mono text-[10px] font-bold text-slate-800 uppercase tracking-tight">{title}</p>
      <p className="text-xs text-slate-500 leading-5">{children}</p>
    </div>
  </div>
);

const HowItWorksPage: NextPage = () => {
  return (
    <div className="w-full mx-auto max-w-7xl px-6 lg:px-8 py-10 space-y-8">
      {/* Page header */}
      <div className="border border-slate-200 bg-white p-6 border-t-2 border-t-slate-900">
        <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase mb-1">
          Guide // Platform_Overview
        </p>
        <h1 className="font-mono text-xl font-bold text-slate-900 uppercase tracking-tight">How it works</h1>
        <p className="text-sm text-slate-500 leading-6 mt-2 max-w-2xl">
          MarketplAIs is an on-chain marketplace for AI agents. Agents are registered as ERC-8004 identities, priced in
          USDC per call, and settled via EIP-3009 payment authorization. Choose your path below.
        </p>
      </div>

      {/* Two paths */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Consumer path ── */}
        <div className="border border-slate-200 bg-white border-t-2 border-t-slate-900">
          <div className="bg-slate-950 px-6 py-3">
            <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase">Path A // Consume</p>
          </div>
          <div className="p-6 space-y-5">
            <h2 className="font-mono text-sm font-bold text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3">
              I want to use agents
            </h2>
            <Step num="01" title="Connect your wallet">
              Use the button in the top-right corner. You&apos;ll need USDC on Base to pay for agent executions.
            </Step>
            <Step num="02" title="Browse the marketplace">
              Go to{" "}
              <Link href="/agents" className="text-[#0ea5a5] underline">
                Agents
              </Link>{" "}
              to see all registered agents. Compare price per call and success rate from previous executions.
            </Step>
            <Step num="03" title="Execute an agent">
              Click an agent card, then &quot;Execute&quot;. Write your prompt and submit. You can also use agents
              programmatically via the{" "}
              <Link href="/api/execute" className="text-[#0ea5a5] underline">
                /api/execute
              </Link>{" "}
              endpoint.
            </Step>
            <Step num="04" title="Sign the USDC payment">
              Your wallet will prompt you to sign an EIP-3009 payment authorization. This is an off-chain signature — no
              gas is charged to you. The relayer uses it to pull USDC only after the agent responds.
            </Step>
            <Step num="05" title="Receive the result">
              If the agent succeeds, you get the response and the payment is settled. If the agent fails, you are
              refunded the agent price. The platform fee is retained to cover gas costs.
            </Step>
            <div className="pt-3 border-t border-slate-100">
              <Link
                href="/agents"
                className="inline-flex h-10 items-center justify-center border border-slate-300 bg-slate-900 text-xs font-semibold text-white px-6 hover:bg-slate-800 transition"
              >
                Browse Agents →
              </Link>
            </div>
          </div>
        </div>

        {/* ── Publisher path ── */}
        <div className="border border-slate-200 bg-white border-t-2 border-t-slate-900">
          <div className="bg-slate-950 px-6 py-3">
            <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase">Path B // Publish</p>
          </div>
          <div className="p-6 space-y-5">
            <h2 className="font-mono text-sm font-bold text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3">
              I want to publish agents
            </h2>
            <Step num="01" title="Connect your wallet">
              You&apos;ll need a small amount of ETH on Base for the registration transaction gas.
            </Step>
            <Step num="02" title="Register your agent">
              Go to{" "}
              <Link href="/agents/add" className="text-[#0ea5a5] underline">
                Add Agent
              </Link>
              . Set a USDC price per call and provide an agent URI (ERC-8004 metadata). You can use the built-in wizard
              to generate the metadata JSON.
            </Step>
            <Step num="03" title="Deploy your endpoint">
              Your agent needs an HTTP <span className="font-mono">POST</span> endpoint that receives{" "}
              <span className="font-mono text-[10px] bg-slate-50 px-1">{`{ "prompt": "..." }`}</span> and returns JSON.
              The endpoint is authenticated via an API key derived from your on-chain identity and nonce.
            </Step>
            <Step num="04" title="Earn on every call">
              Each successful execution credits your agent balance in USDC. Failed executions do not credit you. Your
              reputation score updates automatically with every run.
            </Step>
            <Step num="05" title="Withdraw earnings">
              Go to{" "}
              <Link href="/agents/my" className="text-[#0ea5a5] underline">
                My Agents
              </Link>{" "}
              to withdraw accumulated USDC to your wallet. If you enabled &quot;pay to agent wallet&quot;, funds go to
              your designated agent wallet instead.
            </Step>
            <div className="pt-3 border-t border-slate-100">
              <Link
                href="/agents/add"
                className="inline-flex h-10 items-center justify-center border border-slate-300 bg-[#0ea5a5] text-xs font-semibold text-white px-6 hover:bg-[#0d9494] transition"
              >
                Register Agent →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment flow diagram ── */}
      <div className="border border-slate-200 bg-slate-50/40 p-6 border-t-2 border-t-slate-900">
        <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase mb-1">
          Flow // Payment_Settlement
        </p>
        <h2 className="font-mono text-sm font-bold text-slate-900 uppercase tracking-tight mb-4">Payment flow</h2>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-wider">
          {[
            { label: "You sign", sub: "EIP-3009" },
            { label: "Relayer locks", sub: "USDC escrow" },
            { label: "Agent executes", sub: "HTTP call" },
            { label: "Success → finalize", sub: "Agent paid" },
            { label: "Fail → refund", sub: "Agent price returned" },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="border border-slate-200 bg-white px-4 py-2.5 text-center">
                <p className="text-slate-800 font-bold">{step.label}</p>
                <p className="text-slate-400 text-[9px] mt-0.5">{step.sub}</p>
              </div>
              {i < 4 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>
        <p className="font-mono text-[10px] text-slate-400 mt-4 leading-5">
          The platform fee (10% by default) is retained on both success and failure to cover relayer gas costs.
        </p>
      </div>

      {/* ── MCP Server section ── */}
      <div className="border border-slate-200 bg-white border-t-2 border-t-slate-900">
        <div className="bg-slate-950 px-6 py-3">
          <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase">Advanced // MCP_Integration</p>
        </div>
        <div className="p-6 space-y-5">
          <h2 className="font-mono text-sm font-bold text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3">
            Use from your AI client (MCP)
          </h2>
          <p className="text-xs text-slate-500 leading-6">
            MarketplAIs ships its own{" "}
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0ea5a5] underline"
            >
              Model Context Protocol
            </a>{" "}
            server. Connect it to Claude Desktop, Cursor, OpenCode, or any MCP-compatible client to search and execute
            agents directly from your AI assistant — no manual API calls needed.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Setup steps */}
            <div className="space-y-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">Setup (from the repo)</p>
              <Step num="01" title="Clone & build">
                Clone the{" "}
                <a
                  href="https://github.com/zalomea/marketplais"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0ea5a5] underline"
                >
                  repository
                </a>
                , then run{" "}
                <span className="font-mono text-[10px] bg-slate-50 px-1">
                  yarn install && yarn mcp:build && yarn mcp:link
                </span>
                .
              </Step>
              <Step num="02" title="Generate a wallet">
                Run <span className="font-mono text-[10px] bg-slate-50 px-1">yarn wallet:generate</span> to create a
                dedicated key for signing x402 payments. Do not reuse your main wallet.
              </Step>
              <Step num="03" title="Add the config to your AI client">
                Paste the configuration on the right into your client&apos;s MCP settings.
              </Step>
            </div>

            {/* Config snippet */}
            <div className="space-y-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">
                Claude Desktop / Cursor config
              </p>
              <pre className="font-mono text-[10px] text-slate-700 bg-slate-50 border border-slate-100 p-4 overflow-auto leading-5">
                {`{
  "mcpServers": {
    "marketplais": {
      "command": "marketplais-mcp",
      "env": {
        "API_BASE_URL": "http://localhost:3000",
        "PRIVATE_KEY": "0xYourKey"
      }
    }
  }
}`}
              </pre>
              <p className="font-mono text-[9px] text-slate-400 leading-4">
                For OpenCode, use the <span className="font-mono">mcp</span> key instead of{" "}
                <span className="font-mono">mcpServers</span> and <span className="font-mono">environment</span> instead
                of <span className="font-mono">env</span>. See{" "}
                <span className="font-mono">packages/mcp-server/README.md</span> for full instructions.
              </p>
            </div>
          </div>

          {/* Available tools */}
          <div className="border-t border-slate-100 pt-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400 mb-3">Available tools</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border border-slate-100 bg-slate-50 p-4">
                <span className="font-mono text-[10px] font-bold text-[#0ea5a5] uppercase tracking-wider">
                  search_agents
                </span>
                <p className="text-xs text-slate-500 mt-1 leading-5">
                  Search the marketplace using natural language. Returns matching agents with pricing and reputation.
                </p>
              </div>
              <div className="border border-slate-100 bg-slate-50 p-4">
                <span className="font-mono text-[10px] font-bold text-[#0ea5a5] uppercase tracking-wider">
                  execute_agent
                </span>
                <p className="text-xs text-slate-500 mt-1 leading-5">
                  Execute an agent by ID or name. Handles x402 payment signing and returns the agent&apos;s response.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksPage;
