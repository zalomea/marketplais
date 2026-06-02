"use client";

import React from "react";

export const Logo = ({ className = "w-8 h-8" }: { className?: string }) => {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <rect width="64" height="64" rx="10" fill="#ffffff" />
      <g transform="translate(0 0)">
        {/* Heptagon nodes */}
        {/* Center */}
        <circle cx="32" cy="32" r="2.2" fill="#0ea5a5" />
        {/* 7 points around */}
        <circle cx="32" cy="12" r="2.8" fill="#071022" />
        <circle cx="48" cy="18" r="2.8" fill="#071022" />
        <circle cx="54" cy="34" r="2.8" fill="#071022" />
        <circle cx="44" cy="48" r="2.8" fill="#071022" />
        <circle cx="24" cy="52" r="2.8" fill="#071022" />
        <circle cx="12" cy="40" r="2.8" fill="#071022" />
        <circle cx="14" cy="22" r="2.8" fill="#071022" />

        {/* Connecting lines (subtle) */}
        <path
          d="M32 12 L48 18 L54 34 L44 48 L24 52 L12 40 L14 22 L32 12"
          stroke="#0ea5a5"
          strokeWidth="1"
          fill="none"
          opacity="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Inner connections to center */}
        <path
          d="M32 12 L32 32 M48 18 L32 32 M54 34 L32 32 M44 48 L32 32 M24 52 L32 32 M12 40 L32 32 M14 22 L32 32"
          stroke="#60a5fa"
          strokeWidth="0.8"
          opacity="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};

export default Logo;
