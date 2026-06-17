# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project

**AI Agent Marketplace** built on Scaffold-ETH 2 (**Hardhat flavor only** — no `packages/foundry` exists here).

Clients pay USDC via EIP-3009 `TransferWithAuthorization` to execute AI agents. A server-side relayer locks funds in escrow, forwards the prompt to the agent's HTTP endpoint, then finalizes or refunds on-chain. Agent identity uses an external ERC-721 `IdentityRegistry`; reputation is tracked in `ReputationRegistry`. Both external registries are deployed on **Base mainnet** and are **already available on the local fork** at their mainnet addresses.

## Common Commands

```bash
# Development workflow (each in a separate terminal)
yarn chain          # Fork Base mainnet locally (hardhat node)
yarn deploy         # Deploy contracts (requires .env — see below)
yarn start          # Next.js frontend at http://localhost:3000

# Code quality
yarn lint           # Lint both packages
yarn format         # Format both packages

# Testing
yarn test           # = yarn hardhat:test (runs with REPORT_GAS=true)

# Building / verification
yarn next:build     # Build frontend
yarn compile        # Compile Solidity
yarn verify --network <network>

# Account management
yarn generate            # Generate new deployer account
yarn account:import      # Import existing private key
yarn account             # View current account info

# Deploy to live network
yarn deploy --network base    # or sepolia, mainnet, etc.

yarn vercel:yolo --prod  # Deploy frontend to Vercel
```

## Architecture

### Local Network — Base Mainnet Fork

`hardhat.config.ts` forks Base mainnet at block 47247176. The fork brings in:

| Contract | Address |
|---|---|
| IdentityRegistry (UUPS ERC-721) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ReputationRegistry (UUPS) | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

`01_deploy_faucet.ts` impersonates a USDC whale and seeds the Faucet with 1M USDC on localhost only.

### Smart Contracts

All in `packages/hardhat/contracts/`:

| File | Contract | Deploy Tag |
|---|---|---|
| `AgentMarketplace.sol` | AgentMarketplace | `AgentMarketplace` |
| `MarketplaceRouter.sol` | MarketplaceRouter | `MarketplaceRouter` |
| `USDCFaucet.sol` | USDCFaucet | `USDCFaucet` |
| `interfaces/` | IIdentityRegistry, IAgentMarketplace, IReputationRegistry, IUSDC | (not deployed) |

**AgentMarketplace** — register/deactivate/reactivate agents; delegates identity to IdentityRegistry.  
**MarketplaceRouter** — escrow logic (`lockPayment` / `finalizePayment` / `refundPayment`); has a `relayer` role and a `feeBps` (max 1000 = 10%).  
Both contracts use two-step ownership transfer with a **7-day waiting period**.

### Deploy Scripts (ordered)

```
00_mine_blocks.ts       # Local setup only
01_deploy_faucet.ts     # Tags: USDCFaucet — funds faucet on localhost
02_deploy_marketplace.ts # Tags: AgentMarketplace, MarketplaceRouter
03_fund_relayer.ts      # Tags: FundRelayer — funds relayer 1 ETH on localhost
04_register_default_agents.ts # Tags: DefaultAgents — seeds "analyze" + "summarize" agents
```

Deploy specific tag: `yarn deploy --tags AgentMarketplace`  
`DefaultAgents` **skips auto-registration on production networks** (mainnet, base, arbitrum, etc.) — core agents must be registered manually there.

### Required Environment Variables

**`packages/hardhat/.env`** (create from scratch — no template):

```bash
# REQUIRED for 02_deploy_marketplace.ts — throws without these
IDENTITY_REGISTRY_ADDRESS=0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
REPUTATION_REGISTRY_ADDRESS=0x8004BAa17C55a88189AE136b182e5fdA19dE9b63

# Optional
MARKETPLACE_FEE_BPS=1000              # default: 1000 (10%)
MARKETPLACE_TREASURY_ADDRESS=         # default: deployer
RELAYER_ADDRESS=                      # default: deployer
DEFAULT_AGENT_OWNER_ADDRESS=          # default: deployer keeps ownership
AGENT_SERVICE_BASE_URL=               # default: http://localhost:3000
ALCHEMY_API_KEY=
ETHERSCAN_V2_API_KEY=
```

**`packages/nextjs/.env.local`**:

