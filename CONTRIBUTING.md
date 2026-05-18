# Project Style and Consensus Guide: AI Agent Marketplace

This guide establishes the development standards, code conventions, and workflows for our Scaffold-ETH 2 based project. The goal is to maintain agility, ensure code quality, and minimize friction in our teamwork.

> ⚠️ **Official Project Language: ENGLISH**
> To maintain a globally accessible and standardized codebase, **English is the official language** of this project. All variable names, code comments, commit messages, GitHub Issues, Pull Request descriptions, and documentation must be written in English.

## 1. Work Philosophy

* **Agility over Bureaucracy:** We will use automated tools to enforce code styles; human reviews (PRs) will focus strictly on business logic and security.

* **Monorepo:** All code (Smart Contracts, Frontend, Node.js Middleware) will live in this single repository to simplify dependency management and deployments.

* **Asynchronous Transparency:** Every task and technical discussion must be documented in GitHub Issues and Pull Requests.

## 2. Git & GitHub Workflow

We adopt a simplified **GitHub Flow**.

### 2.1. Branches

* `main`: This is the only permanent branch. It contains stable code ready for production/testnet. **NEVER** push commits directly to `main`.

* **Work Branches:** Every new feature, bug fix, or experiment must be done in a temporary branch created from `main`.

  * **Naming Convention:** `issue-{issue-number}/{short-description}`

  * **Examples:**

    * `issue-15/payment-router`

    * `issue-22/mobile-agent-ui`

    * `issue-8/style-guide`

### 2.2. Pull Requests (PRs)

* **The Golden Rule:** All new code must enter `main` exclusively through a Pull Request.

* **Approvals:** At least **1 approved review** from another team member is required before merging.

* **Auto-closing:** Include keywords in the PR description to automatically close the associated Issue (e.g., `Closes #15`).

### 2.3. Commit Messages

Use clear, imperative messages written strictly in **English**.

* *Good:* `Add x402 middleware for agent billing`

* *Bad:* `Fixing backend stuff` or `Añadido middleware`

### 2.4. VS Code Workflow (Recommended)

To avoid leaving the editor, the entire team should install the official **"GitHub Pull Requests and Issues"** extension.

1. **Start Task:** In the VS Code GitHub tab, open "Issues", right-click your assigned ticket, and select *"Start working on issue and checkout topic branch"*.

2. **Development:** Save your changes and commit them from the standard Git tab.

3. **Review:** Use the *"Create Pull Request"* button in the extension to open the PR directly from VS Code.

## 3. Code Standards and Automation

We won't waste time debating spaces vs. tabs or quotes. Machines dictate the style.

### 3.1. Mandatory Tools

* **Prettier:** Universal code formatter.

* **ESLint:** Linter for JavaScript/TypeScript and React.

* **Husky & Lint-Staged:** Pre-commit hooks (already configured in Scaffold-ETH 2).

### 3.2. Editor Configuration

* Install the **Prettier** and **ESLint** extensions.

* Enable the **"Format on Save"** option in your editor settings.

* *Note:* If a commit fails due to style issues, run `yarn format` or `yarn lint` in the project root before trying again.

## 4. Smart Contract Development (Solidity)

Security is our top priority and is non-negotiable in the contracts layer (`packages/hardhat`).

* **Solidity Version:** We will keep the default version configured in Scaffold-ETH 2 (e.g., `^0.8.20`).

* **Basic Linter:** We will use **Solhint** for basic formatting and syntax conventions day-to-day.

* **Security Analysis with Slither (Conditional Execution):** Every new or modified contract must pass Slither. To maintain agility, **it will only run if there are changes to the smart contracts**.

  * **Local (Pre-commit):** Via `lint-staged`, Slither will automatically audit `.sol` files before allowing the commit.

  * **CI/CD (GitHub Actions):** A cloud workflow will automatically block the PR if Slither detects vulnerabilities, triggering *only* when the path `packages/hardhat/**/*.sol` is modified.

* **Testing:** **100% test coverage is required** for financial and business logic (e.g., `MarketplaceRouter.sol`). Since it moves USDC funds, it must have exhaustive tests in Mocha/Chai (`yarn hardhat test`).

* **Naming Conventions:**

  * Contracts and Structs: `PascalCase` (e.g., `MarketplaceRouter`).

  * Functions and Variables: `camelCase` (e.g., `forwardPayment`, `agentId`).

  * Constants: `UPPER_SNAKE_CASE` (e.g., `PLATFORM_FEE_PERCENTAGE`).

## 5. Frontend Development (Next.js & React)

The frontend lives in `packages/nextjs`.

* **TypeScript:** Mandatory. Avoid using `any`; define clear interfaces for all data, especially data coming from smart contracts or the backend.

* **Styles (CSS) & Theming:** We prioritize a **custom and personalized design** to give our marketplace a unique brand identity. 

  * You are free to use **CSS Modules** (`.module.css`), **SCSS**, or standard **Tailwind CSS**, depending on what fits best for the specific design requirement.
  
  * *Rule:* Always scope your custom CSS to its specific component (e.g., using CSS Modules) to prevent global style leaks and conflicts.

* **UI Components:** While Scaffold-ETH 2 includes DaisyUI for rapid prototyping, we strongly encourage building **bespoke, highly customized components** for the core marketplace interface to ensure a unique look and feel.

* **Component Structure:** Keep them small and focused. If a component exceeds 150-200 lines, consider extracting parts into subcomponents.

## 6. Backend / Middleware (Node.js)

The x402 middleware and the AI agents' logic can live as *Route Handlers* in Next.js (`packages/nextjs/app/api/...`) or as a standalone Node service if AI computational load requires it.

* **x402 Protocol:** Ensure strict adherence to the HTTP 402 response standard outlined in the x402 whitepaper.

* **Input Validation:** All requests to the backend must have their payload validated (e.g., using `Zod`) before processing.

* **Error Handling:** Avoid exposing internal server errors to the client. Catch exceptions and return structured message payloads.

## 7. Environments and Deployment

* **Local Development:** We will use a **Base Mainnet Fork** to interact with the real `IdentityRegistry` and `ReputationRegistry` contracts.

  * Command: `yarn chain` (Ensure `hardhat.config.ts` is configured for forking).

* **Testnet (Staging):** Test deployments will be done on **Base Sepolia**.

* **Secrets (.env):** **NEVER** commit Private Keys (PK), Database URIs, or API Keys to the repository. Use `.env.example` to document required variables so each developer can configure their local `.env` file.

## 8. Task Management

* We will use the **Projects** board in GitHub.

* **Statuses:** `To Do`, `In Progress`, `In Review` (PR open), `Done`.

* Tasks (Issues) must be atomic: sized to be completed within a maximum of 1-2 days.

*End of guide. This is a living document; feel free to propose improvements via a Pull Request.*