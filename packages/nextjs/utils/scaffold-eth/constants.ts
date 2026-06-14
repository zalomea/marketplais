/**
 * Non-secret application constants shared across the frontend.
 *
 * Contract addresses go in `packages/nextjs/contracts/externalContracts.ts` — NOT here.
 * Secrets (API keys, private keys) go in per-package `.env` files — NOT here.
 */
export const MARKETPLACE_DEFAULTS = {
  /** Fee in basis points (e.g., 1000 = 10%) */
  FEE_BPS: 1000,
} as const;
