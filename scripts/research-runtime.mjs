import { access, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  DEFAULT_RESEARCH_PROJECTS,
  RESEARCH_RUNTIME_VERSION,
  RESEARCH_TIMEZONE,
  emptyResearchState,
  hongKongDate,
} from "../lib/research-runtime.ts";
import { createAnalysisSourceSnapshot } from "../lib/ai-analysis.ts";
import { normaliseFeedUrl } from "../lib/source-feed.ts";

const repoDir = path.resolve(new URL(".", import.meta.url).pathname, "..");
const DEFAULT_RUNTIME_DIR = path.join(repoDir, ".runtime", "research");
const LOCK_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

export function getRuntimeDir(env = process.env) {
  return path.resolve(expandHome(env.AI_PM_RADAR_RUNTIME_DIR?.trim() || DEFAULT_RUNTIME_DIR));
}

export function runtimePaths(runtimeDir = getRuntimeDir()) {
  return {
    dir: runtimeDir,
    config: path.join(runtimeDir, "config.json"),
    state: path.join(runtimeDir, "state.json"),
    lock: path.join(runtimeDir, "run.lock"),
    log: path.join(runtimeDir, "runner.log"),
  };
}

export async function ensureRuntimeDir(runtimeDir = getRuntimeDir()) {
  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  return runtimePaths(runtimeDir);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporaryPath, filePath);
}

