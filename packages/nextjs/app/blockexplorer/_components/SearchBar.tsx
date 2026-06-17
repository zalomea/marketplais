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
    <form onSubmit={handleSearch} className="flex items-center gap-2 mb-6">
      <input
        type="text"
        value={searchInput}
        placeholder="Search by hash or address"
        onChange={e => setSearchInput(e.target.value)}
        className="flex-1 font-mono text-sm text-slate-700 bg-white border border-slate-200 px-4 py-2.5 focus:outline-none focus:border-[#0ea5a5] transition-colors placeholder:text-slate-300"
      />
      <button
        type="submit"
        className="font-mono text-[10px] uppercase tracking-wider bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 transition-colors whitespace-nowrap"
      >
        Search
      </button>
    </form>
  );
};
