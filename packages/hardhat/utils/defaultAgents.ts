import { ZeroAddress, getAddress, id, isAddress, parseUnits } from "ethers";

const OWNER_ENV_VAR = "DEFAULT_AGENT_OWNER_ADDRESS";
const EIP_8004_REGISTRATION_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
const BASE64_DATA_URI_PREFIX = "data:application/json;base64,";

export type OwnerResolution = { owner: string | null; fallback: boolean };

/**
 * Resolves the configured default agent owner from the raw env value.
 * - unset / empty / whitespace-only → fallback to deployer ownership (caller logs the warning)
 * - malformed address → throws naming the env var and the rejected value
 * - zero address → throws an explicit zero-address error
 * - valid address → checksummed owner, no fallback
 */
export function resolveDefaultAgentOwner(raw: string | undefined): OwnerResolution {
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") {
    return { owner: null, fallback: true };
  }
  if (!isAddress(trimmed)) {
    throw new Error(`${OWNER_ENV_VAR} is not a valid address: "${trimmed}"`);
  }
  const owner = getAddress(trimmed);
  if (owner === ZeroAddress) {
    throw new Error(`${OWNER_ENV_VAR} must not be the zero address`);
  }
  return { owner, fallback: false };
}

export const DEFAULT_AGENTS = ["analyze", "summarize"] as const;
export type DefaultAgentName = (typeof DEFAULT_AGENTS)[number];

// USDC 6-decimal prices, aligned with DEFAULT_AGENT_PRICE_MICRO_USDC in the analyze route.
export const DEFAULT_AGENT_PRICES: Record<DefaultAgentName, bigint> = {
  analyze: parseUnits("0.02", 6),
  summarize: parseUnits("0.01", 6),
};

const AGENT_DESCRIPTIONS: Record<DefaultAgentName, string> = {
  analyze: "Core marketplace agent that analyzes a text payload and returns structured insights.",
  summarize: "Core marketplace agent that produces a concise summary of a text payload.",
};

/**
 * Builds the EIP-8004 registration metadata for a core agent and returns it
 * as a `data:application/json;base64,...` token URI.
 */
export function buildAgentMetadata(name: DefaultAgentName, baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const metadata = {
    type: EIP_8004_REGISTRATION_TYPE,
    name,
    description: AGENT_DESCRIPTIONS[name],
    services: [{ name: "web", endpoint: `${normalizedBaseUrl}/api/demoagents/${name}` }],
    x402Support: false,
    active: true,
    // agentId is only known after registration; kept empty at build time.
    registrations: [],
    supportedTrust: ["reputation"],
  };
  return `${BASE64_DATA_URI_PREFIX}${Buffer.from(JSON.stringify(metadata), "utf8").toString("base64")}`;
}

// 4-byte selector of AgentMarketplace's InvalidPage() custom error (0x9ee31996).
const INVALID_PAGE_SELECTOR = id("InvalidPage()").slice(0, 10);

/**
 * Detects an `InvalidPage()` revert from `getAgentsFullPaginated` regardless of
 * whether the node could decode the error name. The decoded name only appears
 * when the node holds compiled artifacts (NOT the case in CI, where the chain
 * starts before compilation), so we also match the raw 4-byte selector in the
 * message and in the revert data of the error or its wrapped causes.
 */
export function isInvalidPageError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const {
      message,
      data,
      error: inner,
      cause,
    } = current as {
      message?: unknown;
      data?: unknown;
      error?: unknown;
      cause?: unknown;
    };
    if (typeof message === "string" && (message.includes("InvalidPage") || message.includes(INVALID_PAGE_SELECTOR))) {
      return true;
    }
    if (typeof data === "string" && data.startsWith(INVALID_PAGE_SELECTOR)) {
      return true;
    }
    current = inner ?? cause;
  }
  return false;
}

/**
 * Extracts the metadata `name` from a single token URI.
 * Tolerant by design: non-data URIs (e.g. ipfs links), malformed base64/JSON
 * payloads, and metadata without a name return null instead of throwing.
 */
export function extractAgentNameFromUri(uri: string): string | null {
  if (!uri.startsWith(BASE64_DATA_URI_PREFIX)) return null;
  try {
    const json = Buffer.from(uri.slice(BASE64_DATA_URI_PREFIX.length), "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    const name = (parsed as { name?: unknown })?.name;
    return typeof name === "string" && name.length > 0 ? name : null;
  } catch {
    // Malformed base64 or JSON — not a seeded agent URI.
    return null;
  }
}

/**
 * Extracts metadata `name` values from a list of token URIs.
 * Tolerant by design: URIs without a decodable name are skipped.
 */
export function extractSeededAgentNames(uris: string[]): Set<string> {
  const names = new Set<string>();
  for (const uri of uris) {
    const name = extractAgentNameFromUri(uri);
    if (name !== null) {
      names.add(name);
    }
  }
  return names;
}
