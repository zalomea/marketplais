"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits, isAddress, parseUnits } from "viem";
import { useSignMessage } from "wagmi";
import AgentAvatar from "~~/components/AgentAvatar";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useAgentReputation } from "~~/hooks/useAgentReputation";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentMetadata {
  name: string;
  description: string;
  image?: string;
}

interface AgentCardProps {
  agentId: bigint;
  price: bigint;
  owner: string;
  uri: string;
  active: boolean;
  /** When true, renders the management strip (balance, withdraw, manage) instead of Execute. */
  showActions?: boolean;
}

// ─── Execution stats (success/fail — NOT a 0-5 star rating) ────────────────────

const ExecutionStats = ({
  score,
  count,
  onClick,
  loading,
}: {
  score: number | null;
  count: number;
  onClick: () => void;
  loading: boolean;
}) => {
  if (loading) return <div className="h-4 w-20 bg-slate-100 animate-pulse" />;

  if (score === null || count === 0) {
    return <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">No executions yet</span>;
  }

  const successCount = Math.round(score * count);
  const failCount = count - successCount;
  const pct = Math.round(score * 100);

  return (
    <button className="flex flex-col gap-1.5 w-full text-left group" onClick={onClick}>
      <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 uppercase tracking-wider">
        <span>
          <span className="text-emerald-600 font-bold">✓ {successCount}</span>
          {failCount > 0 && <span className="text-red-500 font-bold ml-2">✗ {failCount}</span>}
          <span className="ml-2 opacity-60">· {count} runs</span>
        </span>
        <span className="group-hover:text-slate-700 transition-colors">{pct}%</span>
      </div>
      <div className="w-full h-0.5 bg-slate-100">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const AgentCard = ({ agentId, price, owner, uri, active, showActions = false }: AgentCardProps) => {
  const { score, count, feedbacks, isLoading: isLoadingReputation } = useAgentReputation(agentId);
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [metadataError, setMetadataError] = useState(false);

  // Management state (self-contained, only used when showActions=true)
  const [priceInput, setPriceInput] = useState("");
  const [newOwnerInput, setNewOwnerInput] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [payToAgentWallet, setPayToAgentWallet] = useState(false);

  // API key reveal + rotation state (only used when showActions=true)
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync: incrementNonce, isMining: isIncrementing } = useScaffoldWriteContract({
    contractName: "AgentMarketplace",
  });

  const agentIdStr = agentId.toString();
  const executionsModalId = `executions-modal-${agentIdStr}`;
  const manageModalId = `manage-modal-${agentIdStr}`;
  const transferModalId = `transfer-modal-${agentIdStr}`;

  const { data: deployedMarketplace } = useDeployedContractInfo({ contractName: "AgentMarketplace" });
  const { writeContractAsync: identityRegistry } = useScaffoldWriteContract({ contractName: "IdentityRegistry" });
  const { data: marketplaceAgent } = useScaffoldReadContract({
    contractName: "AgentMarketplace",
    functionName: "getAgent",
    args: [agentId],
  });

  const marketplaceOwner = marketplaceAgent?.owner;
  const isOutOfSync = marketplaceOwner !== undefined && owner.toLowerCase() !== marketplaceOwner.toLowerCase();

  // Withdrawable earnings held in the router for this agent (from main #90)
  const { data: balance, refetch: refetchBalance } = useScaffoldReadContract({
    contractName: "MarketplaceRouter",
    functionName: "agentBalances",
    args: [agentId],
    query: { enabled: showActions },
  });

  const { data: agentData } = useScaffoldReadContract({
    contractName: "AgentMarketplace",
    functionName: "getAgent",
    args: [agentId],
    query: { enabled: showActions },
  });

  // Sync local optimistic state with on-chain data whenever it changes.
  useEffect(() => {
    setPayToAgentWallet(agentData?.payToAgentWallet ?? false);
  }, [agentData?.payToAgentWallet]);

  const { writeContractAsync: marketplaceRouter } = useScaffoldWriteContract({ contractName: "MarketplaceRouter" });
  const { writeContractAsync: agentMarketplace } = useScaffoldWriteContract({ contractName: "AgentMarketplace" });

  const handleWithdraw = async () => {
    setPendingAction(`withdraw-${agentIdStr}`);
    try {
      await marketplaceRouter({ functionName: "withdrawAgentEarnings", args: [agentId] });
      notification.success("Earnings withdrawn");
      await refetchBalance();
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  const updatePrice = async () => {
    if (!priceInput || Number(priceInput) <= 0) {
      notification.error("Please enter a valid price");
      return;
    }
    setPendingAction(`price-${agentIdStr}`);
    try {
      await agentMarketplace({ functionName: "updatePrice", args: [agentId, parseUnits(priceInput, 6)] });
      notification.success("Agent price updated");
      (document.getElementById(manageModalId) as HTMLDialogElement)?.close();
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  const toggleStatus = async () => {
    setPendingAction(`status-${agentIdStr}`);
    try {
      await agentMarketplace({
        functionName: active ? "deactivateAgent" : "reactivateAgent",
        args: [agentId],
      });
      notification.success("Agent status updated");
      (document.getElementById(manageModalId) as HTMLDialogElement)?.close();
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  const handleSyncOwnership = async () => {
    setPendingAction(`sync-${agentIdStr}`);
    try {
      await agentMarketplace({ functionName: "syncAgentOwnership", args: [agentId] });
      notification.success("Ownership synced");
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  const handleTransfer = async () => {
    if (!isAddress(newOwnerInput)) {
      notification.error("Invalid address");
      return;
    }
    if (newOwnerInput.toLowerCase() === owner.toLowerCase()) {
      notification.error("New owner must be different");
      return;
    }
    if (!deployedMarketplace?.address) {
      notification.error("Marketplace contract not deployed");
      return;
    }

    setPendingAction(`transfer-${agentIdStr}`);
    try {
      await identityRegistry({ functionName: "approve", args: [deployedMarketplace.address, agentId] });
      await agentMarketplace({ functionName: "transferAgent", args: [agentId, newOwnerInput] });
      notification.success("Agent transferred");
      setNewOwnerInput("");
      (document.getElementById(transferModalId) as HTMLDialogElement)?.close();
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  const handleSetPaymentDestination = async (newValue: boolean) => {
    if (newValue === payToAgentWallet) return;
    setPendingAction(`destination-${agentIdStr}`);
    try {
      await agentMarketplace({ functionName: "setPaymentDestination", args: [agentId, newValue] });
      setPayToAgentWallet(newValue);
      notification.success("Payment destination updated");
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  // Prove ownership with an EIP-191 signature and fetch the derived API key.
  const handleShowApiKey = async () => {
    setPendingAction(`apikey-${agentIdStr}`);
    try {
      // Include a timestamp in the signed message so a captured signature cannot
      // be replayed to reveal the API key later.
      const timestamp = Date.now();
      const message = `Verify ownership: ${agentIdStr} at ${timestamp}`;
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/agents/reveal-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agentIdStr, signature, timestamp }),
      });
      if (res.status === 401) {
        notification.error("Invalid signature — you may not be the owner");
        return;
      }
      if (res.status === 404) {
        notification.error("Agent not found");
        return;
      }
      if (!res.ok) {
        notification.error("Failed to retrieve API key");
        return;
      }
      const data = (await res.json()) as { apiKey: string };
      setApiKey(data.apiKey);
      setKeyVisible(false);
      notification.success("API key revealed");
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  // Rotate the API key by incrementing the on-chain nonce, then force a re-reveal.
  const handleRegenerateApiKey = async () => {
    setPendingAction(`regen-${agentIdStr}`);
    try {
      await incrementNonce({ functionName: "incrementNonce", args: [agentId] });
      setApiKey(null);
      setKeyVisible(false);
      notification.success("API key rotated — reveal the new key");
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingAction(null);
    }
  };

  // Decode EIP-8004 token URI
  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoadingMeta(true);
      setMetadataError(false);
      try {
        let json = "";
        if (uri.startsWith("data:application/json;base64,")) {
          json = atob(uri.split(",")[1]);
        } else if (uri.startsWith("data:application/json,")) {
          json = decodeURIComponent(uri.split(",")[1]);
        } else if (uri.startsWith("http")) {
          json = await fetch(uri).then(r => r.text());
        } else {
          try {
            json = atob(uri);
          } catch {
            setMetadataError(true);
          }
        }
        if (json) {
          try {
            setMetadata(JSON.parse(json));
          } catch {
            setMetadataError(true);
          }
        } else if (uri !== "") {
          setMetadataError(true);
        }
      } catch {
        setMetadataError(true);
      } finally {
        setIsLoadingMeta(false);
      }
    };
    fetchMetadata();
  }, [uri, agentId]);

  const name = isLoadingMeta ? null : metadata?.name || `Agent #${agentIdStr}`;
  const description = isLoadingMeta ? null : metadata?.description || null;
  const successCount = score !== null && count > 0 ? Math.round(score * count) : 0;
  const pct = score !== null ? Math.round(score * 100) : 0;
  const busy = pendingAction !== null;

  return (
    <>
      {/* ── Card ──────────────────────────────────────────────── */}
      <div className="flex flex-col border border-slate-200 bg-white hover:border-[#0ea5a5] transition-colors duration-200 group">
        {/* Header band */}
        <div className="flex items-center justify-between bg-slate-950 px-4 py-2.5">
          <span className="font-mono text-[9px] tracking-[0.2em] text-slate-400 uppercase">
            Agent_ID // {agentIdStr.padStart(3, "0")}
          </span>
          <span
            className={`flex items-center gap-1.5 font-mono text-[9px] tracking-wider uppercase ${active ? "text-emerald-400" : "text-slate-500"}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            {active ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Avatar zone */}
        <div className="flex items-center justify-center py-6 bg-slate-50 border-b border-slate-100">
          <AgentAvatar agentId={agentId} size={88} imageUri={metadata?.image} />
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-5 flex-1">
          {/* Name + description */}
          <div>
            <h2 className="font-mono text-sm font-bold text-slate-900 uppercase tracking-tight">
              {isLoadingMeta ? <span className="inline-block h-4 w-24 bg-slate-100 animate-pulse" /> : name}
            </h2>
            {description && <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>}
            {metadataError && <p className="mt-1 text-[10px] text-red-400 font-mono">Failed to load metadata</p>}
          </div>

          {/* Data rows */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
              <span className="uppercase tracking-wider">Price</span>
              <span className="text-slate-800 font-semibold">{formatUnits(price, 6)} USDC</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
              <span className="uppercase tracking-wider">Owner</span>
              <span className="text-slate-700">
                {owner.slice(0, 6)}…{owner.slice(-4)}
              </span>
            </div>
            {isOutOfSync && (
              <div className="flex items-center justify-between font-mono text-[10px] text-amber-600">
                <span className="uppercase tracking-wider">Ownership out of sync</span>
                <button
                  type="button"
                  onClick={handleSyncOwnership}
                  disabled={busy}
                  className="font-mono text-[10px] uppercase tracking-wider text-amber-600 hover:text-amber-700 hover:underline disabled:opacity-40"
                >
                  {pendingAction === `sync-${agentIdStr}` ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    "Sync ▸"
                  )}
                </button>
              </div>
            )}
            {showActions && (
              <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                <span className="uppercase tracking-wider">Balance</span>
                <span className="text-emerald-600 font-semibold">
                  {balance !== undefined ? formatUnits(balance, 6) : "0"} USDC
                </span>
              </div>
            )}
          </div>

          {/* Execution stats */}
          <div className="border-t border-slate-100 pt-3">
            <ExecutionStats
              score={score}
              count={count}
              loading={isLoadingReputation}
              onClick={() => (document.getElementById(executionsModalId) as HTMLDialogElement)?.showModal()}
            />
          </div>

          {/* Action strip */}
          <div className="border-t border-slate-100 pt-4 mt-auto">
            {showActions ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={busy}
                  className="w-full font-mono text-xs uppercase tracking-wider bg-[#0ea5a5] hover:bg-[#0d9494] text-white py-2 transition-colors disabled:opacity-40"
                >
                  {pendingAction === `withdraw-${agentIdStr}` ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    "Withdraw earnings ▸"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => (document.getElementById(manageModalId) as HTMLDialogElement)?.showModal()}
                  className="w-full font-mono text-xs uppercase tracking-wider border border-slate-200 hover:bg-slate-50 text-slate-600 py-2 transition-colors"
                >
                  Manage
                </button>
                <button
                  type="button"
                  onClick={() => (document.getElementById(transferModalId) as HTMLDialogElement)?.showModal()}
                  disabled={busy}
                  className="w-full font-mono text-xs uppercase tracking-wider border border-red-200 hover:bg-red-50 text-red-600 py-2 transition-colors disabled:opacity-40"
                >
                  Transfer Agent
                </button>
                <button
                  type="button"
                  onClick={handleShowApiKey}
                  disabled={busy || isIncrementing}
                  className="btn btn-sm btn-outline w-full font-mono uppercase tracking-wider disabled:opacity-40"
                >
                  {pendingAction === `apikey-${agentIdStr}` ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    "Show API Key"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateApiKey}
                  disabled={busy || isIncrementing}
                  className="btn btn-sm btn-warning w-full font-mono uppercase tracking-wider disabled:opacity-40"
                >
                  {isIncrementing || pendingAction === `regen-${agentIdStr}` ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    "Regenerate API Key"
                  )}
                </button>
                {apiKey && (
                  <div className="mt-2 font-mono text-xs">
                    <div className="flex items-center justify-between gap-2 border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <span className="truncate text-slate-700">
                        {keyVisible ? apiKey : `••••••••••••••••${apiKey.slice(-4)}`}
                      </span>
                      <button type="button" onClick={() => setKeyVisible(v => !v)} className="btn btn-xs btn-ghost">
                        {keyVisible ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={active ? `/agents/execute/${agentIdStr}` : "#"}
                className={`inline-flex items-center gap-2 text-white font-mono text-xs font-semibold px-4 py-2 transition-colors ${
                  active ? "bg-[#0ea5a5] hover:bg-[#0d9494]" : "bg-slate-300 cursor-not-allowed pointer-events-none"
                }`}
              >
                {active ? "Execute ▸" : "Inactive"}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Manage modal (showActions only) ───────────────────── */}
      <dialog id={manageModalId} className="modal">
        <div className="modal-box w-11/12 max-w-md rounded-none border border-slate-200 p-0 overflow-hidden">
          <div className="flex items-center justify-between bg-slate-950 px-5 py-3">
            <p className="font-mono text-sm font-bold text-white">Manage // Agent_{agentIdStr.padStart(3, "0")}</p>
            <form method="dialog">
              <button className="font-mono text-slate-400 hover:text-white text-lg leading-none transition-colors">
                ✕
              </button>
            </form>
          </div>
          <div className="p-5 space-y-5">
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                New price (USDC)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={priceInput}
                  onChange={e => setPriceInput(e.target.value)}
                  placeholder="e.g. 1.00"
                  className="flex-1 font-mono text-sm border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:border-[#0ea5a5]"
                />
                <button
                  type="button"
                  onClick={updatePrice}
                  disabled={busy}
                  className="font-mono text-xs uppercase tracking-wider bg-slate-900 text-white px-4 py-2 hover:bg-slate-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  {pendingAction === `price-${agentIdStr}` ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    "Update ▸"
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Payment destination
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSetPaymentDestination(false)}
                  disabled={busy || pendingAction === `destination-${agentIdStr}`}
                  className={`flex-1 font-mono text-xs uppercase tracking-wider py-2 transition-colors disabled:opacity-40 ${
                    !payToAgentWallet
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Owner Wallet
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPaymentDestination(true)}
                  disabled={busy || pendingAction === `destination-${agentIdStr}`}
                  className={`flex-1 font-mono text-xs uppercase tracking-wider py-2 transition-colors disabled:opacity-40 ${
                    payToAgentWallet
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Agent Wallet
                </button>
              </div>
              {payToAgentWallet && (
                <p className="font-mono text-[10px] text-amber-600">
                  Warning: If the agent wallet is not set, withdrawals will fail until you change this setting back.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={toggleStatus}
              disabled={busy}
              className={`w-full font-mono text-xs uppercase tracking-wider py-2.5 transition-colors disabled:opacity-40 ${
                active
                  ? "border border-amber-400 text-amber-700 hover:bg-amber-50"
                  : "border border-emerald-500 text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              {pendingAction === `status-${agentIdStr}` ? (
                <span className="loading loading-spinner loading-xs" />
              ) : active ? (
                "Deactivate Agent"
              ) : (
                "Reactivate Agent"
              )}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* ── Transfer modal (showActions only) ─────────────────── */}
      <dialog id={transferModalId} className="modal">
        <div className="modal-box w-11/12 max-w-md rounded-none border border-slate-200 p-0 overflow-hidden">
          <div className="flex items-center justify-between bg-slate-950 px-5 py-3">
            <p className="font-mono text-sm font-bold text-white">Transfer // Agent_{agentIdStr.padStart(3, "0")}</p>
            <form method="dialog">
              <button className="font-mono text-slate-400 hover:text-white text-lg leading-none transition-colors">
                ✕
              </button>
            </form>
          </div>
          <div className="p-5 space-y-5">
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                New owner address
              </label>
              <input
                type="text"
                value={newOwnerInput}
                onChange={e => setNewOwnerInput(e.target.value)}
                placeholder="0x..."
                className="w-full font-mono text-sm border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:border-[#0ea5a5]"
              />
              {newOwnerInput && !isAddress(newOwnerInput) && (
                <p className="font-mono text-[10px] text-red-500">Invalid address</p>
              )}
              {newOwnerInput && isAddress(newOwnerInput) && newOwnerInput.toLowerCase() === owner.toLowerCase() && (
                <p className="font-mono text-[10px] text-red-500">Cannot transfer to current owner</p>
              )}
            </div>
            <div className="flex gap-2">
              <form method="dialog" className="flex-1">
                <button
                  type="submit"
                  className="w-full font-mono text-xs uppercase tracking-wider border border-slate-200 hover:bg-slate-50 text-slate-600 py-2 transition-colors"
                >
                  Cancel
                </button>
              </form>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={busy || !isAddress(newOwnerInput) || newOwnerInput.toLowerCase() === owner.toLowerCase()}
                className="flex-1 font-mono text-xs uppercase tracking-wider bg-slate-900 text-white px-4 py-2 hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                {pendingAction === `transfer-${agentIdStr}` ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "Transfer ▸"
                )}
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* ── Execution history modal ───────────────────────────── */}
      <dialog id={executionsModalId} className="modal">
        <div className="modal-box w-11/12 max-w-lg rounded-none border border-slate-200 p-0 overflow-hidden">
          <div className="flex items-center justify-between bg-slate-950 px-5 py-3">
            <div>
              <p className="font-mono text-[9px] tracking-[0.2em] text-slate-400 uppercase">
                Execution History // Agent_{agentIdStr.padStart(3, "0")}
              </p>
              <p className="font-mono text-sm font-bold text-white mt-0.5">{name}</p>
            </div>
            <form method="dialog">
              <button className="font-mono text-slate-400 hover:text-white text-lg leading-none transition-colors">
                ✕
              </button>
            </form>
          </div>

          <div className="p-5 space-y-5">
            {score !== null && count > 0 ? (
              <div className="space-y-3">
                <div className="flex items-end gap-3">
                  <span className="font-mono text-4xl font-bold text-slate-900">{pct}%</span>
                  <span className="font-mono text-xs text-slate-400 mb-1.5 uppercase tracking-wider">success rate</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex gap-4 font-mono text-[11px]">
                  <span className="text-emerald-600 font-bold">✓ {successCount} successful</span>
                  {count - successCount > 0 && (
                    <span className="text-red-500 font-bold">✗ {count - successCount} failed</span>
                  )}
                  <span className="text-slate-400">{count} total</span>
                </div>
              </div>
            ) : (
              <p className="font-mono text-xs text-slate-400 uppercase tracking-wider">No executions recorded</p>
            )}

            {feedbacks.length > 0 && (
              <div className="border-t border-slate-100 pt-4 space-y-0 max-h-72 overflow-y-auto">
                {feedbacks.map((fb, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-mono text-[10px] text-slate-500">
                      {fb.client.slice(0, 6)}…{fb.client.slice(-4)}
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold ${fb.score === 1 ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {fb.score === 1 ? "✓ success" : "✗ failed"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
};
