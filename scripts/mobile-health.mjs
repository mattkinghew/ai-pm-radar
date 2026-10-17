import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "../lib/project-env.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
loadProjectEnv(process.env, path.join(root, ".env.local"));
const productionPort = Number(process.env.AI_PM_RADAR_PRODUCTION_PORT ?? 4320);
const helperPort = Number(process.env.AI_PM_RADAR_FETCH_PORT ?? 4310);
const publicOrigin = process.env.AI_PM_RADAR_PUBLIC_ORIGIN?.trim();
if (!publicOrigin) {
  console.error("Health check blocked: AI_PM_RADAR_PUBLIC_ORIGIN is not configured.");
  process.exit(1);
}

function request({ port, pathname, headers }) {
  return new Promise((resolve, reject) => {
    const outgoing = http.request({ hostname: "127.0.0.1", port, path: pathname, headers }, (incoming) => {
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      incoming.on("end", () => resolve({ status: incoming.statusCode, text: Buffer.concat(chunks).toString("utf8") }));
    });
    outgoing.setTimeout(3_000, () => outgoing.destroy(new Error("timeout")));
    outgoing.on("error", reject);
    outgoing.end();
  });
}

try {
  const hostname = new URL(publicOrigin).hostname;
  const [origin, helper] = await Promise.all([
    request({ port: productionPort, pathname: "/api/status", headers: { host: hostname, "x-forwarded-proto": "https", accept: "application/json" } }),
    request({ port: helperPort, pathname: "/status", headers: { origin: `http://127.0.0.1:${productionPort}`, accept: "application/json" } }),
  ]);
  if (origin.status !== 401) throw new Error(`protected origin returned ${origin.status}; expected fail-closed 401 without Access JWT`);
  if (helper.status !== 200) throw new Error(`companion helper returned ${helper.status}`);
  const helperStatus = JSON.parse(helper.text);
  console.log(`Protected origin: listening and fail-closed on 127.0.0.1:${productionPort}`);
  console.log(`Companion helper: provider=${helperStatus.provider} model=${helperStatus.model ?? "none"} configured=${Boolean(helperStatus.configured)}`);
} catch (error) {
  console.error(`Mobile health check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
