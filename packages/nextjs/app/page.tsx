"use client";

import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { BugAntIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  return (
    <>
      <div className="flex items-center flex-col grow pt-10">
        <div className="px-5 max-w-4xl">
          <h1 className="text-center">
            <span className="block text-2xl mb-2">Welcome to</span>
            <span className="block text-4xl font-bold">MarketplAIs</span>
          </h1>
          <div className="mt-6 space-y-4 text-center">
            <p className="text-lg font-medium">
              A decentralized marketplace for autonomous AI agents, built with Scaffold-ETH 2.
            </p>
            <p className="text-base">
              This app connects on-chain agent identity, reputation, and x402 micropayment billing in a simple local dev
              experience.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-base-200 p-6">
              <h2 className="text-xl font-semibold mb-2">Tech Stack</h2>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Solidity + Hardhat</li>
                <li>Next.js App Router</li>
                <li>TypeScript + Tailwind CSS</li>
                <li>ERC-8004 identity + x402 billing</li>
              </ul>
            </div>
            <div className="rounded-3xl bg-base-200 p-6">
              <h2 className="text-xl font-semibold mb-2">Local Dev</h2>
              <p className="text-sm leading-6">
                Start the chain with <code className="rounded bg-base-300 px-1 py-0.5">yarn chain</code>, deploy with{" "}
                <code className="rounded bg-base-300 px-1 py-0.5">yarn deploy</code>, and run the app using{" "}
                <code className="rounded bg-base-300 px-1 py-0.5">yarn start</code>.
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-center items-center space-x-2 flex-col">
            <p className="my-2 font-medium">Connected Address:</p>
            <Address address={connectedAddress} chain={targetNetwork} />
          </div>
        </div>

        <div className="grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col md:flex-row">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <BugAntIcon className="h-8 w-8 fill-secondary" />
              <p>
                Tinker with your smart contract using the{" "}
                <Link href="/debug" passHref className="link">
                  Debug Contracts
                </Link>{" "}
                tab.
              </p>
            </div>
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <MagnifyingGlassIcon className="h-8 w-8 fill-secondary" />
              <p>
                Explore your local transactions with the{" "}
                <Link href="/blockexplorer" passHref className="link">
                  Block Explorer
                </Link>{" "}
                tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
