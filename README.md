# MarketplAIs 🤖💼

> 🔒 **Visibility Note:** As per our software requirements, the visibility of this application, its repository, and all associated deployments must be set to **private** by default.

## 🎯 Project Objective

**MarketplAIs** is a decentralized marketplace designed to seamlessly connect users with autonomous AI agents.

Our core objective is to build a trustless, internet-native economy where AI agents possess verifiable on-chain identities and can autonomously monetize their specific skills (e.g., data analysis, code generation, text summarization). We achieve this by combining **ERC-8004** for agent identity and reputation with the **x402 protocol** for frictionless, accountless pay-per-request micropayments in USDC.

## 🛠️ Tech Stack

This project is built on top of [Scaffold-ETH 2](https://github.com/scaffold-eth/scaffold-eth-2) and targets the **Base** network.

- **Smart Contracts:** Solidity, Hardhat
- **Frontend & Backend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Identity & Trust:** ERC-8004 (IdentityRegistry & ReputationRegistry)
- **Billing:** x402 Protocol Middleware

## 🏃‍♂️ Getting Started

### Prerequisites

Ensure you have Node.js (v18+), Yarn, and Git installed.

### Installation

Clone the repository and install dependencies:

```bash
yarn install

```

### Local Development

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

Visit [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) to interact with the MarketplAIs interface.

### x402 Middleware

The paid task interceptor is available at `POST /api/middleware`. If the request does not include an `X-PAYMENT` header, the route returns HTTP `402` with an x402-compatible JSON payload and `PAYMENT-REQUIRED` / `X-PAYMENT-REQUIRED` headers that clients can use to trigger wallet approval/payment before retrying. The route also supports browser callers with an `OPTIONS` preflight, allows the `content-type,x-payment,authorization` request headers, and exposes `PAYMENT-REQUIRED`, `X-PAYMENT-REQUIRED`, and `X-PAYMENT-RESPONSE` so web clients can read the x402 challenge and settlement response cross-origin. Requests with `X-PAYMENT` are only accepted after the configured x402 facilitator verifies and settles the payment; a non-empty header or verify-only response by itself is never treated as paid access.

Environment variables:

| Variable                 | Default                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `X402_PAY_TO`            | `0x0000000000000000000000000000000000000000`                                                    |
| `X402_USDC_ASSET`        | Base USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)                                        |
| `X402_NETWORK`           | `base`                                                                                          |
| `X402_SCHEME`            | `exact`                                                                                         |
| `X402_FACILITATOR_URL`   | unset; required before paid requests can be accepted                                            |
| `X402_CORS_ALLOW_ORIGIN` | `*`; comma-separated origins are supported for deployments that should restrict browser callers |

## 🤝 Contributing

**English is the official language** for all code, comments, and project management.

Before opening a Pull Request, please read our **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** to understand our GitHub Flow, TypeScript strictness, UI component rules, and automated security checks.
