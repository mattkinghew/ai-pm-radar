import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseFeedXml } from "../lib/source-feed-parser.ts";

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

export async function collectDailyRadar({ fetchImpl = fetch, now = new Date().toISOString() } = {}) {
  const candidates = [];
  for (const feed of RADAR_FEEDS) {
    try {
      const response = await fetchImpl(feed.url, { headers: { accept: "application/rss+xml, application/atom+xml, application/xml" } });
      if (!response.ok) continue;
      const parsed = parseFeedXml(await response.text(), feed.url, feed.id, now);
      for (const item of parsed.items) {
        const text = `${item.title} ${item.summary ?? ""} ${item.content ?? ""}`;
        if (feed.category === "FREEBIE_CERT_DEAL" && !/\b(free|voucher|discount|scholarship|limited\s+time|no-cost)\b/i.test(text)) continue;
        candidates.push({
        id: `${feed.id}:${item.id}`, category: feed.category, sourceId: feed.id,
        title: item.title, url: item.article_url, summary: asSummary(item.summary),
        publishedAt: item.published_at, discoveredAt: now, reviewStatus: "needs_review",
        });
      }
    } catch { /* An unavailable or malformed public feed must not block other sources. */ }
  }
  try {
    const response = await fetchImpl(HN_URL, { headers: { accept: "application/json" } });
    if (response.ok) {
      const data = await response.json();
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
  } catch { /* Social discovery is best effort and stays review-gated. */ }
  const unique = new Map();
  for (const item of candidates) if (!unique.has(key(item))) unique.set(key(item), item);
  return [...unique.values()];
}

export async function writeInbox(items, filePath) {
  const target = resolve(filePath);
  let existing = [];
  try {
    const value = JSON.parse(await readFile(target, "utf8"));
    if (!value || !Array.isArray(value.items)) throw new Error("Invalid inbox schema.");
    existing = value.items;
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error("Existing local inbox is unreadable; refusing to overwrite it.");
  }
  const byKey = new Map([...existing, ...items].map((item) => [key(item), item]));
  const next = { version: 1, updatedAt: new Date().toISOString(), items: [...byKey.values()] };
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return next;
}

async function main() {
  const output = process.env.RADAR_INBOX_PATH || ".runtime/daily-radar-inbox.json";
  const items = await collectDailyRadar();
  const inbox = await writeInbox(items, output);
  console.log(`Collected ${items.length} candidates; inbox has ${inbox.items.length} deduplicated items awaiting human review.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
