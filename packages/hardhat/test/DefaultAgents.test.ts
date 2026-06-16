import { expect } from "chai";
import { getAddress, parseUnits } from "ethers";
import {
  DEFAULT_AGENTS,
  DEFAULT_AGENT_PRICES,
  buildAgentMetadata,
  extractAgentNameFromUri,
  extractSeededAgentNames,
  isInvalidPageError,
  resolveDefaultAgentOwner,
} from "../utils/defaultAgents";

const BASE64_DATA_URI_PREFIX = "data:application/json;base64,";

// Real-world fixture URIs (ipfs link, EIP-8004 base64 example, empty JSON)
const IPFS_URI = "https://ipfs.io/ipfs/QmR27Uj29ogrBwYWty8iKCRhesYzcKVFczLWHbiBKZF9B5";
const EMPTY_JSON_URI = "data:application/json;base64,e30=";
const SEEDED_AGENT_URI =
  "data:application/json;base64,eyJ0eXBlIjoiaHR0cHM6Ly9laXBzLmV0aGVyZXVtLm9yZy9FSVBTL2VpcC04MDA0I3JlZ2lzdHJhdGlvbi12MSIsIm5hbWUiOiJteUFnZW50TmFtZSIsImRlc2NyaXB0aW9uIjoiQSBuYXR1cmFsIGxhbmd1YWdlIGRlc2NyaXB0aW9uIG9mIHRoZSBBZ2VudCwgd2hpY2ggTUFZIGluY2x1ZGUgd2hhdCBpdCBkb2VzLCBob3cgaXQgd29ya3MsIHByaWNpbmcsIGFuZCBpbnRlcmFjdGlvbiBtZXRob2RzIiwiaW1hZ2UiOiJodHRwczovL2V4YW1wbGUuY29tL2FnZW50aW1hZ2UucG5nIiwic2VydmljZXMiOlt7Im5hbWUiOiJ3ZWIiLCJlbmRwb2ludCI6Imh0dHBzOi8vd2ViLmFnZW50eHl6LmNvbS8ifSx7Im5hbWUiOiJBMkEiLCJlbmRwb2ludCI6Imh0dHBzOi8vYWdlbnQuZXhhbXBsZS8ud2VsbC1rbm93bi9hZ2VudC1jYXJkLmpzb24iLCJ2ZXJzaW9uIjoiMC4zLjAifSx7Im5hbWUiOiJlbWFpbCIsImVuZHBvaW50IjoibWFpbEBteWFnZW50LmNvbSJ9XSwieDQwMlN1cHBvcnQiOmZhbHNlLCJhY3RpdmUiOnRydWUsInJlZ2lzdHJhdGlvbnMiOlt7ImFnZW50SWQiOjIyLCJhZ2VudFJlZ2lzdHJ5Ijoie25hbWVzcGFjZX06e2NoYWluSWR9OntpZGVudGl0eVJlZ2lzdHJ5fSJ9XSwic3VwcG9ydGVkVHJ1c3QiOlsicmVwdXRhdGlvbiIsImNyeXB0by1lY29ub21pYyIsInRlZS1hdHRlc3RhdGlvbiJdfQ==";
const MALFORMED_BASE64_URI = "data:application/json;base64,!!!not-base64-json!!!";

const VALID_ADDRESS = "0x8da91A6298eA5d1A8Bc985e99798fd0A0f05701a";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function decodeMetadata(uri: string): Record<string, any> {
  expect(uri.startsWith(BASE64_DATA_URI_PREFIX), `expected base64 data URI, got: ${uri.slice(0, 40)}`).to.equal(true);
  return JSON.parse(Buffer.from(uri.slice(BASE64_DATA_URI_PREFIX.length), "base64").toString("utf8"));
}