```bash
# REQUIRED: the relayer that locks/finalizes payments server-side
RELAYER_PRIVATE_KEY=0x<64-hex-chars>  # Must be 0x-prefixed 32-byte hex

# Optional
RPC_URL=                              # Override server-side RPC
NEXT_PUBLIC_RPC_URL=                  # For localhost hardhat network
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=
```

### Gas Limit Gotcha in Deploy Scripts

Post-deploy calls (`transferOwnership`, `grantRole`, `setRelayer`) can silently inherit `blockGasLimit` and fail. Fix at the call site:

```typescript
// Preferred: estimateGas + 20% margin
const gas = await myContract.myMethod.estimateGas(arg1, arg2);
await myContract.myMethod(arg1, arg2, { gasLimit: (gas * 120n) / 100n });
```

### Payment Flow (execute API)

`POST /api/execute` is a two-phase route:

1. **Phase 1** (no payment headers) → returns HTTP 402 with EIP-3009 typed data params for the client to sign.
2. **Phase 2** (headers: `x-payment-signature`, `x-payment-nonce`, `x-payment-deadline`, `x-payment-from`) → relayer locks USDC escrow, calls agent endpoint, then calls `finalizePayment` (success) or `refundPayment` (failure).

Agent metadata is EIP-8004 compliant — a `data:application/json;base64,…` token URI with a `services[].web.endpoint` field.  
On localhost the agent endpoint (`http://…`) is allowed; in production it must be `https://`.

## Frontend Structure

Pages (`packages/nextjs/app/`):

| Route | Purpose |
|---|---|
| `/` | Home |
| `/agents` | Browse marketplace |
| `/agents/add` | Register new agent |
| `/agents/execute` | Execute an agent |
| `/agents/my` | My agents |
| `/blockexplorer` | Block explorer |
| `/debug` | Debug contracts |

API routes:
- `POST /api/execute` — payment-gated agent execution (see above)
- `POST /api/agents/analyze` — built-in analyze agent
- `POST /api/agents/summarize` — built-in summarize agent

Server-side viem client: `packages/nextjs/services/web3/viemClient.ts`  
- `publicClient` — read-only, targets first network in `scaffold.config.ts`
- `getRelayerWalletClient()` — factory (reads `RELAYER_PRIVATE_KEY` fresh each call)

### Contract Interaction Hooks

```typescript
// Read
const { data } = useScaffoldReadContract({
  contractName: "AgentMarketplace",
  functionName: "getAgent",
  args: [BigInt(agentId)],
});

// Write
const { writeContractAsync } = useScaffoldWriteContract({
  contractName: "AgentMarketplace",
});
```

Correct hook names (do NOT use the old names):
- `useScaffoldReadContract` — NOT ~~useScaffoldContractRead~~
- `useScaffoldWriteContract` — NOT ~~useScaffoldContractWrite~~

Contract artifacts:
- `packages/nextjs/contracts/deployedContracts.ts` — auto-generated on `yarn deploy`
- `packages/nextjs/contracts/externalContracts.ts` — IdentityRegistry, ReputationRegistry, USDC (manually maintained; chains 31337 and 8453 share the same addresses)

### UI & Styling

Use **DaisyUI classes** and SE-2's web3 components from `packages/nextjs/components/scaffold-eth`:

- `Address` — display addresses with ENS + explorer links
- `AddressInput` — address input with validation
- `Balance`, `EtherInput`, `IntegerInput`

Use `notification` from `~~/utils/scaffold-eth` for success/error toasts.  
Use `~~` path alias for all Next.js imports: `import { useTargetNetwork } from "~~/hooks/scaffold-eth"`.

## Code Style

| Style | Category |
|---|---|
| `UpperCamelCase` | Components, types, enums |
| `lowerCamelCase` | Variables, functions, hooks |
| `CONSTANT_CASE` | Constants, global variables |
| `snake_case` | Hardhat deploy file names |

- Use `type` over `interface`; no `T` prefix (`Address` not `TAddress`)
- Avoid explicit types where TypeScript infers

## Network Configuration

- Local target: `chains.hardhat` (in `packages/nextjs/scaffold.config.ts`)
- Add live networks in `packages/hardhat/hardhat.config.ts` (already includes base, sepolia, arbitrum, etc.)
- Add networks in `packages/nextjs/scaffold.config.ts` before deploying to testnet/mainnet; decrease `pollingInterval` for L2 chains

## Known Bugs & Technical Debt

These issues were confirmed by adversarial code review on 2026-06-16. **Do not reintroduce them, and fix before touching the affected file.**

