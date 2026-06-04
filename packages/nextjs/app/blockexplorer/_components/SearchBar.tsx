"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress, isHex } from "viem";
import { hardhat } from "viem/chains";
import { usePublicClient } from "wagmi";

export const SearchBar = () => {
  const [searchInput, setSearchInput] = useState("");
  const router = useRouter();

  const client = usePublicClient({ chainId: hardhat.id });

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isHex(searchInput)) {
      try {
        const tx = await client?.getTransaction({ hash: searchInput });
        if (tx) {
          router.push(`/blockexplorer/transaction/${searchInput}`);
          return;
        }
      } catch (error) {
        console.error("Failed to fetch transaction:", error);
      }
    }

    if (isAddress(searchInput)) {
      router.push(`/blockexplorer/address/${searchInput}`);
      return;
    }
  };

  return (
    <form onSubmit={handleSearch} className="flex items-center justify-end mb-5 space-x-3 mx-5">
      <input
        className="border border-slate-300 bg-base-100 text-base-content placeholder:text-slate-500/50 p-2 mr-2 w-full md:w-1/2 lg:w-1/3 rounded-none shadow-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
        type="text"
        value={searchInput}
        placeholder="Search by hash or address"
        onChange={e => setSearchInput(e.target.value)}
      />
      <button
        className="btn btn-sm bg-slate-900 hover:bg-slate-800 text-white rounded-none border border-slate-900 font-mono uppercase tracking-wider text-xs px-4"
        type="submit"
      >
        Search
      </button>
    </form>
  );
};