describe("defaultAgents helpers", () => {
  describe("resolveDefaultAgentOwner", () => {
    it("returns the checksummed owner with fallback=false for a valid checksummed address", () => {
      expect(resolveDefaultAgentOwner(VALID_ADDRESS)).to.deep.equal({
        owner: getAddress(VALID_ADDRESS),
        fallback: false,
      });
    });

    it("accepts a lowercase address and normalizes it to checksum form", () => {
      const result = resolveDefaultAgentOwner(VALID_ADDRESS.toLowerCase());
      expect(result).to.deep.equal({ owner: getAddress(VALID_ADDRESS), fallback: false });
    });

    it("trims surrounding whitespace before validating", () => {
      const result = resolveDefaultAgentOwner(`  ${VALID_ADDRESS}\n`);
      expect(result).to.deep.equal({ owner: getAddress(VALID_ADDRESS), fallback: false });
    });

    it("falls back to deployer ownership when the env var is unset", () => {
      expect(resolveDefaultAgentOwner(undefined)).to.deep.equal({ owner: null, fallback: true });
    });

    it("falls back to deployer ownership when the env var is empty", () => {
      expect(resolveDefaultAgentOwner("")).to.deep.equal({ owner: null, fallback: true });
    });

    it("falls back to deployer ownership when the env var is whitespace-only", () => {
      expect(resolveDefaultAgentOwner("   \t ")).to.deep.equal({ owner: null, fallback: true });
    });

    it("throws naming DEFAULT_AGENT_OWNER_ADDRESS and the rejected value for a malformed address", () => {
      expect(() => resolveDefaultAgentOwner("not-an-address"))
        .to.throw(Error)
        .with.property("message")
        .that.includes("DEFAULT_AGENT_OWNER_ADDRESS")
        .and.includes("not-an-address");
    });

    it("throws an explicit zero-address error for the zero address", () => {
      expect(() => resolveDefaultAgentOwner(ZERO_ADDRESS))
        .to.throw(Error)
        .with.property("message")
        .that.includes("DEFAULT_AGENT_OWNER_ADDRESS")
        .and.includes("zero address");
    });
  });

  describe("DEFAULT_AGENTS and prices", () => {
    it("defines both core agents", () => {
      expect([...DEFAULT_AGENTS]).to.deep.equal(["analyze", "summarize"]);
    });

    it("prices agents in USDC 6-decimal units (analyze 0.02, summarize 0.01)", () => {
      expect(DEFAULT_AGENT_PRICES.analyze).to.equal(parseUnits("0.02", 6));
      expect(DEFAULT_AGENT_PRICES.analyze).to.equal(20000n);
      expect(DEFAULT_AGENT_PRICES.summarize).to.equal(parseUnits("0.01", 6));
      expect(DEFAULT_AGENT_PRICES.summarize).to.equal(10000n);
    });
  });

  describe("buildAgentMetadata", () => {
    const BASE_URL = "http://localhost:3000";

    it("returns a base64 data URI that round-trips to EIP-8004 JSON for analyze", () => {
      const metadata = decodeMetadata(buildAgentMetadata("analyze", BASE_URL));
      expect(metadata.type).to.equal("https://eips.ethereum.org/EIPS/eip-8004#registration-v1");
      expect(metadata.name).to.equal("analyze");
      expect(metadata.description).to.be.a("string").and.have.length.greaterThan(0);
      expect(metadata.active).to.equal(true);
      expect(metadata.services).to.deep.include({
        name: "web",
        endpoint: "http://localhost:3000/api/demoagents/analyze",
      });
    });

    it("returns a base64 data URI with the summarize endpoint for summarize", () => {
      const metadata = decodeMetadata(buildAgentMetadata("summarize", BASE_URL));
      expect(metadata.name).to.equal("summarize");
      expect(metadata.services).to.deep.include({
        name: "web",
        endpoint: "http://localhost:3000/api/demoagents/summarize",
      });
    });

    it("gives each agent a distinct name and description", () => {
      const analyze = decodeMetadata(buildAgentMetadata("analyze", BASE_URL));
      const summarize = decodeMetadata(buildAgentMetadata("summarize", BASE_URL));
      expect(analyze.name).to.not.equal(summarize.name);
      expect(analyze.description).to.not.equal(summarize.description);
    });

    it("does not produce a double slash when the base URL has a trailing slash", () => {
      const metadata = decodeMetadata(buildAgentMetadata("analyze", "http://localhost:3000/"));
      expect(metadata.services[0].endpoint).to.equal("http://localhost:3000/api/demoagents/analyze");
    });
  });

  describe("extractSeededAgentNames", () => {
    it("extracts names only from valid base64 data URIs in a mixed list", () => {
      const names = extractSeededAgentNames([IPFS_URI, SEEDED_AGENT_URI, MALFORMED_BASE64_URI, EMPTY_JSON_URI]);
      expect([...names]).to.deep.equal(["myAgentName"]);
    });

    it("detects both core agents from URIs produced by buildAgentMetadata", () => {
      const names = extractSeededAgentNames([
        buildAgentMetadata("analyze", "http://localhost:3000"),
        IPFS_URI,
        buildAgentMetadata("summarize", "http://localhost:3000"),
      ]);
      expect(names.has("analyze")).to.equal(true);
      expect(names.has("summarize")).to.equal(true);
      expect(names.size).to.equal(2);
    });

    it("returns an empty set when no URI carries decodable metadata", () => {
      const names = extractSeededAgentNames([IPFS_URI, MALFORMED_BASE64_URI, EMPTY_JSON_URI]);
      expect(names.size).to.equal(0);
    });
  });

  describe("isInvalidPageError", () => {
    it("matches when the node decoded the custom error name into the message", () => {
      const error = new Error("VM Exception while processing transaction: reverted with custom error 'InvalidPage()'");
      expect(isInvalidPageError(error)).to.equal(true);
    });

    it("matches the undecoded CI shape where only the selector appears in the message", () => {
      const error = new Error(
        "VM Exception while processing transaction: reverted with an unrecognized custom error (return data: 0x9ee31996)",
      );
      expect(isInvalidPageError(error)).to.equal(true);
    });

    it("matches when the selector arrives as revert data on the error object", () => {
      const error = Object.assign(new Error("execution reverted"), { data: "0x9ee31996" });
      expect(isInvalidPageError(error)).to.equal(true);
    });

    it("matches when the revert data is nested in a wrapped provider error", () => {
      const error = Object.assign(new Error("could not coalesce error"), {
        error: { data: "0x9ee31996" },
      });
      expect(isInvalidPageError(error)).to.equal(true);
    });

    it("rejects unrelated errors and foreign selectors", () => {
      expect(isInvalidPageError(new Error("connect ECONNREFUSED 127.0.0.1:8545"))).to.equal(false);
      expect(isInvalidPageError(Object.assign(new Error("execution reverted"), { data: "0xdeadbeef" }))).to.equal(
        false,
      );
      expect(isInvalidPageError("not even an error")).to.equal(false);
    });
  });

  describe("extractAgentNameFromUri", () => {
    it("returns the metadata name for a valid base64 data URI", () => {
      expect(extractAgentNameFromUri(SEEDED_AGENT_URI)).to.equal("myAgentName");
      expect(extractAgentNameFromUri(buildAgentMetadata("analyze", "http://localhost:3000"))).to.equal("analyze");
    });

    it("returns null for non-data URIs", () => {
      expect(extractAgentNameFromUri(IPFS_URI)).to.equal(null);
    });

    it("returns null for malformed base64, empty JSON, and missing name", () => {
      expect(extractAgentNameFromUri(MALFORMED_BASE64_URI)).to.equal(null);
      expect(extractAgentNameFromUri(EMPTY_JSON_URI)).to.equal(null);
    });
  });
});
