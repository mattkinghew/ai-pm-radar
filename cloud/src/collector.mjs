import { XMLParser } from "fast-xml-parser";
import { summarize, hktDay } from "./ai.mjs";

export const FEEDS = [
  { id: "openai", category: "AI_TECH_NEWS", url: "https://openai.com/news/rss.xml" },
  { id: "anthropic", category: "AI_TECH_NEWS", url: "https://www.anthropic.com/news/rss.xml" },
  { id: "techcrunch-ai", category: "AI_TECH_NEWS", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { id: "coursera-ai", category: "FREEBIE_CERT_DEAL", url: "https://blog.coursera.org/tag/ai/feed/" },
  { id: "huggingface", category: "FREEBIE_CERT_DEAL", url: "https://huggingface.co/blog/feed.xml" },
];
export const HN_URL = "https://hn.algolia.com/api/v1/search_by_date?query=AI%20OR%20LLM&tags=story&hitsPerPage=30";
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
export const decodeEntities = (s) => String(s ?? "").replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/giu, (m, d, h, n) => d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : NAMED[n.toLowerCase()] ?? m);
const strip = (s) => decodeEntities(decodeEntities(String(s ?? "").replace(/<!\[CDATA\[|\]\]>/gu, "")).replace(/<[^>]+>/gu, " ")).replace(/\s+/gu, " ").trim();

export function parseFeed(xml, feed, limit = 5) {
  const doc = new XMLParser({ ignoreAttributes: false }).parse(xml);
  const raw = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  return (Array.isArray(raw) ? raw : [raw]).slice(0, limit).map((it) => ({
    title: strip(it.title?.["#text"] ?? it.title),
    url: typeof it.link === "string" ? it.link : (it.link?.["@_href"] ?? (Array.isArray(it.link) ? it.link[0]?.["@_href"] : "")),
    excerpt: strip(it.description ?? it.summary?.["#text"] ?? it.summary ?? it["content:encoded"]).slice(0, 3000),
    source: feed.id, category: feed.category,
  })).filter((x) => x.title && x.url);
}

export async function userFeeds(db) {
  try { return ((await db.prepare("SELECT id,value,label FROM sources WHERE type='rss' AND enabled=1 ORDER BY created_at LIMIT 20").all()).results || [])
    .map((r) => ({ id: `user:${r.label || new URL(r.value).hostname}`.slice(0, 60), category: "USER_SOURCE", url: r.value })); } catch { return []; }
}
export async function collect(fetchImpl = fetch, extra = []) {
  const out = [];
  for (const feed of [...FEEDS, ...extra]) {
    try { const r = await fetchImpl(feed.url, { headers: { "user-agent": "ai-pm-radar-cloud/1" } }); if (r.ok) out.push(...parseFeed(await r.text(), feed)); } catch { /* skip feed */ }
  }
  try {
    const r = await fetchImpl(HN_URL);
    if (r.ok) for (const h of ((await r.json()).hits ?? []).slice(0, 10)) if (h.title) out.push({
      title: decodeEntities(h.title), url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, excerpt: h.title, source: "hn", category: "AI_TECH_NEWS" });
  } catch { /* skip */ }
  return out;
}

export const AI_UPDATE = "UPDATE items SET summary=?, key_points=?, score=?, ai_provider=?, title_zh=?, title_original=COALESCE(NULLIF(?,''), title_original, title), summary_en=?, key_points_en=?, reco_score=?, reco_reason=?, side_income_new=?, side_income_reason=?, updated_at=? WHERE id=?";
export const aiBind = (ai, original, now, id) => [ai.summary, JSON.stringify(ai.key_points), ai.score, ai.provider, ai.title_zh, original ?? "", ai.summary_en, JSON.stringify(ai.key_points_en), ai.reco_score, ai.reco_reason, ai.side_income_new ?? 0, ai.side_income_reason ?? null, now, id];

// Collect built-in + user RSS, then analyze every un-analyzed item of the day (incl. X posts ingested by Jun) within caps.
export async function runDaily(env, { fetchImpl = fetch, nowMs = Date.now() } = {}) {
  const day = hktDay(nowMs); const now = new Date(nowMs).toISOString(); const runId = crypto.randomUUID();
  const items = await collect(fetchImpl, await userFeeds(env.DB));
  let collected = 0, analyzed = 0, error = null;
  for (const it of items) {
    const res = await env.DB.prepare(`INSERT OR IGNORE INTO items(id,kind,status,title,url,source,category,raw_excerpt,run_date,created_at,updated_at)
      VALUES(?, 'daily', 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), it.title, it.url, it.source, it.category, it.excerpt, day, now, now).run();
    if (res.meta?.changes > 0) collected++;
  }
  if (env.AI_ANALYSIS_ENABLED !== "false") ({ analyzed, error } = await analyzePending(env, { fetchImpl, nowMs, day }));
  await env.DB.prepare("INSERT INTO runs(id,started_at,finished_at,collected,analyzed,error) VALUES(?,?,?,?,?,?)")
    .bind(runId, now, new Date().toISOString(), collected, analyzed, error).run();
  return { collected, analyzed, error };
}

export async function analyzePending(env, { fetchImpl = fetch, nowMs = Date.now(), day = hktDay(nowMs), limit = 120 } = {}) {
  const now = new Date(nowMs).toISOString(); let analyzed = 0, error = null;
  const rows = (await env.DB.prepare("SELECT id,title,url,raw_excerpt FROM items WHERE kind='daily' AND run_date=? AND ai_provider IS NULL ORDER BY created_at LIMIT ?").bind(day, limit).all()).results || [];
  for (const it of rows) {
    try {
      const ai = await summarize(env, `${it.title}\n${it.url}\n${it.raw_excerpt || ""}`, { fetchImpl, nowMs });
      await env.DB.prepare(AI_UPDATE).bind(...aiBind(ai, it.title, now, it.id)).run(); analyzed++;
    } catch (e) { if (e.message === "ai_daily_cap_reached") { error = "cap_reached"; break; } }
  }
  return { analyzed, error };
}
