import type { NextPage } from "next";
import { SellAgentPage } from "~~/app/debug/_components/SellAgentPage";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const dynamic = "force-dynamic";

export const metadata = getMetadata({
  title: "Sell Agent",
  description: "Register and manage your AI agents on the marketplace",
});

const Publish: NextPage = () => {
  return <SellAgentPage />;
};

export default Publish;