### CRITICAL — unfixed

**C1 · Escrow trap** (`packages/hardhat/contracts/MarketplaceRouter.sol` L208, L232)  
`finalizePayment` and `refundPayment` both call `reputationRegistry.giveFeedback()` **unguarded**. If the real Base `ReputationRegistry` reverts for any reason, neither exit can execute — funds are **permanently trapped**. Fix: wrap the `giveFeedback` call in `try/catch` (reputation is non-critical to settlement).

**C2 · Payment bypass** (`packages/nextjs/app/api/agents/analyze/route.ts`)  
The analyze route is an **unauthenticated Groq LLM proxy** — anyone can POST directly without going through the x402 escrow flow, burning `GROQ_API_KEY` quota for free. There is no shared secret between the relayer and the agent backend. Fix: verify a relayer-signed token on every request before calling Groq.

**C3 · Summarize stub** (`packages/nextjs/app/api/agents/summarize/route.ts`)  
Returns a hardcoded "Lorem ipsum summarized" string but is **registered as a paid default agent** (0.01 USDC). Users pay real money for fake output.

### HIGH — unfixed

**H1 · USDC display bug** (`packages/nextjs/components/AgentCard.tsx` L98)  
`price.toString()` renders raw micro-USDC — users see `"20000"` instead of `"0.02"`. Use `formatUnits(price, 6)`. The execute page and `my/page.tsx` already format correctly; only the browse grid (`/agents`) is broken.

**H2 · Reputation scale mismatch** (`packages/hardhat/contracts/MarketplaceRouter.sol` L210–211)  
Router writes `value=1` (success) or `value=0` (failure) with `valueDecimals=0`. The `StarRating` component in `AgentCard` assumes a 0–5 scale, so every successful agent displays **1.0 ★ out of 5** permanently.

**H3 · `getAgentWallet` revert risk** (`packages/hardhat/contracts/MarketplaceRouter.sol` `withdrawAgentEarnings`)  
When `payToAgentWallet=true`, `withdrawAgentEarnings` calls `identityRegistry.getAgentWallet(agentId)`. If the registry reverts (agent wallet not set), the entire withdrawal reverts and agent earnings are frozen.

### LOW / hygiene — unfixed

- `onlyRelayer` modifier reverts with `NotOwner()` (MarketplaceRouter.sol L59) — wrong error, should be `NotRelayer()`.
- Dead code in `MarketplaceRouter`: event `PaymentRouted` (L44) never emitted; error `ZeroPrice` (L32) never used.
- `execute/route.ts` L290–298 handles `AgentInactive` / `InvalidAgentId` / `PriceNotSet` — these errors don't exist in `AgentMarketplace.sol`.
- `FaucetUSDCButton.tsx` calls `useScaffoldWriteContract("USDCFaucet")` (deprecated string form). Use `{ contractName: "USDCFaucet" }`.
- `AgentMarketplace.getAgentsByOwner` (L158–182) is an **unbounded O(n) double loop** with one external `ownerOf` call per agent. Will not scale with many agents.
- Typo: `proccessesNonces` (double `c`) in `MarketplaceRouter.sol` L26.
- `02_deploy_marketplace.ts` has USDC address hardcoded to Base mainnet regardless of network; `setRelayer` uses a magic `gasLimit: 10000000` instead of `estimateGas + 20%` (script 04 does it right — follow that pattern).

## Documentation

Use **Context7 MCP** tools to fetch up-to-date docs for Wagmi, Viem, RainbowKit, DaisyUI, Hardhat, Next.js, etc.

## Skills & Agents Index

Read `.agents/skills/<name>/SKILL.md` before implementing tasks that match:

- **openzeppelin** — OZ Contracts (tokens, access control, security primitives)
- **erc-721** — NFT pitfalls: `_safeMint` reentrancy, on-chain SVG, IPFS base URI
- **eip-5792** — batch transactions, wallet_sendCalls, ERC-7677
- **ponder** — blockchain event indexing, GraphQL
- **siwe** — Sign-In with Ethereum, EIP-4361 sessions
- **x402** — HTTP 402 payment-gated routes, micropayments
- **drizzle-neon** — Drizzle ORM, Neon PostgreSQL, off-chain storage
- **subgraph** — The Graph subgraph, blockchain event indexing

Agents in `.agents/agents/`:
- **grumpy-carlos-code-reviewer** — SE-2 patterns, Solidity + TypeScript quality
