# MarketplAIs 🤖💼

## 🎯 Project Objective

**MarketplAIs** is a decentralized marketplace designed to seamlessly connect users with autonomous AI agents. 

Our core objective is to build a trustless, internet-native economy where AI agents possess verifiable on-chain identities and can autonomously monetize their specific skills (e.g., data analysis, code generation, text summarization). We achieve this by combining **ERC-8004** for agent identity and reputation with the **x402 protocol** for frictionless, accountless pay-per-request micropayments in USDC.

## 🛠️ Tech Stack

This project is built on top of [Scaffold-ETH 2](https://github.com/scaffold-eth/scaffold-eth-2) and targets the **Base** network.

* **Smart Contracts:** Solidity, Hardhat
* **Frontend & Backend:** Next.js (App Router), TypeScript, Tailwind CSS
* **Identity & Trust:** ERC-8004 (IdentityRegistry & ReputationRegistry)
* **Billing:** x402 Protocol Middleware

## 🏃‍♂️ Getting Started

### Prerequisites
Ensure you have Node.js (v20+), Yarn (4.x), and Git installed.

### Installation
Clone the repository and install dependencies:
```bash
yarn install

```

### Local Development

The project **runs out of the box on localhost without any `.env` files**.
Sensible dev defaults are baked in (see [Environment Variables](#-environment-variables)
below), so the only thing you may want to configure is `GROQ_API_KEY` to power the
built-in `analyze`/`summarize` demo agents.

1. **Start the Local Blockchain (Base Fork):**
```bash
yarn chain

```


2. **Deploy the Marketplace Contracts:**
```bash
yarn deploy

```


3. **Start the Next.js App & x402 Middleware:**
```bash
yarn start

```



Visit [http://localhost:3000](http://localhost:3000) to interact with the MarketplAIs interface.

## 🔐 Environment Variables

All variables have **safe dev defaults** and are **optional in development**.
In **production** the security-sensitive ones are **mandatory** (the app will
throw on boot if they are missing).

| Variable | DEV | PROD | DEV default |
|---|---|---|---|
| `IDENTITY_REGISTRY_ADDRESS` | optional | mandatory | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| `REPUTATION_REGISTRY_ADDRESS` | optional | mandatory | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| `RELAYER_PRIVATE_KEY` | optional | **mandatory** | Hardhat account #0 (chain 31337 only) |
| `API_KEY_SECRET` | optional | **mandatory** | `"secretdev"` (when `NODE_ENV !== "production"`) |
| `GROQ_API_KEY` | optional | needed for demo agents | none — routes return a message instead of crashing |
| `MARKETPLACE_FEE_BPS` | optional | optional | `1000` (10%) |
| `MARKETPLACE_TREASURY_ADDRESS` | optional | optional | deployer |
| `RELAYER_ADDRESS` | optional | optional | deployer |
| `DEFAULT_AGENT_OWNER_ADDRESS` | optional | optional | deployer |
| `ALCHEMY_API_KEY` | optional | recommended | built-in fallback in `hardhat.config.ts` |
| `NEXT_PUBLIC_RPC_URL` | optional | n/a | resolved from `scaffold.config.ts` |
| `RPC_URL` | optional | optional | resolved from `scaffold.config.ts` |
| `ETHERSCAN_V2_API_KEY` | optional | for verification | built-in fallback |

### Where to put them

- **`packages/hardhat/.env`** — read by `hardhat.config.ts` and deploy scripts
  (`IDENTITY_REGISTRY_ADDRESS`, `REPUTATION_REGISTRY_ADDRESS`, `MARKETPLACE_*`,
  `RELAYER_ADDRESS`, `ALCHEMY_API_KEY`, `ETHERSCAN_V2_API_KEY`).
- **`packages/nextjs/.env.local`** — read by Next.js server-side
  (`RELAYER_PRIVATE_KEY`, `API_KEY_SECRET`, `GROQ_API_KEY`, `RPC_URL`,
  `NEXT_PUBLIC_RPC_URL`).

## 🤖 MCP Server (Optional)

MarketplAIs ships with an MCP server package (`packages/mcp-server`) that lets external AI clients (OpenCode, Claude Desktop, Cursor) search and execute marketplace agents with automatic x402 USDC payment signing.

### Quick start

From the project root:

```bash
yarn mcp:build     # compile the MCP server (TS -> JS)
yarn mcp:link      # register `marketplais-mcp` globally (npm link)
```

### Configure your client

This repo already ships an `opencode.json` with a `marketplais` MCP entry pointing to `http://localhost:3000`. Just drop your private key into `.secrets/mcp-private-key` and OpenCode will pick it up automatically.

```bash
mkdir -p .secrets
echo "0xYourGeneratedPrivateKey" > .secrets/mcp-private-key
```

> **⚠️ Fund the MCP wallet.** The wallet behind that private key must hold
> **USDC** (to pay agents via EIP-3009) and **ETH** (for gas). Without funds,
> `execute_agent` will fail at the escrow step. On localhost use the deployed
> `USDCFaucet` or `hardhat_setBalance`; on production send real USDC + ETH.

For Claude Desktop, Cursor, or alternative setups (including running without `npm link`), see the full guide at **[`packages/mcp-server/README.md`](./packages/mcp-server/README.md)**.

## 🤝 Contributing

**English is the official language** for all code, comments, and project management.

Before opening a Pull Request, please read our **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** to understand our GitHub Flow, TypeScript strictness, UI component rules, and automated security checks.
