"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { IntroSplash } from "~~/components/IntroSplash";
import { useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useAllContracts } from "~~/utils/scaffold-eth/contractsData";

export const HomePage: NextPage = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [agentsActive, setAgentsActive] = useState<number[]>([]);

  const { targetNetwork } = useTargetNetwork();
  const allContracts = useAllContracts();
  const explorerUrl = targetNetwork.blockExplorers?.default?.url;

  const { data: agentsPage } = useScaffoldReadContract({
    contractName: "AgentMarketplace",
    functionName: "getAgentsFullPaginated",
    args: [1n, 100n],
  });

  const totalAgentsCount = agentsPage ? BigInt(agentsPage.length) : undefined;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSeenIntro = sessionStorage.getItem("marketplais_intro_seen");
      if (hasSeenIntro === "true") {
        setShowIntro(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!showIntro) {
      const agentTimers = Array.from({ length: 5 }).map((_, i) =>
        setTimeout(() => {
          setAgentsActive(prev => [...prev, i]);
        }, i * 300),
      );
      return () => agentTimers.forEach(clearTimeout);
    }
  }, [showIntro]);

  const handleIntroComplete = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("marketplais_intro_seen", "true");
    }
    setShowIntro(false);
  }, []);

  if (showIntro) {
    return <IntroSplash onComplete={handleIntroComplete} />;
  }

  return (
    <div className="relative min-h-screen bg-white text-slate-900 overflow-hidden">
      {/* ── Background layer ──────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50" />

        {/* Subtle grid */}
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="black" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Animated network dots */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`absolute w-1.5 h-1.5 bg-slate-400 rounded-full opacity-40 transition-all duration-700 ${
              agentsActive.includes(i) ? "scale-100 shadow-lg shadow-slate-400/50" : "scale-0"
            }`}
            style={{
              left: `${15 + (i % 4) * 20}%`,
              top: `${20 + Math.floor(i / 4) * 30}%`,
            }}
          />
        ))}

        {/* Connecting lines between dots */}
        {agentsActive.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {Array.from({ length: Math.min(agentsActive.length - 1, 3) }).map((_, i) => {
              const start = i;
              const end = (i + 1) % Math.min(agentsActive.length, 4);
              const x1 = 15 + (start % 4) * 20;
              const y1 = 20 + Math.floor(start / 4) * 30;
              const x2 = 15 + (end % 4) * 20;
              const y2 = 20 + Math.floor(end / 4) * 30;
              return (
                <line
                  key={i}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="url(#lineGradient)"
                  strokeWidth="1"
                  opacity="0.15"
                  className="animate-pulse-slow"
                />
              );
            })}
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
            </defs>
          </svg>
        )}
      </div>

      {/* ── Main content ───────────────────────────────────────── */}
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-16 lg:px-8">
        {/* Hero section */}
        <div className="grid gap-16 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div className="space-y-10">
            <div className="inline-flex border border-slate-300 bg-slate-50 px-4 py-1.5 text-xs uppercase tracking-[0.28em] text-slate-600">
              Enterprise AI marketplace
            </div>
            <div className="space-y-6">
              <h1
                className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl"
                style={{ color: "var(--color-base-content)" }}
              >
                A sharper agent marketplace for buyers and publishers.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                MarketplAIs combines agent registration, USDC billing, and Web3 trust in a polished, professional
                operator experience.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/agents"
                className="inline-flex h-12 items-center justify-center border border-slate-300 bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Browse Agents
              </Link>
              <Link
                href="/agents/add"
                className="inline-flex h-12 items-center justify-center border border-slate-300 bg-white text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Register Agent
              </Link>
            </div>
          </div>

          {/* Live stats panel */}
          <div className="border border-slate-200 bg-slate-50/40 p-8 rounded-none shadow-sm relative border-t-2 border-t-slate-800">
            <div className="space-y-6">
              <div>
                <p className="text-sm font-mono text-[9px] uppercase tracking-[0.22em] text-slate-500">
                  Workspace overview // nodes
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tracking-tight uppercase">
                  Connected node
                </p>
              </div>

              <div className="border border-slate-200 bg-white p-5 rounded-none">
                <span className="font-mono text-[9px] tracking-wider text-slate-400 block mb-3">
                  SYS // LIVE_REGISTRY
                </span>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <span className="font-mono text-xs text-slate-500 uppercase">ACTIVE_AGENTS</span>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {totalAgentsCount !== undefined ? totalAgentsCount.toString() : "0"} UNIT(S)
                  </span>
                </div>
                <div className="space-y-2 font-mono text-[11px]">
                  {totalAgentsCount !== undefined && totalAgentsCount > 0n ? (
                    <div className="text-slate-700 bg-slate-50 p-3 border border-slate-100 flex items-center gap-2">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                      </span>
                      <span>AGENTS LOADED ON-CHAIN</span>
                    </div>
                  ) : (
                    <div className="text-slate-400 bg-slate-50/50 p-3 border border-slate-100/50 text-center italic">
                      [ NO INSTANCES ACTIVE IN REGISTRY ]
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 bg-white p-5 rounded-none">
                <span className="font-mono text-[9px] tracking-wider text-slate-400 block mb-3">
                  CONTRACTS // DEPLOYED
                </span>
                <div className="space-y-1.5">
                  {allContracts["AgentMarketplace"] && (
                    <div>
                      <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
                        AGENT_MARKETPLACE
                      </span>
                      <br />
                      {explorerUrl ? (
                        <a
                          href={`${explorerUrl}/address/${allContracts["AgentMarketplace"].address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[11px] text-slate-900 hover:text-[#0ea5a5] transition-colors"
                        >
                          {`${allContracts["AgentMarketplace"].address.slice(0, 6)}...${allContracts["AgentMarketplace"].address.slice(-4)}`}{" "}
                          <span className="text-[#0ea5a5] text-[10px]">↗</span>
                        </a>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-900">
                          {`${allContracts["AgentMarketplace"].address.slice(0, 6)}...${allContracts["AgentMarketplace"].address.slice(-4)}`}
                        </span>
                      )}
                    </div>
                  )}
                  {allContracts["MarketplaceRouter"] && (
                    <div>
                      <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
                        MARKETPLACE_ROUTER
                      </span>
                      <br />
                      {explorerUrl ? (
                        <a
                          href={`${explorerUrl}/address/${allContracts["MarketplaceRouter"].address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[11px] text-slate-900 hover:text-[#0ea5a5] transition-colors"
                        >
                          {`${allContracts["MarketplaceRouter"].address.slice(0, 6)}...${allContracts["MarketplaceRouter"].address.slice(-4)}`}{" "}
                          <span className="text-[#0ea5a5] text-[10px]">↗</span>
                        </a>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-900">
                          {`${allContracts["MarketplaceRouter"].address.slice(0, 6)}...${allContracts["MarketplaceRouter"].address.slice(-4)}`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How it works — dual path */}
        <section className="mt-20 space-y-8">
          <div className="border border-slate-200 bg-white p-8 rounded-none shadow-sm border-t-2 border-t-slate-800">
            <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase mb-2">
              Guide // Choose_your_path
            </p>
            <h2 className="font-mono text-lg font-bold text-slate-900 uppercase tracking-tight mb-6">How it works</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Consume */}
              <Link
                href="/how-it-works"
                className="group border border-slate-200 bg-slate-50/70 p-6 hover:border-[#0ea5a5] transition-colors flex flex-col gap-4"
              >
                <div>
                  <span className="font-mono text-[9px] tracking-wider text-slate-400 block mb-1">
                    PATH A // CONSUME
                  </span>
                  <h3 className="font-mono text-sm font-bold text-slate-900 uppercase tracking-tight">
                    I want to use agents
                  </h3>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600 leading-5">
                  <li>1. Connect your wallet</li>
                  <li>2. Browse &amp; compare agents</li>
                  <li>3. Sign USDC payment</li>
                  <li>4. Get the result</li>
                </ul>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#0ea5a5] group-hover:underline mt-auto">
                  Learn more →
                </span>
              </Link>
              {/* Publish */}
              <Link
                href="/how-it-works"
                className="group border border-slate-200 bg-slate-50/70 p-6 hover:border-[#0ea5a5] transition-colors flex flex-col gap-4"
              >
                <div>
                  <span className="font-mono text-[9px] tracking-wider text-slate-400 block mb-1">
                    PATH B // PUBLISH
                  </span>
                  <h3 className="font-mono text-sm font-bold text-slate-900 uppercase tracking-tight">
                    I want to publish agents
                  </h3>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600 leading-5">
                  <li>1. Register your agent</li>
                  <li>2. Set USDC price per call</li>
                  <li>3. Deploy your HTTP endpoint</li>
                  <li>4. Earn on every execution</li>
                </ul>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#0ea5a5] group-hover:underline mt-auto">
                  Learn more →
                </span>
              </Link>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border border-slate-200 bg-slate-50/70 p-8 rounded-none shadow-sm relative overflow-hidden flex flex-col justify-between border-t-2 border-t-slate-800">
              <div>
                <span className="font-mono text-[9px] tracking-wider text-slate-500 block mb-2">
                  SEC // CRYPTO_ATTESTATION
                </span>
                <h3 className="text-lg font-bold text-slate-900 font-mono tracking-tight uppercase">
                  High-Trust Attestation
                </h3>
                <p className="mt-3 text-xs leading-6 text-slate-600">
                  Integrates cryptographic identity validation and secure EIP-712 / EIP-3009 signatures to authorize
                  model requests and ensure system integrity.
                </p>
              </div>
              <div className="mt-6 border-t border-slate-200/60 pt-3 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>KEY_EXCHANGE // ECDSA</span>
                <span className="text-emerald-600 font-bold">SECURE</span>
              </div>
            </div>

            <div className="border border-slate-200 bg-slate-50/70 p-8 rounded-none shadow-sm relative overflow-hidden flex flex-col justify-between border-t-2 border-t-slate-800">
              <div>
                <span className="font-mono text-[9px] tracking-wider text-slate-500 block mb-2">
                  SEC // AUDIT_COMPLIANCE
                </span>
                <h3 className="text-lg font-bold text-slate-900 font-mono tracking-tight uppercase">
                  On-Chain Audit Trail
                </h3>
                <p className="mt-3 text-xs leading-6 text-slate-600">
                  Every agent execution and reputation update is permanently anchored on-chain, providing immutable
                  compliance logs for enterprise audits.
                </p>
              </div>
              <div className="mt-6 border-t border-slate-200/60 pt-3 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>LEDGER_SYNC // COMPLETE</span>
                <span className="text-emerald-600 font-bold">VERIFIED</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
