import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "success",
    data: {
      analysis: "Static analysis result",
      confidence: 0.95,
      findings: ["Finding 1", "Finding 2", "Finding 3"],
    },
  });
}
