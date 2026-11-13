import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseFeedXml } from "../lib/source-feed-parser.ts";
import { scoreLane } from "../cloud/src/curation.mjs";
import { writeLocalDailyFixture } from "./daily-radar-local-fixture.mjs";

export const RADAR_FEEDS = [
  { id: "openai", category: "AI_TECH_NEWS", url: "https://openai.com/news/rss.xml" },
  { id: "anthropic", category: "AI_TECH_NEWS", url: "https://www.anthropic.com/news/rss.xml" },
  { id: "techcrunch-ai", category: "AI_TECH_NEWS", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { id: "coursera-ai", category: "FREEBIE_CERT_DEAL", url: "https://blog.coursera.org/tag/ai/feed/" },
  { id: "huggingface", category: "FREEBIE_CERT_DEAL", url: "https://huggingface.co/blog/feed.xml" },
];
const HN_URL = "https://hn.algolia.com/api/v1/search_by_date?query=AI%20OR%20LLM&tags=story&hitsPerPage=30";

function asSummary(value) { return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 1200) || null; }
function key(item) { return item.url || `${item.sourceId}:${item.externalId}`; }
function validator(value) { return typeof value === "string" && value.length <= 512 ? value : null; }

export async function collectDailyRadar({ fetchImpl = fetch, now = new Date().toISOString(), onSourceResult, validators = {} } = {}) {
  const candidates = [];
  let forbiddenByNetwork = false;
  for (const feed of RADAR_FEEDS) {
    try {
      const previous = validators[feed.id]?.url === feed.url ? validators[feed.id] : {};
      const response = await fetchImpl(feed.url, { headers: { accept: "application/rss+xml, application/atom+xml, application/xml", ...(validator(previous.etag) ? { "if-none-match": previous.etag } : {}), ...(validator(previous.last_modified) ? { "if-modified-since": previous.last_modified } : {}) } });
      if (response.status === 304) {
        validators[feed.id] = { url: feed.url, etag: validator(response.headers?.get?.("etag")) || previous.etag || null, last_modified: validator(response.headers?.get?.("last-modified")) || previous.last_modified || null };
        onSourceResult?.(feed.id, "not_modified");
        continue;
      }
      if (!response.ok) {
        onSourceResult?.(feed.id, `http_${response.status}`);
        if (response.status === 403) { forbiddenByNetwork = true; break; }
        continue;
      }
      const parsed = parseFeedXml(await response.text(), feed.url, feed.id, now);
      validators[feed.id] = { url: feed.url, etag: validator(response.headers?.get?.("etag")), last_modified: validator(response.headers?.get?.("last-modified")) };
      onSourceResult?.(feed.id, "ok");
      for (const item of parsed.items) {
        const text = `${item.title} ${item.summary ?? ""} ${item.content ?? ""}`;
        if (feed.category === "FREEBIE_CERT_DEAL" && !/\b(free|voucher|discount|scholarship|limited\s+time|no-cost)\b/i.test(text)) continue;
        candidates.push({
        id: `${feed.id}:${item.id}`, category: feed.category, sourceId: feed.id,
        title: item.title, url: item.article_url, summary: asSummary(item.summary),
        publishedAt: item.published_at, discoveredAt: now, reviewStatus: "needs_review",
        });
      }
    } catch { onSourceResult?.(feed.id, "error"); /* An unavailable or malformed public feed must not block other sources. */ }
  }
  if (!forbiddenByNetwork) try {
    const response = await fetchImpl(HN_URL, { headers: { accept: "application/json" } });
    if (!response.ok) {
      onSourceResult?.("hackernews", `http_${response.status}`);
      if (response.status === 403) forbiddenByNetwork = true;
    }
    else {
      const data = await response.json();
      onSourceResult?.("hackernews", "ok");
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
    }
  } catch { onSourceResult?.("hackernews", "error"); /* Social discovery is best effort and stays review-gated. */ }
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
  const results = [];
  const items = await collectDailyRadar({ validators, onSourceResult: (source, result) => results.push({ source, result }) });
  const succeeded = results.filter(({ result }) => result === "ok" || result === "not_modified").length;
  console.log(`Source checks: ${succeeded}/${results.length} succeeded; ${results.length - succeeded} failed.`);
  for (const { source, result } of results) if (result !== "ok" && result !== "not_modified") console.error(`Source failure: ${source} (${result}).`);
  if (results.some(({ result }) => result === "http_403")) {
    console.error("Daily collection stopped after HTTP 403; check VPN/network access before retrying. Existing inbox was left unchanged.");
    process.exitCode = 3;
    return;
  }
  if (succeeded === 0) {
    console.error("Daily collection failed: no source was reachable; existing inbox was left unchanged.");
    process.exitCode = 1;
    return;
  }
  const inbox = await writeInbox(items, output, validators);
  console.log(`Collected ${items.length} candidates; inbox has ${inbox.items.length} deduplicated items awaiting human review.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
