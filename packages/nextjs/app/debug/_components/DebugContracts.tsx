"use client";

import { useEffect, useMemo } from "react";
import { ContractUI } from "./ContractUI";
import "@scaffold-ui/debug-contracts/styles.css";
import { useSessionStorage } from "usehooks-ts";
import { BarsArrowUpIcon } from "@heroicons/react/20/solid";
import { ContractName, GenericContract } from "~~/utils/scaffold-eth/contract";
import { useAllContracts } from "~~/utils/scaffold-eth/contractsData";

const selectedContractStorageKey = "scaffoldEth2.selectedContract";

export function DebugContracts() {
  const contractsData = useAllContracts();
  const contractNames = useMemo(
    () =>
      Object.keys(contractsData).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
      }) as ContractName[],
    [contractsData],
  );

  const [selectedContract, setSelectedContract] = useSessionStorage<ContractName>(
    selectedContractStorageKey,
    contractNames[0],
    { initializeWithValue: false },
  );

  useEffect(() => {
    if (!contractNames.includes(selectedContract)) {
      setSelectedContract(contractNames[0]);
    }
  }, [contractNames, selectedContract, setSelectedContract]);

  if (contractNames.length === 0) {
    return (
      <div className="border border-slate-200 bg-slate-50 p-12 text-center">
        <p className="font-mono text-xs text-slate-400 uppercase tracking-wider">[ No contracts found ]</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-6 lg:gap-y-8">
      {/* Contract selector tabs */}
      {contractNames.length > 1 && (
        <div className="flex border-b border-slate-200 flex-wrap gap-x-0">
          {contractNames.map(contractName => (
            <button
              key={contractName}
              onClick={() => setSelectedContract(contractName)}
              className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] px-5 py-3 border-b-2 transition-colors ${
                contractName === selectedContract
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {contractName}
              {(contractsData[contractName] as GenericContract)?.external && (
                <span className="tooltip tooltip-top" data-tip="External contract">
                  <BarsArrowUpIcon className="h-3 w-3 text-[#0ea5a5]" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {contractNames.map(
        contractName =>
          contractName === selectedContract && <ContractUI key={contractName} contractName={contractName} />,
      )}
    </div>
  );
}
