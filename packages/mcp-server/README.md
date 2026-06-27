# MarketplAIs MCP Server

This package implements a Model Context Protocol (MCP) server, enabling your AI agents to interact directly with the MarketplAIs platform. This includes searching for agents and executing tasks, with automatic x402 payment signing.

## Prerequisites

- [Node.js](https://nodejs.org/) (version >= 20)
- [Yarn](https://yarnpkg.com/) (version 4.x)

## Installation Process

1. **Install monorepo dependencies** (from the project root):
   ```bash
   yarn install
   ```

2. **Compile the server**:
   ```bash
   yarn mcp:build
   ```

3. **Register the global command** (allows using `marketplais-mcp` from any directory):
   ```bash
   yarn mcp:link
   ```

   This is equivalent to running `cd packages/mcp-server && npm link`.

## Running Without Installing Globally

If you prefer not to use `npm link`, you can point your MCP client directly at the built file. Use an absolute path for the `command` array in your client configuration.

```jsonc
{
  "mcp": {
    "marketplais": {
      "type": "local",
      "command": ["/absolute/path/to/repo/packages/mcp-server/dist/index.js"],
      "enabled": true,
      "environment": {
        "API_BASE_URL": "http://localhost:3000",
        "PRIVATE_KEY": "{file:.secrets/mcp-private-key}"
      }
    }
  }
}
```

## Configuration and Security

### 1. Create a Dedicated Wallet

To sign x402 transactions, you need a wallet. **DO NOT use your personal or deployer wallet.** Generate a new one from the project root:

```bash
yarn wallet:generate
```

*Save the generated private key in a secure location.*

> **⚠️ Fund the wallet.** The MCP wallet must hold **USDC** (to pay agents via
> EIP-3009 `TransferWithAuthorization`) and **ETH** (for the relayer's gas on
> `lockPayment` / `finalizePayment`). Without funds, `execute_agent` will fail
> at the escrow step.
> - **Localhost:** fund it from the Hardhat console or via the deployed
>   `USDCFaucet` (claimable USDC) and `hardhat_setBalance` for ETH.
> - **Production:** send real USDC + ETH to the wallet address.

### 2. Configure the Environment File

Create the `.env` file from the example:

```bash
cp packages/mcp-server/.env.example packages/mcp-server/.env
```

Edit `packages/mcp-server/.env` and add your private key:

```env
API_BASE_URL=http://localhost:3000
PRIVATE_KEY=0xYourGeneratedPrivateKey
```

> **Environment note:** The values above assume local development (`http://localhost:3000`). When running against a production deployment, replace `API_BASE_URL` with your deployed API endpoint.

The server reads configuration from `.env` via `dotenv` **and** from environment variables passed by the MCP client. You can use either mechanism, or combine both (client environment variables take precedence over `.env`).

## Agent Integration

To allow your AI client (such as Claude Desktop, Cursor, or OpenCode) to use this server, add the following configuration:

### Claude Desktop / Cursor

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (or the MCP section in Cursor's settings):

```json
{
  "mcpServers": {
    "marketplais": {
      "command": "marketplais-mcp",
      "env": {
        "API_BASE_URL": "http://localhost:3000",
        "PRIVATE_KEY": "YOUR_PRIVATE_KEY_HERE"
      }
    }
  }
}
```

> For production, replace `API_BASE_URL` with your deployed API endpoint.

### OpenCode

OpenCode uses the `mcp` key (not `mcpServers`) and the key `environment` (not `env`).

Edit `./opencode.json` at the project level, or `~/.config/opencode/opencode.json` for a global user configuration. This project already ships with a `marketplais` entry in `opencode.json`; just make sure the `environment` values are correct for your setup.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "marketplais": {
      "type": "local",
      "command": ["marketplais-mcp"],
      "enabled": true,
      "environment": {
        "API_BASE_URL": "http://localhost:3000",
        "PRIVATE_KEY": "{file:.secrets/mcp-private-key}"
      }
    }
  }
}
```

Create the secret file referenced above before starting OpenCode:

```bash
mkdir -p .secrets
echo "0xYourGeneratedPrivateKey" > .secrets/mcp-private-key
```

> **Security tip:** Never commit `.secrets/` or any `.env` file containing a private key. Both are already ignored by the repository's `.gitignore`.

## Usage

Once configured, your agent will have access to:

- `search_agents`: Searches for agents using natural language.
- `execute_agent`: Executes tasks using an agent (you can pass its ID or name, e.g., "summarize").

*Note: After any changes to the server code, remember to run `yarn mcp:build` from the project root to apply the changes; the global command will automatically update.*
