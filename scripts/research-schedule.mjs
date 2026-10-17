import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { hongKongDate, RESEARCH_TIMEZONE } from "../lib/research-runtime.ts";
import {
  getRuntimeDir,
  isLockActive,
  readRuntimeConfig,
  readRuntimeState,
  runtimePaths,
  writeRuntimeConfig,
} from "./research-runtime.mjs";

const LABEL = "com.ai-pm-radar.research";
const repoDir = path.resolve(new URL(".", import.meta.url).pathname, "..");
const plistPath = path.join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);

function xml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function launchDomain() {
  return `gui/${process.getuid?.() ?? ""}`;
}

function launchctl(args) {
  if (process.platform !== "darwin") return { ok: false, output: "launchd is only available on macOS." };
  try {
    return { ok: true, output: execFileSync("launchctl", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (error) {
    return { ok: false, output: error?.stderr?.toString()?.trim() || error?.stdout?.toString()?.trim() || "not loaded" };
  }
}

export function buildLaunchAgentPlist(runtimeDir) {
  const nodePath = process.execPath;
  const runnerPath = path.join(repoDir, "scripts", "research-runner.mjs");
  const logPath = runtimePaths(runtimeDir).log;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${xml(LABEL)}</string>
<key>ProgramArguments</key><array>
<string>${xml(nodePath)}</string><string>--experimental-strip-types</string><string>${xml(runnerPath)}</string><string>--scheduled</string>
</array>
<key>WorkingDirectory</key><string>${xml(repoDir)}</string>
<key>EnvironmentVariables</key><dict><key>AI_PM_RADAR_RUNTIME_DIR</key><string>${xml(runtimeDir)}</string></dict>
<key>StartInterval</key><integer>300</integer>
<key>RunAtLoad</key><false/>
<key>StandardOutPath</key><string>${xml(logPath)}</string>
<key>StandardErrorPath</key><string>${xml(logPath)}</string>
</dict></plist>
`;
}

export function nextWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: RESEARCH_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour > 8 || (hour === 8 && minute >= 0)
    ? "下一個香港日期 08:00 後的首次 5 分鐘喚醒"
    : "今天 08:00 後的首次 5 分鐘喚醒";
}

async function status() {
  const runtimeDir = getRuntimeDir();
  const config = await readRuntimeConfig(runtimeDir);
  const state = await readRuntimeState(runtimeDir);
  const [loaded, lock] = [launchctl(["print", `${launchDomain()}/${LABEL}`]), await isLockActive(runtimeDir)];
  console.log(JSON.stringify({
    platform: process.platform,
    label: LABEL,
    plist_path: plistPath,
    runtime_dir: runtimeDir,
    configured: Boolean(config),
    schedule_enabled: Boolean(config?.schedule?.enabled),
    collection_enabled: Boolean(config?.collection_enabled),
    analysis_enabled: Boolean(config?.analysis_enabled),
    timezone: RESEARCH_TIMEZONE,
    current_date: hongKongDate(),
    next_window: nextWindow(),
    launchd_loaded: loaded.ok,
    launchd_detail: loaded.ok ? "loaded" : loaded.output,
    runner_active: lock.active,
    runner_pid: lock.pid,
    runner_started_at: lock.started_at,
    last_run: state.last_run,
  }, null, 2));
}

async function enable() {
  if (process.platform !== "darwin") throw new Error("macOS launchd is required for the local schedule.");
  const runtimeDir = getRuntimeDir();
  const config = await readRuntimeConfig(runtimeDir);
  if (!config) throw new Error("先在來源工作台把已選來源交給本機 runner，再啟用排程。");
  await writeRuntimeConfig({ ...config, schedule: { ...config.schedule, enabled: true } }, runtimeDir);
  await mkdir(path.dirname(plistPath), { recursive: true, mode: 0o700 });
  await writeFile(plistPath, buildLaunchAgentPlist(runtimeDir), { encoding: "utf8", mode: 0o600 });
  launchctl(["bootout", launchDomain(), plistPath]);
  const result = launchctl(["bootstrap", launchDomain(), plistPath]);
  if (!result.ok) throw new Error(`launchd 啟用失敗：${result.output}`);
  console.log(`已啟用 ${LABEL}；${RESEARCH_TIMEZONE} 每日 08:00 後執行一次，系統需開機及可用網絡。`);
}

async function disable() {
  if (process.platform !== "darwin") throw new Error("macOS launchd is required for the local schedule.");
  const runtimeDir = getRuntimeDir();
  const config = await readRuntimeConfig(runtimeDir);
  if (config) await writeRuntimeConfig({ ...config, schedule: { ...config.schedule, enabled: false } }, runtimeDir);
  const lock = await isLockActive(runtimeDir);
  if (lock.active) {
    console.log(`已停用新排程請求；目前 runner pid ${lock.pid ?? "unknown"} 仍在執行。完成後再執行 disable 或 remove 以卸載 LaunchAgent。`);
    return;
  }
  launchctl(["bootout", launchDomain(), plistPath]);
  console.log(`已停用 ${LABEL}；LaunchAgent 設定檔保留，來源與研究結果仍保留。`);
}

async function remove() {
  if (process.platform !== "darwin") throw new Error("macOS launchd is required for the local schedule.");
  const runtimeDir = getRuntimeDir();
  const config = await readRuntimeConfig(runtimeDir);
  if (config) await writeRuntimeConfig({ ...config, schedule: { ...config.schedule, enabled: false } }, runtimeDir);
  const lock = await isLockActive(runtimeDir);
  if (lock.active) throw new Error(`排程已停用，但 runner pid ${lock.pid ?? "unknown"} 仍在執行；完成後再執行 remove。`);
  launchctl(["bootout", launchDomain(), plistPath]);
  await unlink(plistPath).catch(() => {});
  console.log(`已移除 ${LABEL} LaunchAgent；來源、設定及研究結果仍保留。`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] ?? "status";
  try {
    if (command === "status") await status();
    else if (command === "enable") await enable();
    else if (command === "disable") await disable();
    else if (command === "remove") await remove();
    else throw new Error("用法：npm run research:schedule -- status|enable|disable|remove");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
