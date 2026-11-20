import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseFeedXml } from "../lib/source-feed-parser.ts";
import { scoreLane } from "../cloud/src/curation.mjs";
import { writeLocalDailyFixture } from "./daily-radar-local-fixture.mjs";
import { hktDate, selectDailyCandidates } from "./daily-from-inbox.mjs";

export const RADAR_FEEDS = [
  { id: "openai", category: "AI_TECH_NEWS", url: "https://openai.com/news/rss.xml" },
  { id: "anthropic", category: "AI_TECH_NEWS", url: "https://www.anthropic.com/news/rss.xml" },
  { id: "techcrunch-ai", category: "AI_TECH_NEWS", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { id: "coursera-ai", category: "FREEBIE_CERT_DEAL", url: "https://blog.coursera.org/tag/ai/feed/" },
  { id: "huggingface", category: "FREEBIE_CERT_DEAL", url: "https://huggingface.co/blog/feed.xml" },
];
const HN_URL = "https://hn.algolia.com/api/v1/search_by_date?query=AI%20OR%20LLM&tags=story&hitsPerPage=30";
const SKIP_LIST_PATH = new URL("../config/source-skip-list.json", import.meta.url);
const SOURCE_IDS = new Set([...RADAR_FEEDS.map((feed) => feed.id), "hackernews"]);

export function validateSkipList(value) {
  if (!Array.isArray(value)) throw new Error("Source skip list must be an array.");
  const seen = new Set();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !SOURCE_IDS.has(entry.id) || seen.has(entry.id)
      || typeof entry.reason !== "string" || !entry.reason.trim()
      || ![entry.since, entry.review_by].every(validDate)
      || entry.review_by < entry.since) throw new Error("Invalid source skip list entry.");
    seen.add(entry.id);
  }
  return value;
}

export async function loadSkipList() {
  return validateSkipList(JSON.parse(await readFile(SKIP_LIST_PATH, "utf8")));
}

function failureStatus(error) {
  return error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "parse_error";
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function asSummary(value) { return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 1200) || null; }
function key(item) { return item.url || `${item.sourceId}:${item.externalId}`; }
function validator(value) { return typeof value === "string" && value.length <= 512 ? value : null; }

export async function collectDailyRadar({ fetchImpl = fetch, now = new Date().toISOString(), onSourceResult, validators = {}, skipList = null, sourceResults = [] } = {}) {
  const skipped = skipList ?? await loadSkipList();
  validateSkipList(skipped);
  const candidates = [];
  const report = (result) => { sourceResults.push(result); onSourceResult?.(result.id, result.status === "http_error" ? `http_${result.http_status}` : result.reason === "not_modified" ? "not_modified" : result.status); };
  for (const feed of RADAR_FEEDS) {
    const disabled = skipped.find((entry) => entry.id === feed.id);
    if (disabled) { report({ id: feed.id, url: feed.url, status: "disabled", items: 0, reason: disabled.reason }); continue; }
    try {
      const previous = validators[feed.id]?.url === feed.url ? validators[feed.id] : {};
      const response = await fetchImpl(feed.url, { signal: AbortSignal.timeout(8_000), headers: { accept: "application/rss+xml, application/atom+xml, application/xml", ...(validator(previous.etag) ? { "if-none-match": previous.etag } : {}), ...(validator(previous.last_modified) ? { "if-modified-since": previous.last_modified } : {}) } });
      if (response.status === 304) {
        validators[feed.id] = { url: feed.url, etag: validator(response.headers?.get?.("etag")) || previous.etag || null, last_modified: validator(response.headers?.get?.("last-modified")) || previous.last_modified || null };
        report({ id: feed.id, url: feed.url, status: "ok", items: 0, reason: "not_modified" });
        continue;
      }
      if (!response.ok) {
        report({ id: feed.id, url: feed.url, status: "http_error", http_status: response.status, items: 0, reason: `HTTP ${response.status}` });
        continue;
      }
      const parsed = parseFeedXml(await response.text(), feed.url, feed.id, now);
      validators[feed.id] = { url: feed.url, etag: validator(response.headers?.get?.("etag")), last_modified: validator(response.headers?.get?.("last-modified")) };
      const before = candidates.length;
      for (const item of parsed.items) {
        const text = `${item.title} ${item.summary ?? ""} ${item.content ?? ""}`;
        if (feed.category === "FREEBIE_CERT_DEAL" && !/\b(free|voucher|discount|scholarship|limited\s+time|no-cost)\b/i.test(text)) continue;
        candidates.push({
        id: `${feed.id}:${item.id}`, category: feed.category, sourceId: feed.id,
        title: item.title, url: item.article_url, summary: asSummary(item.summary),
        publishedAt: item.published_at, discoveredAt: now, reviewStatus: "needs_review",
        });
      }
      report({ id: feed.id, url: feed.url, status: "ok", items: candidates.length - before, reason: "fetched" });
    } catch (error) { report({ id: feed.id, url: feed.url, status: failureStatus(error), items: 0, reason: failureStatus(error) === "timeout" ? "request timed out" : "fetch or feed parse failed" }); }
  }
  const hnDisabled = skipped.find((entry) => entry.id === "hackernews");
  if (hnDisabled) report({ id: "hackernews", url: HN_URL, status: "disabled", items: 0, reason: hnDisabled.reason });
  else try {
    const response = await fetchImpl(HN_URL, { signal: AbortSignal.timeout(8_000), headers: { accept: "application/json" } });
    if (!response.ok) {
      report({ id: "hackernews", url: HN_URL, status: "http_error", http_status: response.status, items: 0, reason: `HTTP ${response.status}` });
    }
    else {
      const data = await response.json();
      const before = candidates.length;
      for (const hit of data.hits ?? []) {
        const title = typeof hit.title === "string" ? hit.title : "";
        const points = Number(hit.points ?? 0);
        const comments = Number(hit.num_comments ?? 0);
        if (!title || (!/\b(ai|llm|gpt|model|agent|openai|anthropic)\b/i.test(title))) continue;
        candidates.push({
          id: `hn:${hit.objectID}`, category: "SOCIAL_VIRAL_STRATEGY", sourceId: "hackernews",
          title, url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          summary: asSummary(hit.story_text), publishedAt: hit.created_at ?? null,
          discoveredAt: now, reviewStatus: "needs_review", heat: { points, comments },
        });
      }
      report({ id: "hackernews", url: HN_URL, status: "ok", items: candidates.length - before, reason: "fetched" });
    }
  } catch (error) { report({ id: "hackernews", url: HN_URL, status: failureStatus(error), items: 0, reason: failureStatus(error) === "timeout" ? "request timed out" : "fetch or JSON parse failed" }); }
  const unique = new Map();
  for (const item of candidates) if (!unique.has(key(item))) unique.set(key(item), item);
  return [...unique.values()].map((item) => ({
    ...item,
    ...scoreLane({ title: item.title, summary: item.summary, category: item.category, published_at: item.publishedAt }, { nowMs: Date.parse(now) }),
  }));
}

