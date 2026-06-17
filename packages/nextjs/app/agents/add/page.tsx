"use client";

import React, { useState } from "react";
import { parseUnits } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

type ServiceType = "web" | "A2A" | "MCP" | "OASF" | "ENS" | "DID" | "email";

interface Service {
  id: string;
  name: ServiceType;
  endpoint: string;
  version?: string;
  skills?: string[];
  domains?: string[];
}

interface WizardState {
  step: "basic" | "services" | "config" | "review";
  name: string;
  description: string;
  image: string;
  webEndpoint: string;
  services: Service[];
  x402Support: boolean;
  active: boolean;
}

// ─── Shared field components ──────────────────────────────────────────────────

const Field = ({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
      {label}
      {required && <span className="text-[#0ea5a5] ml-1">*</span>}
      {hint && <span className="ml-2 normal-case tracking-normal text-slate-400">— {hint}</span>}
    </label>
    {children}
  </div>
);

const inputCls =
  "w-full font-mono text-sm text-slate-800 bg-white border border-slate-200 px-3 py-2.5 focus:outline-none focus:border-[#0ea5a5] transition-colors placeholder:text-slate-300";

const ErrorLine = ({ msg }: { msg: string }) => (
  <p className="font-mono text-[10px] text-red-500 uppercase tracking-wider">{msg}</p>
);

const WIZARD_STEPS = ["Basic Info", "Services", "Config", "Review"] as const;
const stepIndex = (s: WizardState["step"]) => (["basic", "services", "config", "review"] as const).indexOf(s);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddAgentPage() {
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "AgentMarketplace" });
  const [activeTab, setActiveTab] = useState<"new" | "existing">("new");
  const [pendingNew, setPendingNew] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // Tab 1 — New Agent
  const [price, setPrice] = useState("");
  const [agentURI, setAgentURI] = useState("");
  const [agentJSON, setAgentJSON] = useState("");
  const [message, setMessage] = useState("");

  // Wizard
  const [wizard, setWizard] = useState<WizardState>({
    step: "basic",
    name: "",
    description: "",
    image: "",
    webEndpoint: "",
    services: [],
    x402Support: false,
    active: true,
  });
  const [newService, setNewService] = useState<Partial<Service>>({ name: "A2A", endpoint: "", version: "" });

  // Tab 2 — Existing Agent
  const [agentID, setAgentID] = useState("");
  const [pendingExisting, setPendingExisting] = useState(false);
  const [priceExisting, setPriceExisting] = useState("");
  const [messageExisting, setMessageExisting] = useState("");

  // ── Handlers (unchanged logic) ────────────────────────────────────────────

  const onSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!price || Number(price) <= 0) {
      setMessage("Please enter a valid price");
      return;
    }
    if (!agentURI.trim()) {
      setMessage("Please enter an agentURI");
      return;
    }
    setMessage("");
    setPendingNew(true);
    try {
      const result = await writeContractAsync({
        functionName: "register",
        args: [parseUnits(price, 6), agentURI, false],
      });
      notification.success("Agent registered! tx: " + result);
      setPrice("");
      setAgentURI("");
      setAgentJSON("");
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingNew(false);
    }
  };

  const onSubmitExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingExisting) return;
    if (!priceExisting || Number(priceExisting) <= 0) {
      setMessageExisting("Please enter a valid price");
      return;
    }
    if (!agentID || Number(agentID) <= 0) {
      setMessageExisting("Please enter a valid agent ID");
      return;
    }
    setMessageExisting("");
    setPendingExisting(true);
    try {
      const result = await writeContractAsync({
        functionName: "register",
        args: [parseUnits(priceExisting, 6), BigInt(agentID), false],
      });
      notification.success("Existing agent registered! tx: " + result);
      setPriceExisting("");
      setAgentID("");
    } catch (err) {
      notification.error(getParsedError(err));
    } finally {
      setPendingExisting(false);
    }
  };

  const handleGenerateBase64 = () => {
    try {
      const base64 = btoa(JSON.stringify(JSON.parse(agentJSON)));
      setAgentURI(`data:application/json;base64,${base64}`);
      setMessage("");
    } catch {
      setMessage("Invalid JSON. Please check your input.");
    }
  };

  const advanceWizardStep = () => {
    if (wizard.step === "basic") {
      if (!wizard.name.trim() || !wizard.description.trim()) {
        setMessage("Please fill in name and description");
        return;
      }
      setMessage("");
      setWizard({ ...wizard, step: "services" });
    } else if (wizard.step === "services") {
      if (!wizard.webEndpoint.trim()) {
        setMessage("Web endpoint is required");
        return;
      }
      setMessage("");
      setWizard({ ...wizard, step: "config" });
    } else if (wizard.step === "config") {
      setMessage("");
      setWizard({ ...wizard, step: "review" });
    }
  };

  const goBackWizardStep = () => {
    if (wizard.step === "services") setWizard({ ...wizard, step: "basic" });
    else if (wizard.step === "config") setWizard({ ...wizard, step: "services" });
    else if (wizard.step === "review") setWizard({ ...wizard, step: "config" });
  };

  const addService = () => {
    if (!newService.endpoint?.trim()) {
      setMessage("Please enter an endpoint");
      return;
    }
    const service: Service = {
      id: Date.now().toString(),
      name: newService.name as ServiceType,
      endpoint: newService.endpoint,
      ...(newService.version && { version: newService.version }),
    };
    setWizard({ ...wizard, services: [...wizard.services, service] });
    setNewService({ name: "A2A", endpoint: "", version: "" });
    setMessage("");
  };

  const removeService = (id: string) => setWizard({ ...wizard, services: wizard.services.filter(s => s.id !== id) });

  const generateJSON = () => {
    const agentObj = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: wizard.name,
      description: wizard.description,
      ...(wizard.image && { image: wizard.image }),
      services: [{ name: "web", endpoint: wizard.webEndpoint }, ...wizard.services.map(({ id, ...s }) => s)],
      x402Support: wizard.x402Support,
      active: wizard.active,
    };
    const jsonString = JSON.stringify(agentObj, null, 2);
    setAgentJSON(jsonString);
    // Auto-fill the agentURI field with the base64-encoded JSON (from main #92)
    setAgentURI(`data:application/json;base64,${btoa(jsonString)}`);
    setShowWizard(false);
    setWizard({
      step: "basic",
      name: "",
      description: "",
      image: "",
      webEndpoint: "",
      services: [],
      x402Support: false,
      active: true,
    });
    setNewService({ name: "A2A", endpoint: "", version: "" });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="mb-8 border border-slate-200 bg-white border-t-2 border-t-slate-900">
        <div className="bg-slate-950 px-6 py-3">
          <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase">Add Agent // Registry</p>
        </div>
        <div className="px-6 py-5">
          <h1 className="font-mono text-xl font-bold text-slate-900 uppercase tracking-tight mb-2">
            Register Your Agent
          </h1>
          <p className="text-sm text-slate-500 leading-6">
            Turn your LLM backend into a revenue stream on Base. Set a USDC price per call, link your ERC-8004 identity,
            and start earning.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
            {[
              ["01", "Set your rate", "Fixed USDC price per API call"],
              ["02", "Link identity", "ERC-8004 Agent ID or new agentURI"],
              ["03", "Start earning", "Funds settle on-chain after each execution"],
            ].map(([num, title, desc]) => (
              <div key={num} className="space-y-1">
                <span className="font-mono text-[9px] text-[#0ea5a5] tracking-widest">{num}</span>
                <p className="font-mono text-[10px] font-bold text-slate-800 uppercase tracking-tight">{title}</p>
                <p className="text-[10px] text-slate-400 leading-4">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex border-b border-slate-200 mb-6">
        {(["new", "existing"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setMessage("");
              setMessageExisting("");
            }}
            className={`font-mono text-[10px] uppercase tracking-[0.18em] px-5 py-3 border-b-2 transition-colors ${
              activeTab === tab
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {tab === "new" ? "Create New Agent" : "Register Existing"}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Create New Agent ─────────────────────────────────── */}
      {activeTab === "new" && (
        <form onSubmit={onSubmitNew} className="space-y-6">
          <Field label="Price (USDC per call)" required>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className={inputCls}
              placeholder="e.g. 1.00"
            />
          </Field>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400">
              Generate from JSON or paste URI
            </span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <Field label="Agent JSON" hint="optional — used to generate the agentURI below">
            <textarea
              value={agentJSON}
              onChange={e => setAgentJSON(e.target.value)}
              className={`${inputCls} resize-none`}
              rows={5}
              placeholder={'{"name": "My Agent", "description": "...", ...}'}
            />
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  setShowWizard(true);
                  setMessage("");
                }}
                className="flex-1 font-mono text-[10px] uppercase tracking-wider border border-slate-200 bg-slate-50 hover:bg-slate-100 py-2 transition-colors text-slate-600"
              >
                Open Wizard ▸
              </button>
              <button
                type="button"
                onClick={handleGenerateBase64}
                disabled={!agentJSON.trim()}
                className="flex-1 font-mono text-[10px] uppercase tracking-wider border border-slate-200 bg-slate-50 hover:bg-slate-100 py-2 transition-colors text-slate-600 disabled:opacity-30"
              >
                Generate Base64 URI
              </button>
            </div>
          </Field>

          <Field label="agentURI" required hint="https://... or data:application/json;base64,...">
            <textarea
              value={agentURI}
              onChange={e => setAgentURI(e.target.value)}
              className={`${inputCls} resize-none`}
              rows={4}
              placeholder="https://... or data:application/json;base64,..."
            />
          </Field>

          {message && <ErrorLine msg={message} />}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={pendingNew}
              className="font-mono text-xs uppercase tracking-wider bg-[#0ea5a5] hover:bg-[#0d9494] text-white px-8 py-3 transition-colors disabled:opacity-40"
            >
              {pendingNew ? <span className="loading loading-spinner loading-xs" /> : "Register Agent ▸"}
            </button>
          </div>
        </form>
      )}

      {/* ── Tab 2: Register Existing Agent ─────────────────────────── */}
      {activeTab === "existing" && (
        <form onSubmit={onSubmitExisting} className="space-y-6">
          <Field label="Price (USDC per call)" required>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={priceExisting}
              onChange={e => setPriceExisting(e.target.value)}
              className={inputCls}
              placeholder="e.g. 1.00"
            />
          </Field>

          <Field label="Agent ID" hint="token ID from the IdentityRegistry" required>
            <input
              type="number"
              value={agentID}
              onChange={e => setAgentID(e.target.value)}
              className={inputCls}
              placeholder="e.g. 55216"
            />
          </Field>

          {messageExisting && <ErrorLine msg={messageExisting} />}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={pendingExisting}
              className="font-mono text-xs uppercase tracking-wider bg-[#0ea5a5] hover:bg-[#0d9494] text-white px-8 py-3 transition-colors disabled:opacity-40"
            >
              {pendingExisting ? <span className="loading loading-spinner loading-xs" /> : "Register Agent ▸"}
            </button>
          </div>
        </form>
      )}

      {/* ── Wizard Modal ────────────────────────────────────────────── */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl">
            {/* Modal header band */}
            <div className="flex items-center justify-between bg-slate-950 px-5 py-3 shrink-0">
              <div>
                <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase">
                  Wizard // Step {stepIndex(wizard.step) + 1} of 4 — {WIZARD_STEPS[stepIndex(wizard.step)]}
                </p>
                <p className="font-mono text-sm font-bold text-white mt-0.5">Agent JSON Builder</p>
              </div>
              <button
                onClick={() => {
                  setShowWizard(false);
                  setMessage("");
                }}
                className="font-mono text-slate-400 hover:text-white text-lg leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Step progress bar */}
            <div className="flex shrink-0">
              {WIZARD_STEPS.map((label, i) => (
                <div
                  key={label}
                  className={`flex-1 h-0.5 transition-colors ${
                    i <= stepIndex(wizard.step) ? "bg-[#0ea5a5]" : "bg-slate-100"
                  }`}
                />
              ))}
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              {/* Step 1: Basic Info */}
              {wizard.step === "basic" && (
                <>
                  <Field label="Agent Name" required>
                    <input
                      type="text"
                      value={wizard.name}
                      onChange={e => setWizard({ ...wizard, name: e.target.value })}
                      className={inputCls}
                      placeholder="e.g. MyAgent"
                    />
                  </Field>
                  <Field label="Description" required>
                    <textarea
                      value={wizard.description}
                      onChange={e => setWizard({ ...wizard, description: e.target.value })}
                      className={`${inputCls} resize-none`}
                      rows={4}
                      placeholder="Describe what your agent does..."
                    />
                  </Field>
                  <Field label="Image URL" hint="optional">
                    <input
                      type="text"
                      value={wizard.image}
                      onChange={e => setWizard({ ...wizard, image: e.target.value })}
                      className={inputCls}
                      placeholder="https://example.com/image.png"
                    />
                  </Field>
                </>
              )}

              {/* Step 2: Services */}
              {wizard.step === "services" && (
                <>
                  <Field label="Web Endpoint" required hint="primary HTTP endpoint">
                    <input
                      type="text"
                      value={wizard.webEndpoint}
                      onChange={e => setWizard({ ...wizard, webEndpoint: e.target.value })}
                      className={inputCls}
                      placeholder="https://web.agentxyz.com/"
                    />
                  </Field>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400">
                      Additional services (optional)
                    </span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Service Type">
                        <select
                          value={newService.name}
                          onChange={e => setNewService({ ...newService, name: e.target.value as ServiceType })}
                          className={inputCls}
                        >
                          {(["A2A", "MCP", "OASF", "ENS", "DID", "email"] as ServiceType[]).map(t => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Version" hint="optional">
                        <input
                          type="text"
                          value={newService.version || ""}
                          onChange={e => setNewService({ ...newService, version: e.target.value })}
                          className={inputCls}
                          placeholder="0.3.0"
                        />
                      </Field>
                    </div>
                    <Field label="Endpoint">
                      <input
                        type="text"
                        value={newService.endpoint || ""}
                        onChange={e => setNewService({ ...newService, endpoint: e.target.value })}
                        className={inputCls}
                        placeholder="https://api.example.com"
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={addService}
                      className="w-full font-mono text-[10px] uppercase tracking-wider border border-dashed border-slate-300 hover:border-[#0ea5a5] hover:text-[#0ea5a5] py-2.5 transition-colors text-slate-500"
                    >
                      + Add Service
                    </button>
                  </div>

                  {/* Added services list */}
                  {wizard.services.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">Added services</p>
                      {wizard.services.map(service => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between border border-slate-100 bg-slate-50 px-4 py-3"
                        >
                          <div>
                            <span className="font-mono text-[10px] font-bold text-[#0ea5a5] uppercase tracking-wider">
                              {service.name}
                            </span>
                            <p className="font-mono text-[10px] text-slate-500 mt-0.5">{service.endpoint}</p>
                            {service.version && (
                              <p className="font-mono text-[9px] text-slate-400">v{service.version}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeService(service.id)}
                            className="font-mono text-slate-400 hover:text-red-500 text-xs transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Step 3: Configuration */}
              {wizard.step === "config" && (
                <div className="space-y-4">
                  {(
                    [
                      { key: "x402Support", label: "x402 Support", hint: "Enable payment gating via HTTP 402" },
                      {
                        key: "active",
                        label: "Agent Active",
                        hint: "Whether the agent accepts executions immediately",
                      },
                    ] as { key: "x402Support" | "active"; label: string; hint: string }[]
                  ).map(({ key, label, hint }) => {
                    const checked = wizard[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setWizard({ ...wizard, [key]: !checked })}
                        className="flex items-center justify-between w-full border border-slate-100 bg-slate-50 px-5 py-4 hover:border-slate-200 transition-colors text-left"
                      >
                        <div>
                          <p className="font-mono text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                            {label}
                          </p>
                          <p className="font-mono text-[9px] text-slate-400 mt-0.5">{hint}</p>
                        </div>
                        {/* Custom sharp toggle — no DaisyUI checkbox */}
                        <div
                          className={`relative w-10 h-5 flex-shrink-0 transition-colors duration-200 ${checked ? "bg-[#0ea5a5]" : "bg-slate-200"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 4: Review */}
              {wizard.step === "review" && (
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400 mb-3">
                    Generated JSON — review before submitting
                  </p>
                  <pre className="font-mono text-[10px] text-slate-700 bg-slate-50 border border-slate-100 p-4 overflow-auto max-h-80 leading-5">
                    {JSON.stringify(
                      {
                        type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
                        name: wizard.name,
                        description: wizard.description,
                        ...(wizard.image && { image: wizard.image }),
                        services: [
                          { name: "web", endpoint: wizard.webEndpoint },
                          ...wizard.services.map(({ id, ...s }) => s),
                        ],
                        x402Support: wizard.x402Support,
                        active: wizard.active,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}

              {message && <ErrorLine msg={message} />}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowWizard(false);
                  setMessage("");
                }}
                className="font-mono text-[10px] uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                {wizard.step !== "basic" && (
                  <button
                    type="button"
                    onClick={goBackWizardStep}
                    className="font-mono text-[10px] uppercase tracking-wider border border-slate-200 px-5 py-2.5 hover:bg-slate-50 transition-colors text-slate-600"
                  >
                    ← Back
                  </button>
                )}
                {wizard.step !== "review" ? (
                  <button
                    type="button"
                    onClick={advanceWizardStep}
                    className="font-mono text-[10px] uppercase tracking-wider bg-slate-900 text-white px-5 py-2.5 hover:bg-slate-700 transition-colors"
                  >
                    Next ▸
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={generateJSON}
                    className="font-mono text-[10px] uppercase tracking-wider bg-[#0ea5a5] text-white px-5 py-2.5 hover:bg-[#0d9494] transition-colors"
                  >
                    Generate JSON ▸
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
