import { TransactionHash } from "./TransactionHash";
import { Address } from "@scaffold-ui/components";
import { formatEther } from "viem";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { TransactionWithFunction } from "~~/utils/scaffold-eth";
import { TransactionsTableProps } from "~~/utils/scaffold-eth/";

const thCls =
  "font-mono text-[9px] uppercase tracking-[0.18em] text-white bg-slate-900 px-4 py-3 text-left font-normal";
const tdCls = "px-4 py-3 font-mono text-[11px] text-slate-600 border-b border-slate-100";

export const TransactionsTable = ({ blocks, transactionReceipts }: TransactionsTableProps) => {
  const { targetNetwork } = useTargetNetwork();

  return (
    <div className="overflow-x-auto border border-slate-200 mb-4">
      <table className="w-full text-sm bg-white">
        <thead>
          <tr>
            <th className={thCls}>Transaction Hash</th>
            <th className={thCls}>Function Called</th>
            <th className={thCls}>Block</th>
            <th className={thCls}>Time Mined</th>
            <th className={thCls}>From</th>
            <th className={thCls}>To</th>
            <th className={`${thCls} text-right`}>Value ({targetNetwork.nativeCurrency.symbol})</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map(block =>
            (block.transactions as TransactionWithFunction[]).map(tx => {
              const receipt = transactionReceipts[tx.hash];
              const timeMined = new Date(Number(block.timestamp) * 1000).toLocaleString();
              const functionCalled = tx.input.substring(0, 10);

              return (
                <tr key={tx.hash} className="hover:bg-slate-50 transition-colors">
                  <td className={tdCls}>
                    <TransactionHash hash={tx.hash} />
                  </td>
                  <td className={tdCls}>
                    {tx.functionName !== "0x" && <span className="mr-1 text-slate-700">{tx.functionName}</span>}
                    {functionCalled !== "0x" && (
                      <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5">
                        {functionCalled}
                      </span>
                    )}
                  </td>
                  <td className={tdCls}>{block.number?.toString()}</td>
                  <td className={tdCls}>{timeMined}</td>
                  <td className={tdCls}>
                    <Address address={tx.from} size="sm" onlyEnsOrAddress chain={targetNetwork} />
                  </td>
                  <td className={tdCls}>
                    {!receipt?.contractAddress ? (
                      tx.to && <Address address={tx.to} size="sm" onlyEnsOrAddress chain={targetNetwork} />
                    ) : (
                      <div className="relative">
                        <Address address={receipt.contractAddress} size="sm" onlyEnsOrAddress chain={targetNetwork} />
                        <small className="block font-mono text-[9px] text-slate-400 mt-0.5">(Contract Creation)</small>
                      </div>
                    )}
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {formatEther(tx.value)} {targetNetwork.nativeCurrency.symbol}
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
};
