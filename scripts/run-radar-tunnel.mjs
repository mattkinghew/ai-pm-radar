import { access, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "../lib/project-env.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
loadProjectEnv(process.env, path.join(root, ".env.local"));
const configuredPath = process.env.CLOUDFLARE_TUNNEL_TOKEN_FILE?.trim() || process.env.TUNNEL_TOKEN_FILE?.trim();
if (!configuredPath) {
  console.error("Tunnel startup blocked: set CLOUDFLARE_TUNNEL_TOKEN_FILE to an absolute token-file path outside this repository.");
  process.exit(1);
}
const tokenFile = path.resolve(configuredPath);
const relative = path.relative(root, tokenFile);
if (!path.isAbsolute(configuredPath) || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
  console.error("Tunnel startup blocked: the token file must be outside this repository.");
  process.exit(1);
}
try {
  await access(tokenFile);
  const info = await stat(tokenFile);
  if (!info.isFile()) throw new Error("not a file");
  if ((info.mode & 0o077) !== 0) throw new Error("permissions");
} catch (error) {
  const reason = error instanceof Error && error.message === "permissions"
    ? "set token-file permissions to 600"
    : "token file is missing or unreadable";
  console.error(`Tunnel startup blocked: ${reason}.`);
  process.exit(1);
}

const cloudflared = process.env.CLOUDFLARED_BIN?.trim() || "/opt/homebrew/bin/cloudflared";
console.log("Starting Radar-only Cloudflare Tunnel connector from a protected token file.");
const child = spawn(cloudflared, ["tunnel", "--no-autoupdate", "run", "--token-file", tokenFile], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
child.on("error", (error) => {
  console.error(`Tunnel failed to start: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill("SIGTERM"));
}
