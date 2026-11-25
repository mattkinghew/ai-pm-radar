import { XMLParser } from "fast-xml-parser";
import { summarize, hktDay, reserveAutoItem, classifyAiFailure } from "./ai.mjs";
import { normalizeUrl, scoreLane, LANES, collapseRepeatedParagraphs } from "./curation.mjs";
import { fetchRestricted, RADAR_FETCH_HOSTS } from "./safe-fetch.mjs";

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
const strip = (s) => {
  const html = decodeEntities(String(s ?? "").replace(/<!\[CDATA\[|\]\]>/gu, "").replace(/<\/(?:p|div|li|h[1-6]|blockquote|pre)\s*>/giu, "\n\n").replace(/<br\s*\/?>/giu, "\n"));
  const plain = decodeEntities(html.replace(/<[^>]+>/gu, " ")).replace(/[\t\f\v ]+/gu, " ").replace(/ *\n+ */gu, "\n\n").trim();
  return collapseRepeatedParagraphs(plain);
};

export function parseFeed(xml, feed, limit = 5) {
  const doc = new XMLParser({ ignoreAttributes: false }).parse(xml);
  const raw = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  return (Array.isArray(raw) ? raw : [raw]).slice(0, limit).map((it) => {
    const excerpt = strip(it.description ?? it.summary?.["#text"] ?? it.summary ?? it["content:encoded"]).slice(0, 3000);
    const feedTitle = strip(it.title?.["#text"] ?? it.title);
    const url = typeof it.link === "string" ? it.link : (it.link?.["@_href"] ?? (Array.isArray(it.link) ? it.link[0]?.["@_href"] : ""));
    const inferredTitle = excerpt.split(/\n/u).map((line) => line.trim()).find(Boolean)?.slice(0, 160);
    return { title: feedTitle || inferredTitle || (url ? "URL 待整理來源" : ""), title_source: feedTitle ? "feed" : inferredTitle ? "inferred" : "synthesized", source_type: "rss",
      url, excerpt, source: feed.id, category: feed.category, published_at: it.pubDate || it.published || it.updated || null };
  }).filter((x) => x.title && x.url);
}

