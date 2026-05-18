# MarketplAIs 🤖💼

> 🔒 **Visibility Note:** As per our software requirements, the visibility of this application, its repository, and all associated deployments must be set to **private** by default.

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

## 🤝 Contributing

**English is the official language** for all code, comments, and project management.

Before opening a Pull Request, please read our **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** to understand our GitHub Flow, TypeScript strictness, UI component rules, and automated security checks.
