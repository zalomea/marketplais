"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { Bars3Icon } from "@heroicons/react/24/outline";
import Logo from "~~/components/Logo";
import { FaucetButton, FaucetUSDCButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useTargetNetwork } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Marketplace",
    href: "/marketplace",
  },
  {
    label: "Agents",
    href: "/agents",
  },
  {
    label: "Add Agent",
    href: "/agents/add",
  },
  {
    label: "My Agents",
    href: "/agents/my",
  },
  {
    label: "Debug Contracts",
    href: "/debug",
  },
  {
    label: "Block Explorer",
    href: "/blockexplorer",
  },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href }) => {
        const isActive = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              passHref
              className={`${
                isActive ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-700 hover:text-slate-900"
              } px-3 py-3 text-sm font-medium transition whitespace-nowrap`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </>
  );
};

export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div className="sticky top-0 w-full border-b border-slate-300 bg-white z-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between flex-nowrap">
          <Link href="/" className="flex items-center gap-3 shrink-0 font-semibold text-lg text-slate-900">
            <Logo className="w-7 h-7" />
            <span className="ml-1">MarketplAIs</span>
          </Link>

          <ul className="hidden lg:flex lg:flex-nowrap items-center gap-4 ml-8">
            <HeaderMenuLinks />
          </ul>

          <details className="dropdown dropdown-end lg:hidden" ref={burgerMenuRef}>
            <summary className="btn btn-ghost btn-sm">
              <Bars3Icon className="h-5 w-5" />
            </summary>
            <ul className="dropdown-content menu bg-white border border-slate-300 rounded-none w-52">
              <HeaderMenuLinks />
            </ul>
          </details>

          <div className="ml-auto flex items-center gap-3 shrink-0 flex-nowrap">
            <RainbowKitCustomConnectButton />
            {isLocalNetwork && <FaucetButton />}
            {isLocalNetwork && <FaucetUSDCButton />}
          </div>
        </div>
      </div>
    </div>
  );
};