export async function userFeeds(db) {
  try { return (await db.prepare("SELECT id,CASE WHEN type='x' THEN 'x' ELSE adapter_type END AS type,value,label,lane_default,weight,include_keywords,exclude_keywords,max_per_day,ai_eligible FROM sources WHERE enabled=1 ORDER BY created_at LIMIT 30").all()).results || []; } catch { return []; }
}
const validator = (value) => typeof value === "string" && value.length <= 512 ? value : null;
async function conditionalFetch(fetchImpl, url, key, db, init = {}, allowedHosts = RADAR_FETCH_HOSTS) {
  const cached = db ? await db.prepare("SELECT url,etag,last_modified FROM source_http_cache WHERE source_key=?").bind(key).first() : null;
  const previous = cached?.url === url ? cached : null;
  const headers = { ...init.headers };
  if (previous) {
    if (validator(previous.etag)) headers["if-none-match"] = previous.etag;
    if (validator(previous.last_modified)) headers["if-modified-since"] = previous.last_modified;
  }
  const fetched = await fetchRestricted(fetchImpl, url, { ...init, headers, allowedHosts, allowedMime: init.allowedMime || ["application/rss+xml", "application/atom+xml", "application/xml", "text/xml", "text/plain"], maxBytes: 1_000_000, timeoutMs: 10_000 });
  if (fetched.error) throw new Error(fetched.status && init.errorPrefix ? `${init.errorPrefix}${fetched.status}` : fetched.error);
  const response = fetched.response;
  if (db && (response.ok || response.status === 304)) {
    const etag = validator(response.headers?.get?.("etag")) || (response.status === 304 ? validator(previous?.etag) : null);
    const lastModified = validator(response.headers?.get?.("last-modified")) || (response.status === 304 ? validator(previous?.last_modified) : null);
    await db.prepare("INSERT INTO source_http_cache(source_key,url,etag,last_modified,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(source_key) DO UPDATE SET url=excluded.url,etag=excluded.etag,last_modified=excluded.last_modified,updated_at=excluded.updated_at")
      .bind(key, url, etag, lastModified, new Date().toISOString()).run();
  }
  return response;
}
async function mapLimit(values, limit, task) {
  const out = new Array(values.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => { while (next < values.length) { const i = next++; try { out[i] = await task(values[i], i); } catch (error) { out[i] = { error: String(error?.message || "source_error").slice(0, 120) }; } } }));
  return out;
}
function sourceMatches(text, source) {
  const includes = (() => { try { return JSON.parse(source.include_keywords || "[]"); } catch { return []; } })();
  const excludes = (() => { try { return JSON.parse(source.exclude_keywords || "[]"); } catch { return []; } })();
  const folded = String(text).toLocaleLowerCase();
  return (!includes.length || includes.some((k) => folded.includes(String(k).toLocaleLowerCase()))) && !excludes.some((k) => folded.includes(String(k).toLocaleLowerCase()));
}
export async function collect(fetchImpl = fetch, extra = [], { githubToken = "", onError = () => {}, db = null, allowedHosts = RADAR_FETCH_HOSTS } = {}) {
  // Built-in and custom sources share the six-request concurrency bound. New adapter calls are capped at 30/run.
  const standard = [...FEEDS.map((f) => ({ ...f, type: "rss", ai_eligible: 1, weight: 0, cacheKey: `builtin:${f.id}` })), ...extra.filter((s) => s.type === "rss").map((s) => ({ ...s, id: `user:${s.label || s.id}`, url: s.value, category: s.lane_default || "OTHER", cacheKey: `source:${s.id}` }))];
  const adapters = extra.filter((s) => s.type !== "rss" && s.type !== "x").slice(0, 30);
  const jobs = [
    ...standard.map((feed) => async () => { const r = await conditionalFetch(fetchImpl, feed.url, feed.cacheKey, db, { headers: { "user-agent": "ai-pm-radar-cloud/1" } }, allowedHosts); if (r.status === 304) return []; if (!r.ok) throw new Error(`http_${r.status}`); return parseFeed(await r.text(), feed); }),
    ...adapters.map((s) => async () => {
      const headers = { "user-agent": "ai-pm-radar-cloud/1", accept: "application/vnd.github+json" };
      if (githubToken && s.type.startsWith("github_")) headers.authorization = `Bearer ${githubToken}`;
      if (s.type === "github_search") {
        const query = new URLSearchParams({ q: `${s.value} created:>=${new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)}`, sort: "stars", order: "desc", per_page: "10" });
        const r = await conditionalFetch(fetchImpl, `https://api.github.com/search/repositories?${query}`, `source:${s.id}`, db, { headers, allowedMime: ["application/json"], errorPrefix: "github_" }, allowedHosts);
        if (r.status === 304) return [];
        if (!r.ok) throw new Error(`github_${r.status}`);
        return (await r.json()).items.slice(0, Math.min(10, s.max_per_day || 5)).map((x) => ({ title: x.full_name, title_source: "page", excerpt: `${x.description || ""} Stars: ${x.stargazers_count}; language: ${x.language || "unknown"}; pushed_at: ${x.pushed_at || "unknown"}`, url: x.html_url, source: s.label || s.value, category: "GITHUB_PROJECT", lane: "GITHUB_PROJECT", published_at: x.pushed_at || null }));
      }
      if (s.type === "github_releases") {
        const repo = String(s.value).replace(/^https:\/\/github\.com\//u, "").replace(/\/$/u, "");
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repo)) throw new Error("bad_github_repo");
        const r = await conditionalFetch(fetchImpl, `https://api.github.com/repos/${repo}/releases?per_page=3`, `source:${s.id}`, db, { headers, allowedMime: ["application/json"], errorPrefix: "github_" }, allowedHosts); if (r.status === 304) return []; if (!r.ok) throw new Error(`github_${r.status}`);
        return (await r.json()).slice(0, 3).map((x) => ({ title: x.name || x.tag_name, title_source: "page", excerpt: String(x.body || "").slice(0, 3000), url: x.html_url, source: s.label || repo, category: "GITHUB_PROJECT", lane: "GITHUB_PROJECT", published_at: x.published_at || null }));
      }
      if (s.type === "youtube_channel") {
        const channel = String(s.value).trim(); if (!/^UC[A-Za-z0-9_-]{20,}$/u.test(channel)) throw new Error("bad_youtube_channel");
        const r = await conditionalFetch(fetchImpl, `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel)}`, `source:${s.id}`, db, { headers: { "user-agent": "ai-pm-radar-cloud/1" }, allowedMime: ["application/atom+xml", "application/xml", "text/xml"] }, allowedHosts); if (r.status === 304) return []; if (!r.ok) throw new Error(`youtube_${r.status}`);
        return parseFeed(await r.text(), { id: s.label || channel, category: s.lane_default || "CONTENT_WORKFLOW" }, Math.min(10, s.max_per_day || 5));
      }
      throw new Error("unsupported_source_type");
    }),
    async () => { const r = await conditionalFetch(fetchImpl, HN_URL, "builtin:hn", db, { headers: { "user-agent": "ai-pm-radar-cloud/1" }, allowedMime: ["application/json"] }, allowedHosts); if (r.status === 304) return []; if (!r.ok) throw new Error(`http_${r.status}`); return ((await r.json()).hits ?? []).slice(0, 10).filter((h) => h.title).map((h) => ({ title: decodeEntities(h.title), title_source: "page", url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, excerpt: h.title, source: "hn", category: "AI_TECH_NEWS" })); },
  ];
  const results = await mapLimit(jobs, 6, async (job, index) => { const result = await job(); if (result?.error) onError({ index, error: result.error }); return result; });
  return results.flatMap((r, index) => { if (r?.error) { const src = index >= standard.length && index < standard.length + adapters.length ? adapters[index - standard.length] : standard[index]; onError({ source: src?.label || src?.id || "hn", error: r.error }); return []; }
    const src = index < standard.length ? standard[index] : index < standard.length + adapters.length ? adapters[index - standard.length] : null;
    return (Array.isArray(r) ? r : []).filter((it) => !src || sourceMatches(`${it.title} ${it.excerpt}`, src)).map((it) => ({ ...it, source_type: it.source_type || src?.type || "api", source_weight: src?.weight || 0, lane: it.lane || src?.lane_default || undefined, ai_eligible: src ? Number(src.ai_eligible || 0) : 1 })); });
}

