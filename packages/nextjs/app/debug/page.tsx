import { SellAgentPage } from "./_components/SellAgentPage";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Sell Agent",
  description: "Register and manage your AI agents on the marketplace",
});

const Debug: NextPage = () => {
  return <SellAgentPage />;
};

export default Debug;
