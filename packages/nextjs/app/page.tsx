"use client";

import dynamicImport from "next/dynamic";

const HomePage = dynamicImport(() => import("./_HomePage").then(mod => mod.HomePage), {
  ssr: false,
});

export default function Page() {
  return <HomePage />;
}
