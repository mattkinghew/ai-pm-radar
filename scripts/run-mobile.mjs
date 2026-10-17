import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getCloudflareAccessConfig } from "../lib/cloudflare-access.mjs";
import { loadProjectEnv } from "../lib/project-env.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
loadProjectEnv(process.env, path.join(root, ".env.local"));

let accessConfig;
try {
  accessConfig = getCloudflareAccessConfig();
} catch (error) {
  console.error(`Mobile startup blocked: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const productionPort = Number(process.env.AI_PM_RADAR_PRODUCTION_PORT ?? 4320);
const helperPort = Number(process.env.AI_PM_RADAR_FETCH_PORT ?? 4310);

async function checkMobileBuild() {
  try {
    const marker = JSON.parse(await readFile(path.join(root, "out", ".radar-mobile-build.json"), "utf8"));
    if (marker?.format !== "ai-pm-radar-mobile-build" || marker?.version !== 1 || marker?.api_base !== "/api") {
      throw new Error("invalid marker");
    }
  } catch {
    throw new Error("Run npm run build:mobile before starting the protected origin.");
  }
}

function checkPortAvailable(port, label) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(`${label} port ${port} is already in use. Stop only the matching Radar process or choose another port.`)));
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}

try {
  await checkMobileBuild();
  await checkPortAvailable(productionPort, "Protected origin");
  await checkPortAvailable(helperPort, "Companion helper");
} catch (error) {
  console.error(`Mobile startup blocked: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const childEnvironment = {
  ...process.env,
  AI_PM_RADAR_APP_PORT: String(productionPort),
  AI_PM_RADAR_PRODUCTION_PORT: String(productionPort),
  AI_PM_RADAR_FETCH_PORT: String(helperPort),
};

console.log(`Starting protected production origin at http://127.0.0.1:${productionPort}`);
console.log(`Starting companion helper at http://127.0.0.1:${helperPort}`);
console.log(`Expected protected HTTPS URL: ${accessConfig.publicOrigin}`);

const children = [
  {
    label: "Protected origin",
    child: spawn(process.execPath, ["scripts/mobile-production-server.mjs"], { cwd: root, env: childEnvironment, stdio: "inherit" }),
  },
  {
    label: "Companion helper",
    child: spawn(process.execPath, ["--experimental-strip-types", "scripts/source-fetch-helper.mjs"], { cwd: root, env: childEnvironment, stdio: "inherit" }),
  },
];

let stopping = false;
function stopChildren(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const { child } of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 300).unref?.();
}

for (const { label, child } of children) {
  child.on("error", (error) => {
    console.error(`${label} failed to start: ${error.message}`);
    stopChildren(1);
  });
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(`${label} stopped unexpectedly (${signal ?? `exit ${code}`}).`);
      stopChildren(code ?? 1);
    }
  });
}

process.on("SIGINT", () => stopChildren(0));
process.on("SIGTERM", () => stopChildren(0));
