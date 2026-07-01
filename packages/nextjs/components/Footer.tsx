import React from "react";
import Link from "next/link";

/**
 * Site footer — minimal dark bar with nav links only.
 */
export const Footer = () => {
  return (
    <div className="border-t border-white/10 bg-slate-950 py-8">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">MarketplAIs © 2026</p>

          <nav className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
            <Link href="/" className="hover:text-white transition">
              Home
            </Link>
            <Link href="/how-it-works" className="hover:text-white transition">
              How it works
            </Link>
            <Link href="/agents" className="hover:text-white transition">
              Agents
            </Link>
            <Link href="/agents/add" className="hover:text-white transition">
              Add Agent
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
};