export const AI_UPDATE = "UPDATE items SET summary=?, key_points=?, score=?, ai_provider=?, ai_model=?, analysis_basis=?, analysis_source_type=?, analysis_status=?, analysis_error_code=NULL, title_zh=?, title_original=COALESCE(NULLIF(?,''), title_original, title), summary_en=?, key_points_en=?, reco_score=?, reco_reason=?, side_income_new=?, side_income_reason=?, score_reason=?, updated_at=? WHERE id=?";
export const aiBind = (ai, original, now, id) => [ai.summary, JSON.stringify(ai.key_points), ai.score, ai.provider, ai.model || null, ai.content_basis || "from_excerpt", ai.source_type || "unknown", ai.provider === "extractive" ? "not_requested" : "completed", ai.title_zh, original ?? "", ai.summary_en, JSON.stringify(ai.key_points_en), ai.reco_score, ai.reco_reason, ai.side_income_new ?? 0, ai.side_income_reason ?? null, ai.score_reason ?? null, now, id];

// Collect built-in + user RSS, then analyze only a small, topic-matched subset.
export async function runDaily(env, { fetchImpl = fetch, nowMs = Date.now(), allowedHosts = RADAR_FETCH_HOSTS } = {}) {
  const day = hktDay(nowMs); const now = new Date(nowMs).toISOString(); const runId = crypto.randomUUID();
  const sourceErrors = [];
  const sources = await userFeeds(env.DB);
  const counts = new Map(((await env.DB.prepare("SELECT source,COUNT(*) count FROM items WHERE run_date=? GROUP BY source").bind(day).all()).results || []).map((r) => [r.source, Number(r.count)]));
  const items = await collect(fetchImpl, sources, { githubToken: env.GITHUB_TOKEN || "", onError: (e) => sourceErrors.push(e), db: env.DB, allowedHosts });
  let collected = 0, analyzed = 0, error = null, analysis = { status: "skipped", reason: "analysis_disabled", skipped: [], failures: [] };
  for (const it of items) {
    const sourceSetting = sources.find((s) => it.source === s.label || it.source === s.value || it.source === `user:${s.label || s.id}`);
    const countKey = sourceSetting ? it.source : null;
    if (sourceSetting && (counts.get(countKey) || 0) >= Number(sourceSetting.max_per_day || 5)) continue;
    const un = normalizeUrl(it.url);
    if (un && await env.DB.prepare("SELECT 1 FROM items WHERE url_norm=? LIMIT 1").bind(un).first()) continue; // cross-source / tracking-param dup
    const excerpt = collapseRepeatedParagraphs(it.excerpt || "");
    const scored = scoreLane({ ...it, raw_excerpt: excerpt, published_at: it.published_at }, { sourceWeight: it.source_weight, nowMs });
    const res = await env.DB.prepare(`INSERT OR IGNORE INTO items(id,kind,status,title,title_source,url,url_norm,source,source_type,category,raw_excerpt,run_date,created_at,updated_at,lane,pref_score,pref_reasons,pref_breakdown,curation_status,curation_reason,published_at,claim_status,evidence_tier,review_status,injection_suspect,ai_eligible)
      VALUES(?, 'daily', 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified', ?, 'needs_review', ?, ?)`).bind(crypto.randomUUID(), it.title, it.title_source || "inferred", it.url, un, it.source, it.source_type || "rss", it.category, excerpt, day, now, now, scored.lane, scored.pref_score, JSON.stringify(scored.pref_reasons), JSON.stringify(scored.pref_breakdown), scored.curation_status, scored.curation_reason, it.published_at || null, String(it.source || "").startsWith("github") ? "official" : "secondary", scored.injection_suspect ? 1 : 0, it.ai_eligible ?? 1).run();
    if (res.meta?.changes > 0) { collected++; if (countKey) counts.set(countKey, (counts.get(countKey) || 0) + 1); }
  }
  if (env.AI_ANALYSIS_ENABLED !== "false") { analysis = await analyzePending(env, { fetchImpl, nowMs, day }); analyzed = analysis.analyzed; error = analysis.error; }
  const runError = JSON.stringify({ ai: error, source_errors: sourceErrors, analysis });
  await env.DB.prepare("INSERT INTO runs(id,started_at,finished_at,collected,analyzed,error) VALUES(?,?,?,?,?,?)")
    .bind(runId, now, new Date().toISOString(), collected, analyzed, runError).run();
  return { collected, analyzed, error, sourceErrors, analysis };
}

