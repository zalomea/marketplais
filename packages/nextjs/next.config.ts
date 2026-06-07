import * as dotenv from "dotenv";
import type { NextConfig } from "next";
import path from "path";

// Load shared root .env (two levels up from packages/nextjs)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  eslint: {
    ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  webpack: config => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  // Expose selected environment variables to the client
  env: {
    NEXT_PUBLIC_USDC_ADDRESS: process.env.NEXT_PUBLIC_USDC_ADDRESS,
    NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS,
    NEXT_PUBLIC_MARKETPLACE_FEE_BPS: process.env.NEXT_PUBLIC_MARKETPLACE_FEE_BPS,
  },
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
} else {
  nextConfig.images = {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  };
}

module.exports = nextConfig;
