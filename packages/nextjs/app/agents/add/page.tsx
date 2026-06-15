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

export default function AddAgentPage() {
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "AgentMarketplace" });
  const [activeTab, setActiveTab] = useState<"new" | "existing">("new");
  // Local pending flag for new agent form
  const [pendingNew, setPendingNew] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // Tab 1: New Agent with agentURI
  const [price, setPrice] = useState("");
  const [agentURI, setAgentURI] = useState("");
  const [agentJSON, setAgentJSON] = useState("");
  const [message, setMessage] = useState("");

  // Wizard state
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

  const [newService, setNewService] = useState<Partial<Service>>({
    name: "A2A",
    endpoint: "",
    version: "",
  });

  // Tab 2: Existing Agent with agentID
  const [agentID, setAgentID] = useState("");
  // Local pending flag for existing form to avoid double submissions
  const [pendingExisting, setPendingExisting] = useState(false);
  const [priceExisting, setPriceExisting] = useState("");
  const [messageExisting, setMessageExisting] = useState("");

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
      // Use parseUnits to handle 6 decimals for USDC
      const priceInUnits = parseUnits(price, 6);

      const result = await writeContractAsync({
        functionName: "register",
        args: [priceInUnits, agentURI, false],
      });
      notification.success("Agent registered! tx: " + result);
      // Reset form fields after success
      setPrice("");
      setAgentURI("");
      setAgentJSON("");
    } catch (err) {
      const msg = getParsedError(err);
      notification.error(msg);
    } finally {
      setPendingNew(false);
    }
    console.log({ price, agentURI });
  };

  const onSubmitExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent double submissions
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
      // Use parseUnits to handle 6 decimals for USDC
      const priceInUnits = parseUnits(priceExisting, 6);

      const result = await writeContractAsync({
        functionName: "register",
        args: [priceInUnits, BigInt(agentID), false],
      });
      notification.success("Existing agent registered! tx: " + result);
      // Reset form fields after success
      setPriceExisting("");
      setAgentID("");

      setMessageExisting("");
    } catch (err) {
      const msg = getParsedError(err);
      notification.error(msg);
    } finally {
      setPendingExisting(false);
    }
    console.log({ agentID, priceExisting });
  };

  const handleGenerateBase64 = () => {
    try {
      const parsedJSON = JSON.parse(agentJSON);
      const jsonString = JSON.stringify(parsedJSON);
      const base64 = btoa(jsonString);
      const base64URI = `data:application/json;base64,${base64}`;
      setAgentURI(base64URI);
      setMessage("");
    } catch {
      setMessage("Invalid JSON. Please check your input.");
    }
  };

  // Wizard functions
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
    if (wizard.step === "services") {
      setWizard({ ...wizard, step: "basic" });
    } else if (wizard.step === "config") {
      setWizard({ ...wizard, step: "services" });
    } else if (wizard.step === "review") {
      setWizard({ ...wizard, step: "config" });
    }
  };

  const addService = () => {
    if (!newService.endpoint?.trim()) {
      setMessage("Please enter an endpoint");
      return;
    }
    if (newService.name === "OASF" && newService.version && !newService.skills) {
      newService.skills = [];
      newService.domains = [];
    }
    const service: Service = {
      id: Date.now().toString(),
      name: newService.name as ServiceType,
      endpoint: newService.endpoint,
      ...(newService.version && { version: newService.version }),
      ...(newService.skills && { skills: newService.skills }),
      ...(newService.domains && { domains: newService.domains }),
    };
    setWizard({
      ...wizard,
      services: [...wizard.services, service],
    });
    setNewService({ name: "A2A", endpoint: "", version: "" });
    setMessage("");
  };

  const removeService = (id: string) => {
    setWizard({
      ...wizard,
      services: wizard.services.filter(s => s.id !== id),
    });
  };

  const generateJSON = () => {
    const webService = {
      name: "web",
      endpoint: wizard.webEndpoint,
    };

    const agentObj = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: wizard.name,
      description: wizard.description,
      ...(wizard.image && { image: wizard.image }),
      services: [webService, ...wizard.services.map(({ id, ...s }) => s)],
      x402Support: wizard.x402Support,
      active: wizard.active,
    };

    const jsonString = JSON.stringify(agentObj, null, 2);
    setAgentJSON(jsonString);

    // Auto-generate Base64 URI
    const base64 = btoa(jsonString);
    const base64URI = `data:application/json;base64,${base64}`;
    setAgentURI(base64URI);

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

  return (
    <div className="container mx-auto p-4">
      <div className="card bg-base-100 shadow-md max-w-2xl mx-auto">
        <div className="card-body">
          <h1 className="card-title">🚀 Monetize Your AI Agent in 60 Seconds</h1>
          <p className="mb-4">
            Turn your LLM backend into a revenue stream on Base. No smart contract coding required. We handle the Web3
            heavy lifting while you focus on building the best prompt logic.
          </p>

          <ul className="list-disc pl-5 space-y-2 mb-6">
            <li>
              <strong>Set your rate:</strong> Define a fixed price in USDC per API call.
            </li>
            <li>
              <strong>Link your identity:</strong> Provide an existing ERC-8004 Agent ID or submit a new agentURI (IPFS
              or base64 JSON).
            </li>
            <li>
              <strong>Get your MarketplAIs API Key:</strong> Get your MarketplAIs API Key instantly and start earning.
            </li>
          </ul>

          {/* Tabs */}
          <div className="tabs tabs-bordered mb-4">
            <button
              className={`tab ${activeTab === "new" ? "tab-active" : ""}`}
              onClick={() => {
                setActiveTab("new");
                setMessageExisting("");
              }}
            >
              Create New Agent
            </button>
            <button
              className={`tab ${activeTab === "existing" ? "tab-active" : ""}`}
              onClick={() => {
                setActiveTab("existing");
                setMessage("");
              }}
            >
              Register Existing Agent
            </button>
          </div>

          {/* Tab 1: Create New Agent */}
          {activeTab === "new" && (
            <form onSubmit={onSubmitNew} className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">Price (USDC per call)</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="e.g. 1.00"
                />
              </div>

              <div className="divider my-2">Generate from JSON or paste URI</div>

              <div>
                <label className="label">
                  <span className="label-text">Agent JSON (optional)</span>
                </label>
                <textarea
                  value={agentJSON}
                  onChange={e => setAgentJSON(e.target.value)}
                  className="textarea textarea-bordered w-full"
                  rows={4}
                  placeholder='{"name": "My Agent", "description": "...", ...}'
                />
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setShowWizard(true)} className="btn btn-secondary btn-sm flex-1">
                    📋 Open Wizard
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateBase64}
                    className="btn btn-secondary btn-sm flex-1"
                    disabled={!agentJSON.trim()}
                  >
                    Generate Base64 agentURI
                  </button>
                </div>
              </div>

              <div>
                <label className="label">
                  <span className="label-text">agentURI</span>
                </label>
                <textarea
                  value={agentURI}
                  onChange={e => setAgentURI(e.target.value)}
                  className="textarea textarea-bordered w-full"
                  rows={4}
                  placeholder="https://... or data:application/json;base64,..."
                />
              </div>

              {message && <div className="text-error">{message}</div>}
              <div className="card-actions justify-end">
                <button type="submit" className="btn btn-primary" disabled={pendingNew}>
                  {pendingNew ? "Loading..." : "Submit"}
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Register Existing Agent */}
          {activeTab === "existing" && (
            <form onSubmit={onSubmitExisting} className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">Price (USDC per call)</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={priceExisting}
                  onChange={e => setPriceExisting(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="e.g. 1.00"
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">agentID (from IdentityRegistry)</span>
                </label>
                <input
                  type="number"
                  value={agentID}
                  onChange={e => setAgentID(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="e.g. 12345"
                />
              </div>

              {messageExisting && <div className="text-error">{messageExisting}</div>}

              <div className="card-actions justify-end">
                <button type="submit" className="btn btn-primary" disabled={pendingExisting}>
                  {pendingExisting ? "Loading..." : "Submit"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card bg-base-100 shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="card-body">
              <h2 className="card-title">Agent JSON Wizard</h2>

              {/* Step: Basic Info */}
              {wizard.step === "basic" && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-500">Step 1 of 4: Basic Information</div>
                  <div>
                    <label className="label">
                      <span className="label-text">Agent Name *</span>
                    </label>
                    <input
                      type="text"
                      value={wizard.name}
                      onChange={e => setWizard({ ...wizard, name: e.target.value })}
                      className="input input-bordered w-full"
                      placeholder="e.g. MyAgent"
                    />
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">Description *</span>
                    </label>
                    <textarea
                      value={wizard.description}
                      onChange={e => setWizard({ ...wizard, description: e.target.value })}
                      className="textarea textarea-bordered w-full"
                      rows={4}
                      placeholder="Describe what your agent does..."
                    />
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">Image URL (optional)</span>
                    </label>
                    <input
                      type="text"
                      value={wizard.image}
                      onChange={e => setWizard({ ...wizard, image: e.target.value })}
                      className="input input-bordered w-full"
                      placeholder="https://example.com/image.png"
                    />
                  </div>
                </div>
              )}

              {/* Step: Services */}
              {wizard.step === "services" && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-500">Step 2 of 4: Services</div>

                  {/* Web Service (Required) */}
                  <div>
                    <label className="label">
                      <span className="label-text font-bold">Web Endpoint * (Required)</span>
                    </label>
                    <input
                      type="text"
                      value={wizard.webEndpoint}
                      onChange={e => setWizard({ ...wizard, webEndpoint: e.target.value })}
                      className="input input-bordered w-full"
                      placeholder="https://web.agentxyz.com/"
                    />
                  </div>

                  {/* Additional Services */}
                  <div>
                    <h3 className="font-bold mb-3">Add Additional Services (optional)</h3>

                    <div className="space-y-3">
                      <div>
                        <label className="label">
                          <span className="label-text text-sm">Service Type</span>
                        </label>
                        <select
                          value={newService.name}
                          onChange={e =>
                            setNewService({
                              ...newService,
                              name: e.target.value as ServiceType,
                            })
                          }
                          className="select select-bordered w-full select-sm"
                        >
                          <option value="A2A">A2A</option>
                          <option value="MCP">MCP</option>
                          <option value="OASF">OASF</option>
                          <option value="ENS">ENS</option>
                          <option value="DID">DID</option>
                          <option value="email">Email</option>
                        </select>
                      </div>

                      <div>
                        <label className="label">
                          <span className="label-text text-sm">Endpoint</span>
                        </label>
                        <input
                          type="text"
                          value={newService.endpoint || ""}
                          onChange={e => setNewService({ ...newService, endpoint: e.target.value })}
                          className="input input-bordered w-full input-sm"
                          placeholder="e.g. https://api.example.com"
                        />
                      </div>

                      <div>
                        <label className="label">
                          <span className="label-text text-sm">Version (optional)</span>
                        </label>
                        <input
                          type="text"
                          value={newService.version || ""}
                          onChange={e => setNewService({ ...newService, version: e.target.value })}
                          className="input input-bordered w-full input-sm"
                          placeholder="e.g. 0.3.0"
                        />
                      </div>

                      <button type="button" onClick={addService} className="btn btn-sm btn-outline w-full">
                        + Add Service
                      </button>
                    </div>
                  </div>

                  {/* List of added services */}
                  {wizard.services.length > 0 && (
                    <div>
                      <h3 className="font-bold mb-2">Added Services:</h3>
                      <div className="space-y-2">
                        {wizard.services.map(service => (
                          <div
                            key={service.id}
                            className="p-3 rounded border border-gray-300 flex justify-between items-start"
                          >
                            <div className="flex-1">
                              <p className="font-semibold">{service.name}</p>
                              <p className="text-xs">{service.endpoint}</p>
                              {service.version && <p className="text-xs">v{service.version}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeService(service.id)}
                              className="btn btn-xs btn-ghost"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step: Configuration */}
              {wizard.step === "config" && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-500">Step 3 of 4: Configuration</div>

                  <div className="form-control">
                    <label className="label cursor-pointer">
                      <span className="label-text">x402 Support (payment gating)</span>
                      <input
                        type="checkbox"
                        checked={wizard.x402Support}
                        onChange={e => setWizard({ ...wizard, x402Support: e.target.checked })}
                        className="checkbox"
                      />
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label cursor-pointer">
                      <span className="label-text">Agent is Active</span>
                      <input
                        type="checkbox"
                        checked={wizard.active}
                        onChange={e => setWizard({ ...wizard, active: e.target.checked })}
                        className="checkbox"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Step: Review */}
              {wizard.step === "review" && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-500">Step 4 of 4: Review</div>
                  <pre className="p-4 rounded text-xs overflow-auto max-h-96 border border-gray-300">
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

              {/* Messages */}
              {message && <div className="text-error text-sm">{message}</div>}

              {/* Navigation Buttons */}
              <div className="card-actions justify-between mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowWizard(false);
                    setMessage("");
                  }}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>

                <div className="flex gap-2">
                  {wizard.step !== "basic" && (
                    <button type="button" onClick={goBackWizardStep} className="btn btn-outline">
                      Back
                    </button>
                  )}

                  {wizard.step !== "review" && (
                    <button type="button" onClick={advanceWizardStep} className="btn btn-primary">
                      Next
                    </button>
                  )}

                  {wizard.step === "review" && (
                    <button type="button" onClick={generateJSON} className="btn btn-success">
                      Generate JSON
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
