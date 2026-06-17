"use client";

import { useEffect, useState } from "react";
import { PaginationButton, SearchBar, TransactionsTable } from "./_components";
import type { NextPage } from "next";
import { hardhat } from "viem/chains";
import { useFetchBlocks } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { notification } from "~~/utils/scaffold-eth";

const BlockExplorer: NextPage = () => {
  const { blocks, transactionReceipts, currentPage, totalBlocks, setCurrentPage, error } = useFetchBlocks();
  const { targetNetwork } = useTargetNetwork();
  const [isLocalNetwork, setIsLocalNetwork] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (targetNetwork.id !== hardhat.id) setIsLocalNetwork(false);
  }, [targetNetwork.id]);

  useEffect(() => {
    if (targetNetwork.id === hardhat.id && error) setHasError(true);
  }, [targetNetwork.id, error]);

  useEffect(() => {
    if (!isLocalNetwork) {
      notification.error(
        <>
          <p className="font-bold mt-0 mb-1">
            <code className="italic bg-base-300 text-base font-bold"> targetNetwork </code> is not localhost
          </p>
          <p className="m-0">
            - You are on <code className="italic bg-base-300 text-base font-bold">{targetNetwork.name}</code>. This
            block explorer is only for <code className="italic bg-base-300 text-base font-bold">localhost</code>.
          </p>
          <p className="mt-1 break-normal">
            - You can use{" "}
            <a className="text-accent" href={targetNetwork.blockExplorers?.default.url}>
              {targetNetwork.blockExplorers?.default.name}
            </a>{" "}
            instead
          </p>
        </>,
      );
    }
  }, [
    isLocalNetwork,
    targetNetwork.blockExplorers?.default.name,
    targetNetwork.blockExplorers?.default.url,
    targetNetwork.name,
  ]);

  useEffect(() => {
    if (hasError) {
      notification.error(
        <>
          <p className="font-bold mt-0 mb-1">Cannot connect to local provider</p>
          <p className="m-0">
            - Did you forget to run <code className="italic bg-base-300 text-base font-bold">yarn chain</code>?
          </p>
          <p className="mt-1 break-normal">
            - Or you can change <code className="italic bg-base-300 text-base font-bold">targetNetwork</code> in{" "}
            <code className="italic bg-base-300 text-base font-bold">scaffold.config.ts</code>
          </p>
        </>,
      );
    }
  }, [hasError]);

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="mb-8 border border-slate-200 bg-white border-t-2 border-t-slate-900">
        <div className="bg-slate-950 px-6 py-3">
          <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase">Explorer // Transaction_Log</p>
        </div>
        <div className="flex items-end justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="font-mono text-xl font-bold text-slate-900 uppercase tracking-tight">Block Explorer</h1>
            <p className="text-sm text-slate-500 mt-1 leading-6">Local transaction history for the Hardhat fork.</p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Block {totalBlocks?.toString() ?? "–"}</span>
          </div>
        </div>
      </div>

      <SearchBar />
      <TransactionsTable blocks={blocks} transactionReceipts={transactionReceipts} />
      <PaginationButton currentPage={currentPage} totalItems={Number(totalBlocks)} setCurrentPage={setCurrentPage} />
    </div>
  );
};

export default BlockExplorer;
