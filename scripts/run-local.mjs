import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const appPort = process.env.AI_PM_RADAR_APP_PORT ?? "3000";
const helperPort = process.env.AI_PM_RADAR_FETCH_PORT ?? "4310";
const childEnvironment = {
  ...process.env,
  AI_PM_RADAR_APP_PORT: appPort,
  AI_PM_RADAR_FETCH_PORT: helperPort,
  NEXT_PUBLIC_AI_PM_RADAR_FETCH_PORT: helperPort,
};

function checkPortAvailable(port, label) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(label + " port " + port + " is already in use. Stop the existing project process or choose another port.")));
    probe.listen(Number(port), "127.0.0.1", () => probe.close(resolve));
  });
}

try {
  await checkPortAvailable(appPort, "App");
  await checkPortAvailable(helperPort, "Source helper");
} catch (error) {
  console.error("Local startup blocked: " + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}

console.log("Starting AI PM Radar app at http://localhost:" + appPort + "/source-inbox/");
console.log("Starting local source helper at http://127.0.0.1:" + helperPort + "/");

const children = [
  { label: "App", child: spawn(npmCommand, ["run", "dev", "--", "--hostname", "127.0.0.1", "-p", appPort], { stdio: "inherit", env: childEnvironment }) },
  { label: "Source helper", child: spawn(process.execPath, ["--experimental-strip-types", "scripts/source-fetch-helper.mjs"], { stdio: "inherit", env: childEnvironment }) },
];

let shuttingDown = false;
function stopChildren(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 250);
}

for (const { label, child } of children) {
  child.on("error", (error) => {
    if (!shuttingDown) {
      console.error(label + " failed to start: " + error.message);
      stopChildren(1);
    }
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(label + " stopped unexpectedly (" + (signal ?? "exit " + code) + ").");
      stopChildren(code ?? 1);
    }
  });
}

process.on("SIGINT", () => stopChildren(0));
process.on("SIGTERM", () => stopChildren(0));
