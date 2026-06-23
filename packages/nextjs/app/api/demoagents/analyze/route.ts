import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { verifyAgentApiKey } from "~~/utils/agentAuth";

/*
| LLM Provider (Groq)
*/

/*
| TEMPORARY PRICING (NO ESTIMATION YET)

| This is just a placeholder for x402 flow validation.
| Real dynamic pricing will be implemented in middleware (#25).
*/

const DEFAULT_AGENT_PRICE_MICRO_USDC = 20_000; // 0.02 USDC

/*
|--------------------------------------------------------------------------
| MAIN ROUTE
|--------------------------------------------------------------------------
*/

export async function POST(req: NextRequest) {
  // Authenticate the caller via the derived X-API-Key before touching the LLM,
  // so the endpoint can no longer be used as an unauthenticated Groq proxy.
  const authResult = await verifyAgentApiKey(req, "ANALYZE_AGENT_ID");
  if (!authResult.ok) return authResult.response!;

  // Validate API key before using Groq
  if (!process.env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY not set – cannot call LLM");
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });
  }
  // Initialize Groq client now that we know the key exists
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  try {
    const body = await req.json();

    const { prompt, agentPrice } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    if (prompt.length > 8000) {
      return NextResponse.json({ error: "prompt exceeds maximum length of 8000 characters" }, { status: 400 });
    }

    /*
    |--------------------------------------------------------------------------
    | 1. PRICE (PLACEHOLDER ONLY)
    |--------------------------------------------------------------------------
    | Middleware (#25) will later replace this logic.
    */

    const requiredPaymentMicroUsdc = agentPrice && agentPrice > 0 ? agentPrice : DEFAULT_AGENT_PRICE_MICRO_USDC;

    /*
    |--------------------------------------------------------------------------
    | 2. CALL REAL LLM (Groq)
    |--------------------------------------------------------------------------
    */

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are an AI agent in a paid x402 marketplace. Be concise and useful.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const result = completion.choices[0]?.message?.content ?? "";

    /*
    |--------------------------------------------------------------------------
    | 3. USAGE (OPTIONAL DEBUG ONLY)
    |--------------------------------------------------------------------------
    */

    const usage = completion.usage;

    /*
    |--------------------------------------------------------------------------
    | 4. RESPONSE (POST PAYMENT ASSUMED VERIFIED)
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      status: "success",
      data: {
        analysis: result,

        pricing: {
          requiredPaymentMicroUsdc,
        },

        usage: usage
          ? {
              inputTokens: usage.prompt_tokens,
              outputTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[analyze] error:", error instanceof Error ? error.message : "unknown error");

    if (error instanceof Groq.APIError) {
      const status = error.status === 429 ? 429 : error.status === 400 ? 400 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json(
      {
        error: "internal server error",
      },
      { status: 500 },
    );
  }
}
