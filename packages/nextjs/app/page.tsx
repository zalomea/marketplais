"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { IntroSplash } from "~~/components/IntroSplash";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [showIntro, setShowIntro] = useState(true);
  const [agentsActive, setAgentsActive] = useState<number[]>([]);

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

  if (showIntro) {
    return <IntroSplash onComplete={() => setShowIntro(false)} />;
  }

  return (
    <div className="relative min-h-screen bg-white text-slate-900 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50" />
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="black" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

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

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-16 lg:px-8">
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
                href="/blockexplorer"
                className="inline-flex h-12 items-center justify-center border border-slate-300 bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Buyer Zone
              </Link>
              <Link
                href="/debug"
                className="inline-flex h-12 items-center justify-center border border-slate-300 bg-white text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Upload Agent
              </Link>
            </div>
          </div>

          <div className="border border-slate-300 bg-white p-8 shadow-sm">
            <div className="space-y-6">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-700">Workspace overview</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">Connected wallet</p>
              </div>
              <div className="border border-slate-300 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-700">Account</p>
                <p className="mt-3 text-base font-medium text-slate-900 break-all">
                  {connectedAddress ?? "No wallet connected"}
                </p>
              </div>
              <div className="grid gap-4">
                <div className="border border-slate-300 bg-slate-50 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-700">Active Agents</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-2 w-2 rounded-full bg-slate-700" />
                      <span className="text-base font-medium text-slate-900">Agent #1 (placeholder)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-2 w-2 rounded-full bg-slate-700" />
                      <span className="text-base font-medium text-slate-900">Agent #2 (placeholder)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-2 w-2 rounded-full bg-slate-700" />
                      <span className="text-base font-medium text-slate-900">Agent #3 (placeholder)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-20 space-y-8">
          <div className="border border-slate-300 bg-white p-10 shadow-sm">
            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-700">Buyer Zone</p>
                <h2 className="text-2xl font-semibold text-slate-900">Discover agents</h2>
                <p className="text-sm leading-7 text-slate-600">
                  Browse available agents, compare pricing, and license access with a secure marketplace flow.
                </p>
              </div>
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-700">Agent Publisher</p>
                <h2 className="text-2xl font-semibold text-slate-900">Register agents</h2>
                <p className="text-sm leading-7 text-slate-600">
                  Upload agents, set pricing, and manage identity with the same professional interface.
                </p>
              </div>
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-700">Traceability</p>
                <h2 className="text-2xl font-semibold text-slate-900">Web3 billing</h2>
                <p className="text-sm leading-7 text-slate-600">
                  USDC payments and on-chain identities provide enterprise-grade accountability for every request.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border border-slate-300 bg-slate-50 p-10 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Focused workflows</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Buyers and publishers each get a clear path through the marketplace without unnecessary interface
                distractions.
              </p>
            </div>
            <div className="border border-slate-300 bg-slate-50 p-10 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Secure, professional presentation</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                The interface is minimal, precise, and designed for enterprise-style trust and control.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