function safeText(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeSubscription(value) {
  const feedUrl = normaliseFeedUrl(safeText(value?.feed_url, 2048));
  return {
    id: safeText(value?.id, 120),
    name: safeText(value?.name, 200),
    feed_url: feedUrl,
    expert_name: safeText(value?.expert_name, 200),
    reason: safeText(value?.reason, 500),
    topic_tags: Array.isArray(value?.topic_tags) ? value.topic_tags.map((tag) => safeText(tag, 80)).filter(Boolean).slice(0, 20) : [],
    priority: value?.priority === "high" || value?.priority === "low" ? value.priority : "medium",
    enabled: value?.enabled !== false,
    last_attempted_at: typeof value?.last_attempted_at === "string" ? value.last_attempted_at : null,
    last_successful_at: typeof value?.last_successful_at === "string" ? value.last_successful_at : null,
    etag: typeof value?.etag === "string" ? value.etag.slice(0, 512) : null,
    last_modified: typeof value?.last_modified === "string" ? value.last_modified.slice(0, 512) : null,
    recent_runs: Array.isArray(value?.recent_runs) ? value.recent_runs.slice(0, 20) : [],
  };
}

function safeProject(value) {
  return {
    id: safeText(value?.id, 80),
    name: safeText(value?.name, 120),
    goal: safeText(value?.goal, 500),
    stage: safeText(value?.stage, 120),
    blocker: safeText(value?.blocker, 500),
    non_goal: safeText(value?.non_goal, 500),
    priority: value?.priority === "high" || value?.priority === "low" ? value.priority : "medium",
    updated_at: typeof value?.updated_at === "string" ? value.updated_at : null,
  };
}

export function validateRuntimeConfig(value) {
  if (!value || typeof value !== "object") throw new Error("Research runtime config must be an object.");
  if (![1, 2, RESEARCH_RUNTIME_VERSION].includes(value.version)) throw new Error("Unsupported research runtime config version.");
  if (!Array.isArray(value.subscriptions)) throw new Error("Research runtime subscriptions are invalid.");
  const subscriptions = value.subscriptions.map(safeSubscription);
  if (subscriptions.some((item) => !item.id || !item.name || !item.feed_url)) throw new Error("Each research source needs an id, name, and feed URL.");
  if (subscriptions.filter((item) => item.enabled).length > 12) throw new Error("At most 12 research sources may be enabled.");
  const projects = Array.isArray(value.projects) ? value.projects.map(safeProject).filter((item) => item.id && item.name) : DEFAULT_RESEARCH_PROJECTS;
  return {
    version: RESEARCH_RUNTIME_VERSION,
    saved_at: new Date().toISOString(),
    timezone: RESEARCH_TIMEZONE,
    collection_enabled: value.collection_enabled === true,
    analysis_enabled: value.analysis_enabled === true,
    schedule: {
      enabled: value.schedule?.enabled === true,
      timezone: RESEARCH_TIMEZONE,
      hour: 8,
      minute: 0,
    },
    subscriptions,
    projects,
  };
}

export async function readRuntimeConfig(runtimeDir = getRuntimeDir()) {
  const parsed = await readJson(runtimePaths(runtimeDir).config);
  return parsed ? validateRuntimeConfig(parsed) : null;
}

export async function writeRuntimeConfig(value, runtimeDir = getRuntimeDir()) {
  const config = validateRuntimeConfig(value);
  await writeJsonAtomic(runtimePaths(runtimeDir).config, config);
  return config;
}

export async function readRuntimeState(runtimeDir = getRuntimeDir()) {
  const parsed = await readJson(runtimePaths(runtimeDir).state);
  if (!parsed) return emptyResearchState();
  if (![1, 2, RESEARCH_RUNTIME_VERSION].includes(parsed.version) || !Array.isArray(parsed.materials) || !Array.isArray(parsed.feed_items)) {
    throw new Error("Unsupported or invalid research runtime state.");
  }
  const empty = emptyResearchState(parsed.daily?.date);
  const priorRuns = (parsed.runs ?? []).filter((run) => run.date === parsed.daily?.date);
  const legacyQuota = parsed.daily?.quota ?? {
    source_attempts: priorRuns.reduce((sum, run) => sum + (run.feeds_attempted ?? 0), 0),
    body_attempts: priorRuns.reduce((sum, run) => sum + (run.body_attempted ?? 0), 0),
    analysis_attempts: priorRuns.reduce((sum, run) => sum + (run.analyses_attempted ?? 0), 0),
    briefs_created: (parsed.materials ?? []).filter((material) => material.brief && new Intl.DateTimeFormat("en-CA", { timeZone: RESEARCH_TIMEZONE }).format(new Date(material.brief.generated_at)) === parsed.daily?.date).length,
    actions_suggested: Math.min(1, (parsed.materials ?? []).filter((material) => material.brief?.suggested_action && new Intl.DateTimeFormat("en-CA", { timeZone: RESEARCH_TIMEZONE }).format(new Date(material.brief.generated_at)) === parsed.daily?.date).length),
  };
  const quota = legacyQuota;
  return {
    ...parsed,
    version: RESEARCH_RUNTIME_VERSION,
    materials: parsed.materials.map((material) => ({
      ...material,
      source_version: material.source_version ?? createAnalysisSourceSnapshot(material.source_record).source_version,
      result_version: Number.isInteger(material.result_version) ? material.result_version : material.brief ? 1 : 0,
      brief: material.brief ? {
        ...material.brief,
        version: 3,
        source_dates: material.brief.source_dates ?? {
          published_at: material.feed_item.published_at ?? null,
          updated_at: material.feed_item.updated_at ?? null,
          discovered_at: material.feed_item.discovered_at ?? material.created_at,
        },
        selection_reasons: material.brief.selection_reasons ?? material.selection_reasons ?? [],
        project_recommendations: (material.brief.project_recommendations ?? []).map((recommendation) => ({
          ...recommendation,
          project_updated_at: recommendation.project_updated_at ?? null,
          matched_goal: recommendation.matched_goal ?? null,
          matched_blocker: recommendation.matched_blocker ?? null,
        })),
      } : null,
      selection_reasons: Array.isArray(material.selection_reasons) ? material.selection_reasons : [],
    })),
    runs: (parsed.runs ?? []).map((run) => ({
      ...run,
      skipped_items: Number.isInteger(run.skipped_items) ? run.skipped_items : 0,
      manual_input_items: Number.isInteger(run.manual_input_items) ? run.manual_input_items : 0,
      stages: run.stages ?? {
        feed_sync: run.feeds_attempted > 0 ? (run.failures > 0 ? "partial" : "completed") : "skipped",
        selection: "completed",
        body_capture: run.body_attempted > 0 ? (run.failures > 0 ? "partial" : "completed") : "skipped",
        analysis: run.analyses_attempted > 0 ? (run.failures > 0 ? "partial" : "completed") : "skipped",
        brief: run.drafts_created > 0 ? "completed" : "skipped",
      },
    })),
    last_run: parsed.last_run ? {
      ...parsed.last_run,
      skipped_items: Number.isInteger(parsed.last_run.skipped_items) ? parsed.last_run.skipped_items : 0,
      manual_input_items: Number.isInteger(parsed.last_run.manual_input_items) ? parsed.last_run.manual_input_items : 0,
      stages: parsed.last_run.stages ?? {
        feed_sync: parsed.last_run.feeds_attempted > 0 ? (parsed.last_run.failures > 0 ? "partial" : "completed") : "skipped",
        selection: "completed",
        body_capture: parsed.last_run.body_attempted > 0 ? (parsed.last_run.failures > 0 ? "partial" : "completed") : "skipped",
        analysis: parsed.last_run.analyses_attempted > 0 ? (parsed.last_run.failures > 0 ? "partial" : "completed") : "skipped",
        brief: parsed.last_run.drafts_created > 0 ? "completed" : "skipped",
      },
    } : null,
    daily: {
      ...empty.daily,
      ...(parsed.daily ?? {}),
      skipped_items: Number.isInteger(parsed.daily?.skipped_items) ? parsed.daily.skipped_items : 0,
      needs_manual_input: Number.isInteger(parsed.daily?.needs_manual_input) ? parsed.daily.needs_manual_input : 0,
      quota: {
        ...empty.daily.quota,
        ...(quota ?? {}),
      },
    },
  };
}

export async function writeRuntimeState(state, runtimeDir = getRuntimeDir()) {
  const next = { ...state, version: RESEARCH_RUNTIME_VERSION, saved_at: new Date().toISOString() };
  await writeJsonAtomic(runtimePaths(runtimeDir).state, next);
  return next;
}

export async function isLockActive(runtimeDir = getRuntimeDir()) {
  const lockPath = runtimePaths(runtimeDir).lock;
  try {
    const lock = JSON.parse(await readFile(lockPath, "utf8"));
    if (lock?.pid && Number.isInteger(lock.pid)) {
      try {
        process.kill(lock.pid, 0);
        return { active: true, pid: lock.pid, started_at: lock.started_at ?? null };
      } catch (error) {
        if (error?.code === "EPERM") return { active: true, pid: lock.pid, started_at: lock.started_at ?? null };
        if (error?.code !== "ESRCH") return { active: true, pid: lock.pid, started_at: lock.started_at ?? null };
        await unlink(lockPath).catch(() => {});
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") return { active: true, pid: null, started_at: null };
  }
  return { active: false, pid: null, started_at: null };
}

export async function acquireRunLock(runtimeDir = getRuntimeDir()) {
  const paths = await ensureRuntimeDir(runtimeDir);
  try {
    const handle = await open(paths.lock, "wx", 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
    await handle.close();
    return async () => unlink(paths.lock).catch(() => {});
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const current = await isLockActive(runtimeDir);
    if (!current.active) {
      await unlink(paths.lock).catch(() => {});
      return acquireRunLock(runtimeDir);
    }
    throw new Error(`Research runner is already active (pid ${current.pid ?? "unknown"}).`);
  }
}

export function isResearchDue(config, state, now = new Date()) {
  if (!config?.schedule?.enabled || (!config.collection_enabled && !config.analysis_enabled)) return false;
  const date = hongKongDate(now);
  if (state?.last_run?.date === date && ["running", "completed", "partial", "failed", "skipped"].includes(state.last_run.status)) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: RESEARCH_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour > config.schedule.hour || (hour === config.schedule.hour && minute >= config.schedule.minute);
}

export function runtimeStatus(config, state, lock, now = new Date()) {
  const date = hongKongDate(now);
  const currentRun = state?.last_run?.date === date ? state.last_run : null;
  return {
    configured: Boolean(config),
    runtime_version: RESEARCH_RUNTIME_VERSION,
    timezone: RESEARCH_TIMEZONE,
    collection_enabled: Boolean(config?.collection_enabled),
    analysis_enabled: Boolean(config?.analysis_enabled),
    projects: config?.projects ?? DEFAULT_RESEARCH_PROJECTS,
    schedule: config?.schedule ?? { enabled: false, timezone: RESEARCH_TIMEZONE, hour: 8, minute: 0 },
    enabled_source_count: config?.subscriptions?.filter((source) => source.enabled).length ?? 0,
    current_date: date,
    current_run: currentRun,
    last_run: state?.last_run ?? null,
    daily_quota: currentRun?.date === date ? state?.daily?.quota ?? null : null,
    lock,
  };
}

export async function appendRuntimeLog(message, runtimeDir = getRuntimeDir()) {
  const paths = await ensureRuntimeDir(runtimeDir);
  await writeFile(paths.log, `${new Date().toISOString()} ${message}\n`, { encoding: "utf8", mode: 0o600, flag: "a" });
}

export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function runtimeMtime(runtimeDir = getRuntimeDir()) {
  try {
    return (await stat(runtimePaths(runtimeDir).state)).mtime.toISOString();
  } catch {
    return null;
  }
}