export async function analyzePending(env, { fetchImpl = fetch, nowMs = Date.now(), day = hktDay(nowMs), limit = 120 } = {}) {
  const now = new Date(nowMs).toISOString(); let analyzed = 0, error = null; let llmItems = 0; const skipped = [], failures = [];
  const autoLimit = Number(env.AI_AUTO_ANALYZE_LIMIT || 5);
  const splitTerms = (value, fallback) => (value == null ? fallback : String(value).split(",")).map((x) => x.trim().toLocaleLowerCase()).filter(Boolean).slice(0, 40);
  const includeTerms = splitTerms(env.AI_AUTO_ANALYZE_INCLUDE_TERMS, ["一人公司", "solopreneur", "indie", "低成本", "變現", "副業", "訊息差", "frontend", "react", "css", "學習", "工具", "定價", "workflow", "consultant"]);
  const excludeTerms = splitTerms(env.AI_AUTO_ANALYZE_EXCLUDE_TERMS, ["羊毛", "web3", "短劇", "政治", "地緣政治", "情報", "intelligence", "politics", "political", "intel", "數據中心", "data center", "data centre"]);
  const rows = (await env.DB.prepare("SELECT id,title,url,source,source_type,category,raw_excerpt,lane,ai_eligible,updated_at FROM items WHERE kind='daily' AND run_date=? AND ai_provider IS NULL ORDER BY created_at LIMIT ?").bind(day, limit).all()).results || [];
  const recordSkip = async (it, reason) => { skipped.push({ id: it.id, reason }); await env.DB.prepare("UPDATE items SET analysis_status='skipped',analysis_error_code=? WHERE id=? AND ai_provider IS NULL AND updated_at IS ?").bind(reason, it.id, it.updated_at).run(); };
  const sourceType = (it) => it.source_type || "unknown";
  const recordFailure = async (it, failure) => { failures.push({ id: it.id, code: failure.code, provider: failure.provider, status: failure.status }); await env.DB.prepare("UPDATE items SET analysis_status='failed',analysis_error_code=?,analysis_basis=CASE WHEN ?='insufficient_content' THEN 'insufficient' ELSE 'from_excerpt' END,analysis_source_type=? WHERE id=? AND ai_provider IS NULL AND updated_at IS ?").bind(failure.code, failure.code, sourceType(it), it.id, it.updated_at).run(); };
  if (env.AI_AUTO_ANALYZE_ENABLED === "false") {
    for (const it of rows) await recordSkip(it, "auto_analysis_disabled");
    return { analyzed, error: null, status: "skipped", skipped, failures };
  }
  for (const it of rows) {
    const text = `${it.title || ""}\n${it.raw_excerpt || ""}`;
    if (!it.ai_eligible) { await recordSkip(it, "source_not_ai_eligible"); continue; }
    const han = (text.match(/\p{Script=Han}/gu) || []).length;
    if (text.length < 400 && text.length > 0 && han / text.length >= 0.25) {
      const summary = text.replace(/\s+/gu, " ").trim().slice(0, 150);
      const changed = await env.DB.prepare("UPDATE items SET summary=?, key_points='[]', score=0, ai_provider='extractive', analysis_basis='from_excerpt',analysis_source_type=?,analysis_status='not_requested',analysis_error_code=NULL,title_zh=title, title_original=COALESCE(NULLIF(title_original,''),title), summary_en=NULL, key_points_en='[]', reco_score=NULL, reco_reason=NULL, side_income_new=0, side_income_reason=NULL, score_reason=NULL, updated_at=? WHERE id=? AND ai_provider IS NULL AND title IS ? AND raw_excerpt IS ? AND updated_at IS ?")
        .bind(summary, sourceType(it), now, it.id, it.title, it.raw_excerpt, it.updated_at).run();
      if (changed.meta.changes) analyzed++; continue;
    }
    const folded = text.toLocaleLowerCase();
    if (excludeTerms.some((term) => folded.includes(term))) { await recordSkip(it, "exclude_term"); continue; }
    if (!includeTerms.some((term) => folded.includes(term))) { await recordSkip(it, "no_include_term"); continue; }
    if (llmItems >= autoLimit) { error ||= "auto_limit_reached"; await recordSkip(it, "auto_limit_reached"); continue; }
    let autoSlot = false;
    try {
      const ai = await summarize(env, `${it.title}\n${it.url}\n${it.raw_excerpt || ""}`, { fetchImpl, nowMs, quota: "auto", lane: it.lane, beforeModel: async () => {
        if (autoSlot) return;
        if (!(await reserveAutoItem(env.DB, autoLimit, nowMs))) throw new Error("ai_daily_cap_reached");
        autoSlot = true;
      } });
      if (autoSlot) llmItems++;
      ai.content_basis = "from_excerpt"; ai.source_type = sourceType(it);
      const changed = await env.DB.prepare(AI_UPDATE + " AND title IS ? AND raw_excerpt IS ? AND updated_at IS ? AND ai_provider IS NULL")
        .bind(...aiBind(ai, it.title, now, it.id), it.title, it.raw_excerpt, it.updated_at).run();
      if (changed.meta.changes) analyzed++;
    } catch (e) {
      const failure = classifyAiFailure(e);
      await recordFailure(it, failure);
      if (e.message === "ai_daily_cap_reached") { error = "cap_reached"; break; }
      if (autoSlot) llmItems++;
    }
  }
  return { analyzed, error, status: failures.length ? (analyzed ? "partial" : "failed") : skipped.length ? (analyzed ? "partial" : "skipped") : "completed", skipped, failures };
}
