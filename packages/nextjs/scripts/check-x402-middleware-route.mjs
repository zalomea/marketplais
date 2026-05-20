import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const NEXT_BIN = path.join(PACKAGE_ROOT, "node_modules", "next", "dist", "bin", "next");
const ORIGIN = "https://agent.example";
const PAYMENT_PAYLOAD = Buffer.from(
  JSON.stringify({
    x402Version: 1,
    payload: {
      authorization: "test-payment-proof",
    },
  }),
).toString("base64");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const getAvailablePort = async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
};

const startFacilitator = async () => {
  const requests = [];
  const server = createServer((req, res) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      requests.push({ path: req.url, body: JSON.parse(body || "{}") });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ isValid: true, settled: req.url?.endsWith("/settle") }));
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () => new Promise(resolve => server.close(resolve)),
  };
};

const readProcessOutput = child => {
  let output = "";

  child.stdout.on("data", chunk => {
    output += chunk.toString();
  });

  child.stderr.on("data", chunk => {
    output += chunk.toString();
  });

  return () => output;
};

const startNext = async facilitatorUrl => {
  const port = await getAvailablePort();
  const child = spawn(process.execPath, [NEXT_BIN, "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: PACKAGE_ROOT,
    env: {
      ...process.env,
      X402_CORS_ALLOW_ORIGIN: ORIGIN,
      X402_FACILITATOR_URL: facilitatorUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const getOutput = readProcessOutput(child);
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next dev server exited early with code ${child.exitCode}\n${getOutput()}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/middleware`, { headers: { Origin: ORIGIN } });

      if (response.ok) {
        return {
          baseUrl,
          stop: () => {
            child.kill();
          },
        };
      }
    } catch {
      // Server is still starting.
    }

    await sleep(500);
  }

  child.kill();
  throw new Error(`Timed out waiting for Next dev server\n${getOutput()}`);
};

const assertHeaderIncludes = (response, name, value) => {
  const header = response.headers.get(name) ?? "";

  if (!header.toLowerCase().includes(value.toLowerCase())) {
    throw new Error(`Expected ${name} to include ${value}, got ${header || "<missing>"}`);
  }
};

const assertStatus = (response, expected) => {
  if (response.status !== expected) {
    throw new Error(`Expected HTTP ${expected}, got ${response.status}: ${response.statusText}`);
  }
};

const facilitator = await startFacilitator();
let next;

try {
  next = await startNext(facilitator.url);

  const preflight = await fetch(`${next.baseUrl}/api/middleware`, {
    method: "OPTIONS",
    headers: {
      Origin: ORIGIN,
      "Access-Control-Request-Headers": "content-type,x-payment",
      "Access-Control-Request-Method": "POST",
    },
  });

  assertStatus(preflight, 204);
  assertHeaderIncludes(preflight, "access-control-allow-methods", "OPTIONS");
  assertHeaderIncludes(preflight, "access-control-allow-methods", "POST");
  assertHeaderIncludes(preflight, "access-control-allow-headers", "x-payment");
  assertHeaderIncludes(preflight, "access-control-allow-origin", ORIGIN);

  const challenge = await fetch(`${next.baseUrl}/api/middleware`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
    },
    body: JSON.stringify({ task: "summarize this paid task" }),
  });

  assertStatus(challenge, 402);
  assertHeaderIncludes(challenge, "access-control-expose-headers", "PAYMENT-REQUIRED");
  assertHeaderIncludes(challenge, "access-control-expose-headers", "X-PAYMENT-RESPONSE");

  if (!challenge.headers.get("PAYMENT-REQUIRED") || !challenge.headers.get("X-PAYMENT-REQUIRED")) {
    throw new Error("Expected 402 response to include PAYMENT-REQUIRED and X-PAYMENT-REQUIRED headers");
  }

  const accepted = await fetch(`${next.baseUrl}/api/middleware`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "X-PAYMENT": PAYMENT_PAYLOAD,
    },
    body: JSON.stringify({ task: "summarize this paid task" }),
  });

  assertStatus(accepted, 202);
  assertHeaderIncludes(accepted, "access-control-expose-headers", "X-PAYMENT-RESPONSE");

  if (!accepted.headers.get("X-PAYMENT-RESPONSE")) {
    throw new Error("Expected accepted response to include X-PAYMENT-RESPONSE header");
  }

  const facilitatorPaths = facilitator.requests.map(request => request.path).join(",");

  if (!facilitatorPaths.includes("/verify") || !facilitatorPaths.includes("/settle")) {
    throw new Error(`Expected facilitator /verify and /settle calls, got ${facilitatorPaths}`);
  }

  console.log("X402_MIDDLEWARE_ROUTE_SMOKE_OK");
} finally {
  next?.stop();
  await facilitator.close();
}
