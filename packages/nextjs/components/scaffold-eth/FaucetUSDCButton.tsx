"use client";

import { useState } from "react";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { CurrencyDollarIcon } from "@heroicons/react/24/outline";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

/**
 * FaucetUSDCButton button which lets you grab USDC from the faucet.
 */
export const FaucetUSDCButton = () => {
  const { address, chain: ConnectedChain } = useAccount();

  const [loading, setLoading] = useState(false);

  const { writeContractAsync } = useScaffoldWriteContract({
    contractName: "USDCFaucet",
  });

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

  return (
    <div className="ml-1 tooltip tooltip-bottom" data-tip="Grab USDC from faucet">
      <button
        className="btn btn-sm bg-slate-50 border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 rounded-none shadow-sm"
        onClick={requestUSDC}
        disabled={loading}
      >
        {!loading ? (
          <CurrencyDollarIcon className="h-4 w-4" />
        ) : (
          <span className="loading loading-spinner loading-xs"></span>
        )}
      </button>
    </div>
  );
};
