import { TransactionHash } from "./TransactionHash";
import { Address } from "@scaffold-ui/components";
import { formatEther } from "viem";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { TransactionWithFunction } from "~~/utils/scaffold-eth";
import { TransactionsTableProps } from "~~/utils/scaffold-eth/";

export const TransactionsTable = ({ blocks, transactionReceipts }: TransactionsTableProps) => {
  const { targetNetwork } = useTargetNetwork();

  return (
    <div className="flex justify-center px-4 md:px-0">
      <div className="overflow-x-auto w-full shadow-sm border border-slate-200 rounded-none">
        <table className="table text-xl bg-base-100 table-zebra w-full md:table-md table-sm">
          <thead>
            <tr className="text-xs text-white uppercase tracking-wider font-mono">
              <th className="bg-slate-900 py-3">Transaction Hash</th>
              <th className="bg-slate-900 py-3">Function Called</th>
              <th className="bg-slate-900 py-3">Block Number</th>
              <th className="bg-slate-900 py-3">Time Mined</th>
              <th className="bg-slate-900 py-3">From</th>
              <th className="bg-slate-900 py-3">To</th>
              <th className="bg-slate-900 py-3 text-end">Value ({targetNetwork.nativeCurrency.symbol})</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map(block =>
              (block.transactions as TransactionWithFunction[]).map(tx => {
                const receipt = transactionReceipts[tx.hash];
                const timeMined = new Date(Number(block.timestamp) * 1000).toLocaleString();
                const functionCalled = tx.input.substring(0, 10);

                return (
                  <tr key={tx.hash} className="hover text-sm border-t border-slate-100">
                    <td className="w-1/12 md:py-4">
                      <TransactionHash hash={tx.hash} />
                    </td>
                    <td className="w-2/12 md:py-4">
                      {tx.functionName === "0x" ? (
                        ""
                      ) : (
                        <span className="mr-1 font-mono text-xs">{tx.functionName}</span>
                      )}
                      {functionCalled !== "0x" && (
                        <span className="font-mono border border-slate-200 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-none text-xs">
                          {functionCalled}
                        </span>
                      )}
                    </td>
                    <td className="w-1/12 md:py-4 font-mono">{block.number?.toString()}</td>
                    <td className="w-2/12 md:py-4 font-mono">{timeMined}</td>
                    <td className="w-2/12 md:py-4">
                      <Address address={tx.from} size="sm" onlyEnsOrAddress chain={targetNetwork} />
                    </td>
                    <td className="w-2/12 md:py-4">
                      {!receipt?.contractAddress ? (
                        tx.to && <Address address={tx.to} size="sm" onlyEnsOrAddress chain={targetNetwork} />
                      ) : (
                        <div className="relative">
                          <Address address={receipt.contractAddress} size="sm" onlyEnsOrAddress chain={targetNetwork} />
                          <small className="absolute top-4 left-4 font-mono text-[9px] text-slate-400">
                            (Contract Creation)
                          </small>
                        </div>
                      )}
                    </td>
                    <td className="text-right md:py-4 font-mono">
                      {formatEther(tx.value)} {targetNetwork.nativeCurrency.symbol}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
