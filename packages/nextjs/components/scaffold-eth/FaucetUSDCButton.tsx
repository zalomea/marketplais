"use client";

import { useState } from "react";
import { useWatchBalance } from "@scaffold-ui/hooks";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { CurrencyDollarIcon } from "@heroicons/react/24/outline";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

/**
 * FaucetUSDCButton button which lets you grab USDC from the faucet.
 */
export const FaucetUSDCButton = () => {
  const { address, chain: ConnectedChain } = useAccount();

  const { data: balance } = useWatchBalance({ address, chain: hardhat });

  const [loading, setLoading] = useState(false);

  const { writeContractAsync } = useScaffoldWriteContract("USDCFaucet");

  const requestUSDC = async () => {
    if (!address) return;
    try {
      setLoading(true);
      await writeContractAsync({
        functionName: "requestTokens",
      });
      setLoading(false);
    } catch (error) {
      console.error("⚡️ ~ file: FaucetUSDCButton.tsx:requestUSDC ~ error", error);
      setLoading(false);
    }
  };

  // Render only on local chain
  if (ConnectedChain?.id !== hardhat.id) {
    return null;
  }

  const isBalanceZero = balance && balance.value === 0n;

  return (
    <div
      className={
        !isBalanceZero
          ? "ml-1"
          : "ml-1 tooltip tooltip-bottom tooltip-primary tooltip-open font-bold before:left-auto before:transform-none before:content-[attr(data-tip)] before:-translate-x-2/5"
      }
      data-tip="Grab USDC from faucet"
    >
      <button className="btn btn-secondary btn-sm px-2 rounded-full" onClick={requestUSDC} disabled={loading}>
        {!loading ? (
          <CurrencyDollarIcon className="h-4 w-4" />
        ) : (
          <span className="loading loading-spinner loading-xs"></span>
        )}
      </button>
    </div>
  );
};
