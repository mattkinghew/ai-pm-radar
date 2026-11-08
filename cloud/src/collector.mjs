import { XMLParser } from "fast-xml-parser";
import { summarize, hktDay, reserveAutoItem } from "./ai.mjs";
import { normalizeUrl } from "./curation.mjs";

export const FEEDS = [
  { id: "openai", category: "AI_TECH_NEWS", url: "https://openai.com/news/rss.xml" },
  { id: "anthropic", category: "AI_TECH_NEWS", url: "https://www.anthropic.com/news/rss.xml" },
  { id: "techcrunch-ai", category: "AI_TECH_NEWS", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { id: "coursera-ai", category: "FREEBIE_CERT_DEAL", url: "https://blog.coursera.org/tag/ai/feed/" },
  { id: "huggingface", category: "FREEBIE_CERT_DEAL", url: "https://huggingface.co/blog/feed.xml" },
  // Added 2026-11-01 after curl check (HTTP 200 + valid RSS/Atom with items).
  { id: "mit-tr-ai", category: "AI_TECH_NEWS", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { id: "google-ai", category: "AI_TECH_NEWS", url: "https://blog.google/technology/ai/rss/" },
  { id: "verge-ai", category: "AI_TECH_NEWS", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { id: "simonwillison", category: "AI_PRACTICE", url: "https://simonwillison.net/atom/everything/" },
  { id: "rundown-ai", category: "AI_TECH_NEWS", url: "https://www.therundown.ai/feed" },
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

export const AI_UPDATE = "UPDATE items SET summary=?, key_points=?, score=?, ai_provider=?, title_zh=?, title_original=COALESCE(NULLIF(?,''), title_original, title), summary_en=?, key_points_en=?, reco_score=?, reco_reason=?, side_income_new=?, side_income_reason=?, score_reason=?, updated_at=? WHERE id=?";
export const aiBind = (ai, original, now, id) => [ai.summary, JSON.stringify(ai.key_points), ai.score, ai.provider, ai.title_zh, original ?? "", ai.summary_en, JSON.stringify(ai.key_points_en), ai.reco_score, ai.reco_reason, ai.side_income_new ?? 0, ai.side_income_reason ?? null, ai.score_reason ?? null, now, id];

// Collect built-in + user RSS, then analyze only a small, topic-matched subset.
export async function runDaily(env, { fetchImpl = fetch, nowMs = Date.now() } = {}) {
  const day = hktDay(nowMs); const now = new Date(nowMs).toISOString(); const runId = crypto.randomUUID();
  const items = await collect(fetchImpl, await userFeeds(env.DB));
  let collected = 0, analyzed = 0, error = null;
  for (const it of items) {
    const un = normalizeUrl(it.url);
    if (un && await env.DB.prepare("SELECT 1 FROM items WHERE url_norm=? LIMIT 1").bind(un).first()) continue; // cross-source / tracking-param dup
    const res = await env.DB.prepare(`INSERT OR IGNORE INTO items(id,kind,status,title,url,url_norm,source,category,raw_excerpt,run_date,created_at,updated_at)
      VALUES(?, 'daily', 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), it.title, it.url, un, it.source, it.category, it.excerpt, day, now, now).run();
    if (res.meta?.changes > 0) collected++;
  }
  if (env.AI_ANALYSIS_ENABLED !== "false") ({ analyzed, error } = await analyzePending(env, { fetchImpl, nowMs, day }));
  await env.DB.prepare("INSERT INTO runs(id,started_at,finished_at,collected,analyzed,error) VALUES(?,?,?,?,?,?)")
    .bind(runId, now, new Date().toISOString(), collected, analyzed, error).run();
  return { collected, analyzed, error };
}

export async function analyzePending(env, { fetchImpl = fetch, nowMs = Date.now(), day = hktDay(nowMs), limit = 120 } = {}) {
  const now = new Date(nowMs).toISOString(); let analyzed = 0, error = null; let llmItems = 0;
  const autoLimit = Number(env.AI_AUTO_ANALYZE_LIMIT || 5);
  const rows = (await env.DB.prepare("SELECT id,title,url,raw_excerpt FROM items WHERE kind='daily' AND run_date=? AND ai_provider IS NULL ORDER BY created_at LIMIT ?").bind(day, limit).all()).results || [];
  for (const it of rows) {
    const text = `${it.title || ""}\n${it.raw_excerpt || ""}`;
    const han = (text.match(/\p{Script=Han}/gu) || []).length;
    if (text.length < 400 && text.length > 0 && han / text.length >= 0.25) {
      const summary = text.replace(/\s+/gu, " ").trim().slice(0, 150);
      await env.DB.prepare("UPDATE items SET summary=?, key_points='[]', score=0, ai_provider='extractive', title_zh=title, title_original=COALESCE(NULLIF(title_original,''),title), summary_en=NULL, key_points_en='[]', reco_score=NULL, reco_reason=NULL, side_income_new=0, side_income_reason=NULL, score_reason=NULL, updated_at=? WHERE id=? AND ai_provider IS NULL")
        .bind(summary, now, it.id).run();
      analyzed++; continue;
    }
    if (/(羊毛|web3|短劇|政治|地緣政治|情報|intelligence|politics|political|\bintel\b|數據中心|data[ -]?cent(?:er|re))/iu.test(text) || !/(一人公司|solopreneur|indie\b|低成本|變現|副業|訊息差|frontend|react|css|學習|工具|定價|workflow|consultant)/iu.test(text)) continue;
    if (llmItems >= autoLimit) { error ||= "auto_limit_reached"; break; }
    let autoSlot = false;
    try {
      const ai = await summarize(env, `${it.title}\n${it.url}\n${it.raw_excerpt || ""}`, { fetchImpl, nowMs, quota: "auto", beforeModel: async () => {
        if (autoSlot) return;
        if (!(await reserveAutoItem(env.DB, autoLimit, nowMs))) throw new Error("ai_daily_cap_reached");
        autoSlot = true;
      } });
      if (autoSlot) llmItems++;
      await env.DB.prepare(AI_UPDATE).bind(...aiBind(ai, it.title, now, it.id)).run(); analyzed++;
    } catch (e) {
      if (e.message === "ai_daily_cap_reached") { error = "cap_reached"; break; }
      if (autoSlot) llmItems++;
      if (e.message === "insufficient_content") {
        // Preserve the owner-facing retry path; this item consumed no successful summary.
      }
    }
  }
  return { analyzed, error };
}
