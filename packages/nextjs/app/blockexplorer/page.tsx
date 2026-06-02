"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { hardhat } from "viem/chains";
import { useFetchBlocks } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { notification } from "~~/utils/scaffold-eth";

const BlockExplorer: NextPage = () => {
  const { error } = useFetchBlocks();
  const { targetNetwork } = useTargetNetwork();
  const [isLocalNetwork, setIsLocalNetwork] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (targetNetwork.id !== hardhat.id) {
      setIsLocalNetwork(false);
    }
  }, [targetNetwork.id]);

  useEffect(() => {
    if (targetNetwork.id === hardhat.id && error) {
      setHasError(true);
    }
  }, [targetNetwork.id, error]);

  useEffect(() => {
    if (!isLocalNetwork) {
      notification.error(
        <>
          <p className="font-bold mt-0 mb-1">
            <code className="italic bg-base-300 text-base font-bold"> targetNetwork </code> is not localhost
          </p>
          <p className="m-0">
            - You are on <code className="italic bg-base-300 text-base font-bold">{targetNetwork.name}</code> .This
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
            - Did you forget to run <code className="italic bg-base-300 text-base font-bold">yarn chain</code> ?
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
    <div className="container mx-auto my-10">
      <div className="border border-slate-300 bg-white p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-700">Marketplace</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Available agents</h2>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-xs">
            <thead>
              <tr className="text-left">
                <th className="py-2 px-2 text-slate-600">Name</th>
                <th className="py-2 px-2 text-slate-600">Description</th>
                <th className="py-2 px-2 text-slate-600">Price (USDC)</th>
                <th className="py-2 px-2 text-slate-600">Owner</th>
                <th className="py-2 px-2 text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  name: "Demo Assistant",
                  desc: "General purpose assistant",
                  price: "10.00",
                  owner: "0xabc...123",
                  status: "Active",
                },
                {
                  name: "Data Miner",
                  desc: "Large-scale data extractor",
                  price: "25.00",
                  owner: "0xdef...456",
                  status: "Active",
                },
                {
                  name: "Image Labeler",
                  desc: "Automated image labelling",
                  price: "15.00",
                  owner: "0x987...fed",
                  status: "Inactive",
                },
              ].map(a => (
                <tr key={a.name} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-2 font-medium text-slate-900">{a.name}</td>
                  <td className="py-2 px-2 text-slate-700 truncate">{a.desc}</td>
                  <td className="py-2 px-2 text-slate-900">{a.price}</td>
                  <td className="py-2 px-2 text-slate-700 font-mono">{a.owner}</td>
                  <td className="py-2 px-2 text-slate-700">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BlockExplorer;
