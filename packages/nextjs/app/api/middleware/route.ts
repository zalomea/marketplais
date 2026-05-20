import { NextRequest, NextResponse } from "next/server";

const USDC_ATOMIC_UNITS = 1_000_000;
const DEFAULT_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DEFAULT_PAY_TO = "0x0000000000000000000000000000000000000000";
const DEFAULT_NETWORK = "base";
const DEFAULT_SCHEME = "exact";
const MIN_PRICE_ATOMS = 5_000; // 0.005 USDC
const MAX_PRICE_ATOMS = 100_000; // 0.10 USDC
const PRICE_PER_1K_CHARS = 1_000; // 0.001 USDC

const readJsonBody = async (request: NextRequest) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const estimatePayloadCharacters = (payload: unknown) => {
  if (!payload) return 0;

  if (typeof payload === "string") return payload.length;

  if (typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    const textFields = [candidate.prompt, candidate.task, candidate.query, candidate.message]
      .filter(value => typeof value === "string")
      .join("\n");

    if (textFields.length > 0) return textFields.length;
  }

  return JSON.stringify(payload).length;
};

const calculatePriceAtoms = (payload: unknown) => {
  const chars = estimatePayloadCharacters(payload);
  const usagePrice = Math.ceil(chars / 1_000) * PRICE_PER_1K_CHARS;

  return Math.min(MAX_PRICE_ATOMS, Math.max(MIN_PRICE_ATOMS, MIN_PRICE_ATOMS + usagePrice));
};

const getX402Config = () => ({
  payTo: process.env.X402_PAY_TO ?? DEFAULT_PAY_TO,
  asset: process.env.X402_USDC_ASSET ?? DEFAULT_ASSET,
  network: process.env.X402_NETWORK ?? DEFAULT_NETWORK,
  scheme: process.env.X402_SCHEME ?? DEFAULT_SCHEME,
  facilitatorUrl: process.env.X402_FACILITATOR_URL,
});

const getFacilitatorEndpoint = (facilitatorUrl: string, path: "verify" | "settle") => {
  const url = new URL(facilitatorUrl);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/${path}`;
  return url.toString();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPositiveVerification = (body: unknown) => {
  if (!isRecord(body)) return false;

  return body.isValid === true || body.valid === true || body.success === true;
};

const parsePaymentHeader = (paymentHeader: string) => {
  try {
    const decoded = Buffer.from(paymentHeader, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;

    if (!isRecord(parsed) || typeof parsed.x402Version !== "number" || !isRecord(parsed.payload)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const buildPaymentRequiredResponse = (request: NextRequest, payload: unknown) => {
  const config = getX402Config();
  const maxAmountRequired = calculatePriceAtoms(payload).toString();

  return {
    x402Version: 1,
    error: "X-PAYMENT header is required to submit a paid agent task.",
    resource: {
      url: request.nextUrl.href,
      description: "MarketplAIs paid agent task submission",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: config.scheme,
        network: config.network,
        amount: maxAmountRequired,
        maxAmountRequired,
        resource: request.nextUrl.href,
        description: "MarketplAIs paid agent task submission",
        mimeType: "application/json",
        payTo: config.payTo,
        asset: config.asset,
        maxTimeoutSeconds: 300,
        extra: {
          name: "MarketplAIs task submission",
          version: "1",
          facilitatorUrl: config.facilitatorUrl,
          price: {
            decimals: 6,
            asset: "USDC",
            amount: Number(maxAmountRequired) / USDC_ATOMIC_UNITS,
          },
        },
      },
    ],
  };
};

type PaymentRequiredResponse = ReturnType<typeof buildPaymentRequiredResponse>;

const verifyPaymentHeader = async (
  paymentHeader: string,
  paymentRequirements: PaymentRequiredResponse["accepts"][number],
) => {
  const paymentPayload = parsePaymentHeader(paymentHeader);

  if (!paymentPayload) {
    return {
      ok: false,
      status: 402,
      error: "X-PAYMENT header must be a valid base64-encoded x402 payment payload.",
    };
  }

  const { facilitatorUrl } = getX402Config();

  if (!facilitatorUrl) {
    return {
      ok: false,
      status: 503,
      error: "X402_FACILITATOR_URL must be configured before paid task requests can be accepted.",
    };
  }

  try {
    const response = await fetch(getFacilitatorEndpoint(facilitatorUrl, "verify"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        x402Version: paymentPayload.x402Version,
        paymentPayload,
        paymentRequirements,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok || !isPositiveVerification(body)) {
      return {
        ok: false,
        status: 402,
        error: "X-PAYMENT header could not be verified by the configured x402 facilitator.",
      };
    }

    return { ok: true, body };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : "Unable to reach the configured x402 facilitator.",
    };
  }
};

export async function GET() {
  const config = getX402Config();

  return NextResponse.json({
    name: "MarketplAIs x402 middleware",
    description: "Returns x402 Payment Required payloads for paid agent task submissions.",
    route: "/api/middleware",
    accepts: [
      {
        scheme: config.scheme,
        network: config.network,
        asset: config.asset,
        payTo: config.payTo,
      },
    ],
  });
}

export async function POST(request: NextRequest) {
  const payload = await readJsonBody(request);
  const paymentHeader = request.headers.get("x-payment");
  const paymentRequiredResponse = buildPaymentRequiredResponse(request, payload);

  if (!paymentHeader) {
    return NextResponse.json(paymentRequiredResponse, {
      status: 402,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const verification = await verifyPaymentHeader(paymentHeader, paymentRequiredResponse.accepts[0]);

  if (!verification.ok) {
    return NextResponse.json(
      {
        ...paymentRequiredResponse,
        error: verification.error,
      },
      {
        status: verification.status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      paymentHeaderPresent: true,
      paymentVerified: true,
      status: "payment_verified",
      message: "Payment proof was verified by the configured x402 facilitator.",
    },
    { status: 202 },
  );
}