export async function writeInbox(items, filePath, validators) {
  const target = resolve(filePath);
  let existing = [];
  let existingValidators = {};
  try {
    const value = JSON.parse(await readFile(target, "utf8"));
    if (!value || !Array.isArray(value.items)) throw new Error("Invalid inbox schema.");
    existing = value.items;
    existingValidators = value.validators && typeof value.validators === "object" && !Array.isArray(value.validators) ? value.validators : {};
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error("Existing local inbox is unreadable; refusing to overwrite it.");
  }
  const byKey = new Map([...existing, ...items].map((item) => [key(item), item]));
  const next = { version: 1, updatedAt: new Date().toISOString(), items: [...byKey.values()], validators: validators ?? existingValidators };
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return next;
}

async function main() {
  if (process.argv[2] === "--fixture") {
    try {
      const target = await writeLocalDailyFixture(process.argv[3], resolve(process.argv[4] || "data/daily"));
      console.log(`Wrote synthetic local QA fixture: ${target}`);
    } catch (error) {
      console.error(error?.code === "EEXIST" ? "Refusing to overwrite an existing daily JSON file." : `Could not write fixture: ${error.message}`);
      process.exitCode = 1;
    }
    return;
  }
  const output = process.env.RADAR_INBOX_PATH || ".runtime/daily-radar-inbox.json";
  let validators = {};
  try {
    const existing = JSON.parse(await readFile(output, "utf8"));
    if (!Array.isArray(existing.items)) throw new Error("Invalid inbox schema.");
    validators = existing.validators && typeof existing.validators === "object" && !Array.isArray(existing.validators) ? existing.validators : {};
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error("Existing local inbox is unreadable; refusing to overwrite it.");
  }
  const sourceResults = [];
  const now = new Date();
  const items = await collectDailyRadar({ now: now.toISOString(), validators, sourceResults });
  const eligibleCount = selectDailyCandidates(items, now).eligibleCount;
  const exitCode = eligibleCount >= 3 ? 0 : 3;
  const run = { date: hktDate(now), started_at: now.toISOString(), sources: sourceResults, counts: { collected: items.length, eligible: eligibleCount, ok: sourceResults.filter((source) => source.status === "ok").length, skipped: sourceResults.filter((source) => source.status !== "ok").length }, decision: exitCode === 0 ? "daily_allowed" : "daily_blocked", exit_code: exitCode };
  const runDir = resolve(".runtime/collector-runs");
  await mkdir(runDir, { recursive: true });
  const logPath = resolve(runDir, `${now.toISOString().replace(/[:.]/gu, "-")}-${process.pid}-collector.json`);
  await writeFile(logPath, `${JSON.stringify(run, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(`Source checks: ${run.counts.ok}/${sourceResults.length} succeeded; ${run.counts.skipped} skipped. Run log: ${logPath}`);
  for (const source of sourceResults) if (source.status !== "ok") console.error(`Source skipped: ${source.id} (${source.status}${source.http_status ? ` ${source.http_status}` : ""}): ${source.reason}.`);
  if (exitCode) { console.error(`Daily collection blocked: ${eligibleCount} eligible candidates; need at least 3. Existing inbox was left unchanged.`); process.exitCode = exitCode; return; }
  const inbox = await writeInbox(items, output, validators);
  console.log(`Collected ${items.length} candidates; inbox has ${inbox.items.length} deduplicated items awaiting human review.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
