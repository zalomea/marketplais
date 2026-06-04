"use client";

import dynamicImport from "next/dynamic";

const AddAgentPage = dynamicImport(() => import("./_page"), {
  ssr: false,
});

export default AddAgentPage;
