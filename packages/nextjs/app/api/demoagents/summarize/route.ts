import { NextRequest, NextResponse } from "next/server";
import { verifyAgentApiKey } from "~~/utils/agentAuth";

export async function POST(req: NextRequest) {
  // Authenticate the caller via the derived X-API-Key before returning a result,
  // so the endpoint can no longer be used without going through the escrow flow.
  const authResult = await verifyAgentApiKey(req, "SUMMARIZE_AGENT_ID");
  if (!authResult.ok) return authResult.response!;

  return NextResponse.json({
    message: "Lorem ipsum summarized",
  });
}
