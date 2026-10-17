import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCommand, ["run", "build"], {
  cwd: root,
  env: {
    ...process.env,
    NEXT_PUBLIC_AI_PM_RADAR_API_BASE: "/api",
  },
  stdio: "inherit",
});
const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});
if (exitCode !== 0) process.exit(exitCode);

await writeFile(path.join(root, "out", ".radar-mobile-build.json"), JSON.stringify({
  format: "ai-pm-radar-mobile-build",
  version: 1,
  api_base: "/api",
}, null, 2));
console.log("Mobile production export ready in out/ with same-origin /api routing.");
