#!/usr/bin/env node
/**
 * Pinned 2026-10-14 15:00 Radar-only production recovery supervisor.
 * Does not rebuild, copy static files, change Access settings, configure D1,
 * schedule workers, or launch Cloud Sync Worker endpoints.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCloudflareAccessVerifier, getCloudflareAccessConfig } from "../lib/cloudflare-access.mjs";
import { loadProjectEnv } from "../lib/project-env.mjs";
import { createMobileProductionServer } from "./mobile-production-server.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const snapshot = "/Users/mattgor/Library/Application Support/AI PM Radar/rollbacks/reading-v2-20261014-175254/out";
const EXPECTED_SHA256 = "529383c873d069110f38277a939e871e89396b028ad10330daf083c3c3ba534e";
const originPort = 4320;
const helperPort = 4310;
const cloudWriteVariables = ["cloud_write_authorized", "CLOUD_WRITE_AUTHORIZED", "AI_PM_RADAR_CLOUD_WRITE_AUTHORIZED"];

loadProjectEnv(process.env, path.join(root, ".env.local"));
for (const key of cloudWriteVariables) process.env[key] = "false";

function log(event, details = "") {
  console.log(`[radar-recovery] ${new Date().toISOString()} ${event}${details ? ` ${details}` : ""}`);
}
async function ensurePortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(`TCP port ${port} is already in use; will not interrupt another service.`)));
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}
async function preflight() {
  const config = getCloudflareAccessConfig();
  if (config.publicOrigin !== "https://radar.lamlab.cc") {
    throw new Error("Configured Access public origin is not exactly the pinned Radar hostname.");
  }
  if (process.env.AI_PM_RADAR_PRODUCTION_PORT !== String(originPort) || process.env.AI_PM_RADAR_FETCH_PORT !== String(helperPort)) {
    throw new Error("Expected pinned Radar ports 4320/4310; existing configuration is different.");
  }
  const marker = JSON.parse(await readFile(path.join(snapshot, ".radar-mobile-build.json"), "utf8"));
  if (marker.format !== "ai-pm-radar-mobile-build" || marker.version !== 1 || marker.api_base !== "/api") {
    throw new Error("Pinned snapshot has an invalid build marker.");
  }
  const digest = createHash("sha256").update(await readFile(path.join(snapshot, "index.html"))).digest("hex");
  if (digest !== EXPECTED_SHA256) throw new Error("Pinned recovery snapshot content hash mismatch.");
  for (const rel of ["source-inbox/index.html", "research/index.html"]) {
    if (!(await stat(path.join(snapshot, rel))).isFile()) throw new Error("Snapshot is missing an expected application page.");
  }
  const tokenPathRaw = process.env.CLOUDFLARE_TUNNEL_TOKEN_FILE?.trim();
  if (!tokenPathRaw || !path.isAbsolute(tokenPathRaw)) throw new Error("No absolute Radar-only tunnel token-file path.");
  const tokenPath = path.resolve(tokenPathRaw);
  const relative = path.relative(root, tokenPath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) throw new Error("Tunnel token file is inside source repository.");
  const tokenInfo = await stat(tokenPath);
  if (!tokenInfo.isFile() || (tokenInfo.mode & 0o077) !== 0) throw new Error("Tunnel token file not regular or has unsafe permissions.");
  await ensurePortFree(originPort);
  await ensurePortFree(helperPort);
  log("PREFLIGHT_PASS", `snapshot_sha256=${digest} cloud_write_authorized=false`);
  return { config, tokenPath };
}

let server;
let terminating = false;
const children = [];
function shutdown(reason, code = 0) {
  if (terminating) return;
  terminating = true;
  log("STOP", reason);
  for (const { child } of children) if (child.exitCode === null) child.kill("SIGTERM");
  if (server) server.close();
  setTimeout(() => process.exit(code), 900).unref?.();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGHUP", () => shutdown("SIGHUP"));

function launch(label, command, args, env) {
  const child = spawn(command, args, { cwd: root, env, stdio: ["ignore", "inherit", "inherit"] });
  children.push({ label, child });
  log("STARTED", `${label} pid=${child.pid}`);
  child.on("error", (error) => shutdown(`${label} spawn failed: ${error.message}`, 1));
  child.on("exit", (code, signal) => {
    if (!terminating) shutdown(`${label} exited unexpectedly: ${signal ?? code}`, 1);
  });
  return child;
}
try {
  const { config, tokenPath } = await preflight();
  server = createMobileProductionServer({
    outDir: snapshot,
    helperOrigin: `http://127.0.0.1:${helperPort}`,
    helperAllowedOrigin: `http://127.0.0.1:${originPort}`,
    publicOrigin: config.publicOrigin,
    verifyAccess: createCloudflareAccessVerifier(config),
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(originPort, "127.0.0.1", resolve);
  });
  log("ORIGIN_LISTENING", `pid=${process.pid} port=${originPort}`);
  const childEnv = {
    ...process.env,
    AI_PM_RADAR_APP_PORT: String(originPort),
    AI_PM_RADAR_PRODUCTION_PORT: String(originPort),
    AI_PM_RADAR_FETCH_PORT: String(helperPort),
  };
  launch("helper", process.execPath, ["--experimental-strip-types", "scripts/source-fetch-helper.mjs"], childEnv);
  const binary = process.env.CLOUDFLARED_BIN || "/opt/homebrew/bin/cloudflared";
  launch("radar-tunnel", binary, ["tunnel", "--no-autoupdate", "run", "--token-file", tokenPath], childEnv);
  log("RUNNING", `supervisor_pid=${process.pid} snapshot_sha256=${EXPECTED_SHA256} cloud_write_authorized=false`);
} catch (error) {
  console.error(`[radar-recovery] STARTUP_BLOCKED ${error instanceof Error ? error.message : String(error)}`);
  shutdown("preflight_error", 1);
  setTimeout(() => process.exit(1), 1000).unref?.();
}
