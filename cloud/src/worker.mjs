import { verifyCloudflareAccessOwner } from "./access-jwt.mjs";
import { summarize, usage, classifyAiFailure } from "./ai.mjs";
import { runDaily, analyzePending, AI_UPDATE, aiBind, FEEDS, HN_URL } from "./collector.mjs";
import { hktDay } from "./ai.mjs";
import { handleP1, KB_COLS, kbShape as kbShapeP1 } from "./routes-p1.mjs";
import { normalizeUrl, dedup, applyQuotas, isMuted, kbMarkdown, kbPath, scoreLane, LANES, injectionSuspect, feedbackOverlay, normalizeTrainTerm, collapseRepeatedParagraphs } from "./curation.mjs";
import { chunkParagraphs } from "./reader.mjs";
import { canonicalSourceValue } from "./source-import.mjs";

const SEC = { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...SEC } });
const ROW = "id,kind,status,title,title_source,url,source,source_type,category,summary,key_points,score,ai_provider,ai_model,analysis_basis,analysis_source_type,analysis_status,analysis_error_code,title_zh,title_original,summary_en,key_points_en,raw_excerpt,run_date,created_at,updated_at,reco_score,reco_reason,metrics,side_income_new,side_income_reason,score_reason,starred,read_later,dismissed_reason,lane,pref_score,pref_reasons,pref_breakdown,curation_status,curation_reason,published_at,claim_status,evidence_tier,review_status,injection_suspect,action_14d,(SELECT tags FROM kb_entries WHERE item_id=items.id) AS tags";
const DETAIL_ROW = `${ROW},original_text`;
const pj = (v) => { try { return v ? JSON.parse(v) : []; } catch { return []; } };
const shape = (r) => {
  if (!r) return r;
  const pref_breakdown = pj(r.pref_breakdown);
  const relevanceKnown = pref_breakdown?.dimensions?.relevance?.status === "observed";
  return { ...r, raw_excerpt: collapseRepeatedParagraphs(r.raw_excerpt), key_points: pj(r.key_points), key_points_en: pj(r.key_points_en), pref_reasons: pj(r.pref_reasons), pref_breakdown,
    pref_score: relevanceKnown ? r.pref_score : null, curation_status: r.curation_status || "main", curation_reason: r.curation_reason || null,
    tags: pj(r.tags), metrics: r.metrics ? pj(r.metrics) : null };
};
const SRC = "id,CASE WHEN type='x' THEN 'x' ELSE adapter_type END AS type,CASE WHEN type='x' THEN 'x' ELSE adapter_type END AS adapter_type,value,label,opml_category,enabled,lane_default,weight,include_keywords,exclude_keywords,max_per_day,ai_eligible,created_at,updated_at";
const HANDLE = /^@?([A-Za-z0-9_]{1,15})$/u;
const trained = async (db, rows) => { const weights = (await db.prepare("SELECT key,weight FROM feedback_weights ORDER BY key").all()).results;
  return rows.map((row) => { const item = shape(row); return { ...item, ...feedbackOverlay(item, weights) }; }); };
const byPreference = (a, b) => ((Number(b.pref_score) || 0) + b.feedback_adj - (Number(a.pref_score) || 0) - a.feedback_adj) || String(b.created_at).localeCompare(String(a.created_at));
const REASONS = ["not_relevant", "duplicate", "low_quality", "already_known", "too_much_x", "other"];
const KB = KB_COLS;
const kbShape = kbShapeP1;
// Feedback learning: clamp weights to [-2, 3].
async function bump(db, key, delta, now) {
  if (!key || !delta) return; const pos = delta > 0 ? 1 : 0, neg = delta < 0 ? 1 : 0;
  await db.prepare(`INSERT INTO feedback_weights(key,weight,pos,neg,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET weight=MIN(3, MAX(-2, weight+?)), pos=pos+?, neg=neg+?, updated_at=?`).bind(key, Math.max(-2, Math.min(3, delta)), pos, neg, now, delta, pos, neg, now).run();
}
async function kbUpsert(db, item, origin, now) {
  await db.prepare(`INSERT INTO kb_entries(id,item_id,title,url,source,category,summary,key_points,tags,note,score,origin,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'[]',NULL,?,?,?,?)
    ON CONFLICT(item_id) DO UPDATE SET title=excluded.title, summary=excluded.summary, key_points=excluded.key_points, score=excluded.score, updated_at=excluded.updated_at`)
    .bind(crypto.randomUUID(), item.id, item.title_zh || item.title, item.url, item.source, item.category, item.summary, item.key_points ?? "[]", item.score, origin, now, now).run();
}

// Bearer INGEST_TOKEN (Worker secret) for Jun's automation; constant-time compare over SHA-256 digests.
async function bearerOk(request, env) {
  const h = request.headers.get("authorization") || ""; const m = h.match(/^Bearer (.+)$/u);
  if (!m || !env.INGEST_TOKEN || env.INGEST_TOKEN.length < 32) return false;
  const d = async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [a, b] = [await d(m[1]), await d(env.INGEST_TOKEN)]; let x = 0; for (let i = 0; i < a.length; i++) x |= a[i] ^ b[i]; return x === 0;
}
const BEARER_ROUTES = (url, m) => (url.pathname === "/api/ingest/x" && m === "POST") || (url.pathname === "/api/sources" && m === "GET");
const hashTitle = async (title) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(title || "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim())))).map((x) => x.toString(16).padStart(2, "0")).join("");
const keywordArray = (value) => Array.isArray(value) ? value.map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 30) : [];
const CAPTURE_HISTORY_LIMIT = 8;
const CAPTURE_HISTORY_BYTES = 64000;
const captureReply = (id, score, needsSource, suspect, result, status) => json({ id, status: "draft", review_status: needsSource ? "NEEDS_SOURCE_REVIEW" : "needs_review", lane: score.lane, pref_score: score.pref_breakdown.dimensions.relevance.status === "observed" ? score.pref_score : null, pref_reasons: score.pref_reasons, pref_breakdown: score.pref_breakdown, curation_status: score.curation_status, curation_reason: score.curation_reason, injection_suspect: !!suspect, ai_calls: 0, result }, status);
const storedCaptureReply = (item) => json({ id: item.id, status: item.status, review_status: item.review_status, lane: item.lane,
  pref_score: shape(item).pref_score, pref_reasons: pj(item.pref_reasons), pref_breakdown: pj(item.pref_breakdown), curation_status: item.curation_status, curation_reason: item.curation_reason, injection_suspect: !!item.injection_suspect,
  source: item.source, claim_status: item.claim_status, evidence_tier: item.evidence_tier, ai_provider: item.ai_provider,
  ai_calls: 0, result: "duplicate" });

async function ingestX(request, env) {
  const body = await request.json().catch(() => null);
  const posts = Array.isArray(body) ? body : body?.posts;
  if (!Array.isArray(posts) || posts.length > 200) return json({ error: "bad_batch", hint: "posts: array (<=200)" }, 400);
  const enabledRows = (await env.DB.prepare("SELECT value,ai_eligible FROM sources WHERE (type='x' OR adapter_type='x') AND enabled=1").all()).results;
  const enabled = new Map(enabledRows.map((r) => [String(r.value).replace(/^@/u, "").toLowerCase(), Number(r.ai_eligible || 0)]));
  const now = new Date().toISOString(); const day = hktDay(); let inserted = 0, duplicate = 0, skipped_disabled = 0; const rejected = [], disabled_handles = [];
  for (const [i, p] of posts.entries()) {
    const hm = String(p?.handle ?? "").match(HANDLE); const pid = String(p?.post_id ?? "");
    const originalText = String(p?.text ?? "");
    const text = collapseRepeatedParagraphs(originalText.trim());
    if (!hm || !/^\d{1,25}$/u.test(pid) || !text || originalText.length > 20000) { rejected.push(i); continue; }
    const handle = hm[1]; const url = /^https:\/\/(x|twitter)\.com\//u.test(p.url || "") ? p.url : `https://x.com/${handle}/status/${pid}`;
    if (!enabled.has(handle.toLowerCase())) { skipped_disabled++; disabled_handles.push({ index: i, handle: `@${handle}` }); continue; }
    const title = text.replace(/\s+/gu, " ").slice(0, 140);
    const published = /^\d{4}-\d\d-\d\dT/u.test(p.created_at || "") ? p.created_at : null;
    const scored = scoreLane({ title, raw_excerpt: text, published_at: published });
    const res = await env.DB.prepare(`INSERT OR IGNORE INTO items(id,kind,status,title,title_source,url,url_norm,source,source_type,category,raw_excerpt,original_text,run_date,external_id,metrics,created_at,updated_at,ai_eligible,lane,pref_score,pref_reasons,pref_breakdown,curation_status,curation_reason,published_at,claim_status,evidence_tier,review_status,injection_suspect)
      VALUES(${Array(29).fill("?").join(",")})`)
      .bind(crypto.randomUUID(), "daily", "draft", title, "x_text_truncation", url, normalizeUrl(url), `x:@${handle}`, "x_post", "X_POST", text.slice(0, 4000), originalText, day, `x:${pid}`, p.metrics ? JSON.stringify(p.metrics).slice(0, 1000) : null,
        published || now, now, enabled.get(handle.toLowerCase()), scored.lane, scored.pref_score, JSON.stringify(scored.pref_reasons), JSON.stringify(scored.pref_breakdown), scored.curation_status, scored.curation_reason, published, "unverified", "social", "needs_review", scored.injection_suspect ? 1 : 0).run();
    res.meta?.changes > 0 ? inserted++ : duplicate++;
  }
  return json({ inserted, duplicate, skipped_disabled, disabled_handles, rejected, note: "AI 分析會喺下次每日排程（或 /api/analyze）按額度處理" });
}
const aiErr = (e) => { const failure = classifyAiFailure(e); console.log(JSON.stringify({ ai_error: failure.code, provider: failure.provider, provider_status: failure.status }));
  const status = failure.code === "cap_reached" ? 429 : failure.code === "insufficient_content" ? 422 : failure.code === "stale_source" ? 409 : 502;
  return json({ error: failure.code, code: failure.code, provider: failure.provider, provider_status: failure.status, retryable: failure.retryable, hint: failure.hint }, status); };
const sourceKind = (item) => item.source_type || "unknown";
const storeAnalysisFailure = (db, id, updatedAt, e) => { const f = classifyAiFailure(e); return db.prepare("UPDATE items SET analysis_status='failed',analysis_error_code=? WHERE id=? AND (ai_provider IS NULL OR ai_provider='extractive') AND updated_at IS ?").bind(f.code, id, updatedAt).run(); };

// Local-only test hook: lets wrangler dev smoke tests use a mocked JWKS. Ignored unless ENVIRONMENT === "local".
function authFetch(env) {
  if (env.ENVIRONMENT === "local" && env.ACCESS_TEST_JWKS) return async () => new Response(env.ACCESS_TEST_JWKS, { headers: { "content-type": "application/json" } });
  return fetch;
}

export async function handle(request, env, deps = {}) {
  const url = new URL(request.url);
  if (request.headers.get("authorization")) {
    // Machine path: only ingest + read sources; never falls through to owner routes.
    if (!BEARER_ROUTES(url, request.method) || !(await bearerOk(request, env))) return json({ error: "unauthorized" }, 401);
    if (url.pathname === "/api/ingest/x") return ingestX(request, env);
    return listSources(env.DB, url, false);
  }
  const owner = await verifyCloudflareAccessOwner(request, env, { fetchImpl: deps.authFetch ?? authFetch(env), nowMs: deps.nowMs });
  if (!owner) return url.pathname.startsWith("/api/") ? json({ error: "unauthorized" }, 401) : new Response("Unauthorized", { status: 401, headers: SEC });
  if (!url.pathname.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  const db = env.DB; const now = new Date().toISOString(); const m = request.method;
  const p1 = await handleP1(request, env, deps, url, m, db, now); if (p1) return p1;

  if (url.pathname === "/api/items/batch-summarize" && m === "POST") {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.map(String))] : [];
    const budget = body?.budget;
    if (body?.confirm !== true || !budget || !Number.isInteger(budget.max_items) || budget.max_items < 1 || budget.max_items > 10 || !Number.isInteger(budget.max_calls) || budget.max_calls < 1 || budget.max_calls > 20) {
      return json({ error: "budget_approval_required", hint: "需明確確認素材數及最多 AI 呼叫次數；上限為 10 筆／20 次。", ai_calls: 0 }, 400);
    }
    if (!ids.length || ids.length > budget.max_items || ids.length > 10 || ids.some((id) => !/^[0-9a-f-]{36}$/iu.test(id))) return json({ error: "invalid_batch_selection", hint: "所選項目不可為空，且不得超過已確認筆數。", ai_calls: 0 }, 400);
    const rows = (await db.prepare(`SELECT id,kind,status,title,url,source_type,raw_excerpt,updated_at,ai_provider FROM items WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results || [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    let modelCalls = 0, budgetExhausted = false; const results = [];
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) { results.push({ id, status: "skipped", code: "not_found" }); continue; }
      if (item.kind !== "daily" || item.status !== "draft" || (item.ai_provider && item.ai_provider !== "extractive")) { results.push({ id, status: "skipped", code: "not_eligible" }); continue; }
      if (String(item.raw_excerpt || "").length < 200) { results.push({ id, status: "skipped", code: "insufficient_content" }); continue; }
      try {
        const ai = await summarize(env, `${item.title || ""}\n${item.url || ""}\n\n${item.raw_excerpt}`, {
          fetchImpl: deps.fetchImpl ?? fetch, nowMs: deps.nowMs, quota: "manual", forceModel: true,
          beforeModel: async () => { if (modelCalls >= budget.max_calls) { budgetExhausted = true; throw new Error("batch_budget_exhausted"); } modelCalls++; },
        });
        ai.content_basis = "from_excerpt"; ai.source_type = sourceKind(item);
        const changed = await db.prepare(AI_UPDATE + " AND kind='daily' AND status='draft' AND title IS ? AND raw_excerpt IS ? AND updated_at IS ? AND ai_provider IS ?")
          .bind(...aiBind(ai, item.title, new Date().toISOString(), item.id), item.title, item.raw_excerpt, item.updated_at, item.ai_provider).run();
        if (!changed.meta?.changes) { results.push({ id, status: "skipped", code: "stale_source" }); continue; }
        results.push({ id, status: "completed", provider: ai.provider, model: ai.model || null, content_basis: "from_excerpt", source_type: ai.source_type });
      } catch (error) {
        if (error?.message === "batch_budget_exhausted") { results.push({ id, status: "skipped", code: "budget_exhausted" }); break; }
        await storeAnalysisFailure(db, item.id, item.updated_at, error);
        results.push({ id, status: "failed", ...classifyAiFailure(error) });
      }
    }
    const completed = new Set(results.filter((result) => result.status === "completed" || result.status === "failed" || (result.status === "skipped" && result.code !== "budget_exhausted")).map((result) => result.id));
    return json({ results, model_calls: modelCalls, budget: { max_items: budget.max_items, max_calls: budget.max_calls }, remaining_ids: ids.filter((id) => !completed.has(id)), budget_exhausted: budgetExhausted, review_status: "needs_review", ai_calls: modelCalls });
  }

  if (url.pathname === "/api/cloud/capabilities" && m === "GET") {
    return json({ backend: "cloudflare", d1: !!db, ai: { gemini: !!env.GEMINI_API_KEY, fallback: env.AI_FALLBACK_PROVIDER || "none", dailyCap: Number(env.AI_DAILY_CAP || 10), autoAnalyzeLimit: Number(env.AI_AUTO_ANALYZE_LIMIT || 5), usage: await usage(env) }, cron: "0 0 * * * (08:00 HKT)", humanReviewRequired: true });
  }
  if (url.pathname === "/api/sources" && m === "GET") return listSources(db, url, true);
  if (url.pathname === "/api/source-health" && m === "GET") {
    const [cache, rows, configured, lastRun] = await Promise.all([
      db.prepare("SELECT source_key,url,updated_at FROM source_http_cache").all(),
      db.prepare("SELECT source,COUNT(*) count FROM items GROUP BY source").all(),
      db.prepare(`SELECT ${SRC} FROM sources ORDER BY created_at`).all(),
      db.prepare("SELECT finished_at,error FROM runs ORDER BY finished_at DESC LIMIT 1").first(),
    ]);
    const cached = new Map(cache.results.map((x) => [x.source_key, x]));
    const counts = new Map(rows.results.map((x) => [x.source, Number(x.count)]));
    let runDetails = null, errors = [];
    try { runDetails = JSON.parse(lastRun?.error || "null"); errors = runDetails?.source_errors || []; } catch { /* Older run errors are plain text. */ }
    const errorBySource = new Map(errors.map((x) => [x.source, x.error]));
    const sources = FEEDS.map((f) => ({ id: f.id, type: "rss", url: f.url, count: counts.get(f.id) || 0, cacheKey: `builtin:${f.id}` }));
    sources.push({ id: "hn", type: "api", url: HN_URL, count: counts.get("hn") || 0, cacheKey: "builtin:hn" });
    for (const s of configured.results) sources.push({ id: s.id, label: s.label, type: s.type, url: s.value, count: counts.get(s.label || s.value) || 0, enabled: !!s.enabled, cacheKey: `source:${s.id}` });
    const health = sources.map(({ cacheKey, ...s }) => {
      const success = cached.get(cacheKey);
      const reason = errorBySource.get(s.id) || errorBySource.get(s.label) || null;
      return { ...s, last_success_at: success?.updated_at || null, last_error_at: reason ? lastRun.finished_at : null,
        last_check_at: reason ? lastRun.finished_at : success?.updated_at || null,
        status: reason ? "error" : success ? "last_success_only" : "unknown", reason: reason || (success ? "Last successful fetch; current availability unknown" : "No recorded check") };
    });
    const byType = { rss: 0, api: 0, official_html: 0, manual: 1, x: 0, other: 0 };
    for (const s of health) byType[s.type in byType ? s.type : "other"]++;
    return json({ sources: health, catalog_counts: byType, manual_captures: counts.get("quick-capture") || 0,
      last_analysis: runDetails?.analysis || null, note: "Last successful cache write is not a current availability check. X live ingestion is unknown." });
  }
  if (url.pathname === "/api/digest" && m === "GET") {
    const days = Number(url.searchParams.get("days") || 7); if (!Number.isInteger(days) || days < 1 || days > 30) return json({ error: "bad_days" }, 400);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const rows = await trained(db, (await db.prepare(`SELECT ${ROW} FROM items WHERE created_at>=?`).bind(since).all()).results);
    const mutes = (await db.prepare("SELECT kind,value FROM mutes").all()).results;
    const visible = rows.filter((it) => it.curation_status !== "quarantine" && !it.dismissed_reason && !isMuted(it, mutes)).sort(byPreference);
    return json({ days, ai_calls: 0, lanes: Object.fromEntries(LANES.map((lane) => [lane, visible.filter((it) => it.lane === lane).slice(0, 3)])) });
  }
  if (url.pathname === "/api/trainer" && m === "GET") return json({ weights: (await db.prepare("SELECT key,weight,pos,neg,updated_at FROM feedback_weights ORDER BY key").all()).results });
  if (url.pathname === "/api/trainer" && m === "POST") {
    const b = await request.json().catch(() => null);
    const term = typeof b?.term === "string" ? normalizeTrainTerm(b.term) : "";
    if (!["up", "down"].includes(b?.vote) || !["keyword", "title", "tag"].includes(b?.scope) || !/^[0-9a-f-]{36}$/u.test(b?.item_id || "") ||
      [...term].length < 2 || [...term].length > 80 || /[\p{C}<>\[\]{}\\]/u.test(term) || injectionSuspect(term)) return json({ error: "bad_training" }, 400);
    const it = await db.prepare(`SELECT ${ROW} FROM items WHERE id=?`).bind(b.item_id).first(); if (!it) return json({ error: "not_found" }, 404);
    const shaped = shape(it);
    const haystack = b.scope === "title" ? [it.title, it.title_zh] : b.scope === "tag" ? shaped.tags : [it.title, it.title_zh, it.summary, ...shaped.tags];
    if (!haystack.some((x) => normalizeTrainTerm(x).includes(term))) return json({ error: "term_not_in_item" }, 400);
    const key = `${b.scope === "tag" ? "tag" : "kw"}:${term}`;
    await bump(db, key, b.vote === "up" ? 0.4 : -0.4, now);
    await db.prepare("INSERT INTO item_actions(id,item_id,action,reason,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), it.id, b.vote === "up" ? "train_up" : "train_down", `${b.scope}:${term}`, now).run();
    return json({ key, overlay: feedbackOverlay(shaped, (await db.prepare("SELECT key,weight FROM feedback_weights").all()).results) });
  }
  if (url.pathname === "/api/analyze" && m === "POST") return json(await analyzePending(env, { fetchImpl: deps.fetchImpl ?? fetch, limit: 120 }));
  if (url.pathname === "/api/sources" && m === "POST") {
    const b = await request.json().catch(() => ({})); const type = b?.type; let value = String(b?.value ?? "").trim();
    const supported = ["rss", "x", "github_search", "github_releases", "youtube_channel"];
    if (!supported.includes(type)) return json({ error: "bad_source", hint: `type 需為 ${supported.join(" | ")}` }, 400);
    if (type === "rss" && !/^https:\/\/[^\s]+$/u.test(value)) return json({ error: "bad_source", hint: "RSS 需為 https:// 網址" }, 400);
    if (type === "x") { const hm = value.match(HANDLE); if (!hm) return json({ error: "bad_source", hint: "X 帳號格式：@handle" }, 400); value = "@" + hm[1]; }
    if (type === "github_releases" && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value.replace(/^https:\/\/github\.com\//u, "").replace(/\/$/u, ""))) return json({ error: "bad_source" }, 400);
    if (type === "youtube_channel" && !/^UC[A-Za-z0-9_-]{20,}$/u.test(value)) return json({ error: "bad_source" }, 400);
    if (type === "github_search" && value.length > 160) return json({ error: "bad_source" }, 400);
    const id = crypto.randomUUID(); const label = String(b?.label ?? "").trim().slice(0, 60) || null;
    const canonicalValue = canonicalSourceValue(type, value);
    const existingSourceRows = (await db.prepare("SELECT type,adapter_type,value,canonical_value FROM sources").all()).results;
    if (existingSourceRows.some((source) => {
      const sourceType = source.type === "x" || source.adapter_type === "x" ? "x" : source.adapter_type || source.type;
      return sourceType === type && (canonicalSourceValue(sourceType, source.value) === canonicalValue || source.canonical_value === canonicalValue);
    })) return json({ error: "duplicate_source", hint: "已經有呢個訊息源" }, 409);
    const lane = LANES.includes(b?.lane_default) ? b.lane_default : (type === "github_search" || type === "github_releases" ? "GITHUB_PROJECT" : type === "youtube_channel" ? "CONTENT_WORKFLOW" : "OTHER");
    const weight = Number(b?.weight ?? 0), maxPerDay = Number(b?.max_per_day ?? 5);
    if (!Number.isInteger(weight) || weight < -2 || weight > 2 || !Number.isInteger(maxPerDay) || maxPerDay < 1 || maxPerDay > 100) return json({ error: "bad_source_settings" }, 400);
    const r = await db.prepare(`INSERT OR IGNORE INTO sources(id,type,adapter_type,value,label,canonical_value,enabled,lane_default,weight,include_keywords,exclude_keywords,max_per_day,ai_eligible,created_at,updated_at) VALUES(?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, type, type, value, label, canonicalValue, lane, weight, JSON.stringify(keywordArray(b?.include_keywords)), JSON.stringify(keywordArray(b?.exclude_keywords)), maxPerDay, b?.ai_eligible === true ? 1 : 0, now, now).run();
    return r.meta.changes ? json({ source: await db.prepare(`SELECT ${SRC} FROM sources WHERE id=?`).bind(id).first() }, 201) : json({ error: "duplicate_source", hint: "已經有呢個訊息源" }, 409);
  }
  const sm = url.pathname.match(/^\/api\/sources\/([0-9a-f-]{36})$/u);
  if (sm && m === "PATCH") {
    const b = await request.json().catch(() => ({}));
    if (b?.lane_default != null && !LANES.includes(b.lane_default)) return json({ error: "bad_lane" }, 400);
    if (b?.weight != null && (!Number.isInteger(b.weight) || b.weight < -2 || b.weight > 2)) return json({ error: "bad_weight" }, 400);
    if (b?.max_per_day != null && (!Number.isInteger(b.max_per_day) || b.max_per_day < 1 || b.max_per_day > 100)) return json({ error: "bad_max_per_day" }, 400);
    const r = await db.prepare(`UPDATE sources SET enabled=COALESCE(?,enabled), label=COALESCE(?,label), lane_default=COALESCE(?,lane_default), weight=COALESCE(?,weight), include_keywords=COALESCE(?,include_keywords), exclude_keywords=COALESCE(?,exclude_keywords), max_per_day=COALESCE(?,max_per_day), ai_eligible=COALESCE(?,ai_eligible), updated_at=? WHERE id=?`)
      .bind(typeof b?.enabled === "boolean" ? (b.enabled ? 1 : 0) : null, typeof b?.label === "string" ? b.label.slice(0, 60) : null, b?.lane_default ?? null, b?.weight ?? null,
        b?.include_keywords != null ? JSON.stringify(keywordArray(b.include_keywords)) : null, b?.exclude_keywords != null ? JSON.stringify(keywordArray(b.exclude_keywords)) : null, b?.max_per_day ?? null, typeof b?.ai_eligible === "boolean" ? (b.ai_eligible ? 1 : 0) : null, now, sm[1]).run();
    return r.meta.changes ? json({ source: await db.prepare(`SELECT ${SRC} FROM sources WHERE id=?`).bind(sm[1]).first() }) : json({ error: "not_found" }, 404);
  }
  if (sm && m === "DELETE") { const r = await db.prepare("DELETE FROM sources WHERE id=?").bind(sm[1]).run(); return r.meta.changes ? json({ ok: true }) : json({ error: "not_found" }, 404); }
  if (url.pathname === "/api/library" && m === "GET") {
    const status = url.searchParams.get("status") || "approved";
    if (!["draft", "reviewed", "approved", "rejected", "all"].includes(status)) return json({ error: "bad_status" }, 400);
    const q = status === "all" ? db.prepare(`SELECT ${ROW} FROM items ORDER BY updated_at DESC LIMIT 200`)
      : db.prepare(`SELECT ${ROW} FROM items WHERE status=? ORDER BY updated_at DESC LIMIT 200`).bind(status);
    return json({ items: (await trained(db, (await q.all()).results)).sort(byPreference) });
  }
  if ((url.pathname === "/api/daily" || url.pathname === "/api/lanes") && m === "GET") {
    const date = url.searchParams.get("date") || (await db.prepare("SELECT MAX(run_date) d FROM items WHERE kind='daily'").first())?.d;
    if (date && !/^\d{4}-\d{2}-\d{2}$/u.test(date)) return json({ error: "bad_date" }, 400);
    const lane = url.searchParams.get("lane"); if (lane && !LANES.includes(lane)) return json({ error: "bad_lane" }, 400);
    if (url.searchParams.get("quarantine") === "1") {
      const held = (await db.prepare(`SELECT ${ROW} FROM items WHERE curation_status='quarantine' ORDER BY updated_at DESC LIMIT 200`).all()).results;
      return json({ date: date ?? null, items: (await trained(db, held)).sort(byPreference), mode: "quarantine", count: held.length });
    }
    const r = await db.prepare(`SELECT ${ROW},url_norm FROM items WHERE kind='daily' AND run_date=?${lane ? " AND lane=?" : ""}`).bind(...(lane ? [date ?? "", lane] : [date ?? ""])).all();
    const mutes = (await db.prepare("SELECT kind,value FROM mutes").all()).results;
    const all = (await trained(db, r.results)).sort(byPreference);
    if (url.searchParams.get("all") === "1") return json({ date: date ?? null, items: all, mode: "all" });
    const visible = all.filter((i) => i.curation_status !== "quarantine" && !i.dismissed_reason && !isMuted(i, mutes));
    const deduped = dedup(visible); const q = applyQuotas(deduped);
    const archived = visible.filter((i) => (i.pref_score ?? 0) < 0);
    const active = visible.filter((i) => (i.pref_score ?? 0) >= 0);
    const items = url.searchParams.get("archive") === "1" ? archived : q.items.filter((i) => (i.pref_score ?? 0) >= 0);
    const quarantine_count = (await db.prepare("SELECT COUNT(*) n FROM items WHERE curation_status='quarantine'").first())?.n || 0;
    return json({ date: date ?? null, items, mode: "curated", archived_count: archived.length, quarantine_count, stats: { total: all.length, hidden: all.length - visible.length, duplicates: visible.length - deduped.length, quota_held: q.held, x_cap: q.xCap } });
  }
  if (url.pathname === "/api/read-later" && m === "GET") {
    return json({ items: (await db.prepare(`SELECT ${ROW} FROM items WHERE read_later=1 ORDER BY updated_at DESC LIMIT 200`).all()).results.map(shape) });
  }
  if (url.pathname === "/api/mutes" && m === "GET") return json({ mutes: (await db.prepare("SELECT id,kind,value,created_at FROM mutes ORDER BY created_at").all()).results });
  if (url.pathname === "/api/mutes" && m === "POST") {
    const b = await request.json().catch(() => ({})); const kind = b?.kind; let value = String(b?.value ?? "").trim().slice(0, 80);
    if (!["topic", "keyword", "handle"].includes(kind) || !value) return json({ error: "bad_mute", hint: "kind: topic|keyword|handle, value 必填" }, 400);
    if (kind === "handle") { const hm = value.match(HANDLE); if (!hm) return json({ error: "bad_mute", hint: "X 帳號格式：@handle" }, 400); value = "@" + hm[1]; }
    const id = crypto.randomUUID(); const r = await db.prepare("INSERT OR IGNORE INTO mutes(id,kind,value,created_at) VALUES(?,?,?,?)").bind(id, kind, value, now).run();
    if (!r.meta.changes) return json({ error: "duplicate_mute" }, 409);
    await bump(db, kind === "handle" ? `x:${value}` : kind === "topic" ? `cat:${value}` : null, -1, now);
    return json({ mute: { id, kind, value, created_at: now } }, 201);
  }
  const mm = url.pathname.match(/^\/api\/mutes\/([0-9a-f-]{36})$/u);
  if (mm && m === "DELETE") { const r = await db.prepare("DELETE FROM mutes WHERE id=?").bind(mm[1]).run(); return r.meta.changes ? json({ ok: true }) : json({ error: "not_found" }, 404); }
  if (url.pathname === "/api/kb" && m === "GET") {
    return json({ entries: (await db.prepare(`SELECT ${KB} FROM kb_entries ORDER BY updated_at DESC LIMIT 500`).all()).results.map(kbShape) });
  }
  if (url.pathname === "/api/kb/export" && m === "GET") {
    // Markdown + YAML frontmatter for Obsidian. format=json -> [{path, content}], default -> one concatenated .md
    const since = url.searchParams.get("since"); if (since && !/^\d{4}-\d{2}-\d{2}/u.test(since)) return json({ error: "bad_since" }, 400);
    const rows = (await (since ? db.prepare(`SELECT ${KB} FROM kb_entries WHERE updated_at>=? ORDER BY updated_at`).bind(since) : db.prepare(`SELECT ${KB} FROM kb_entries ORDER BY updated_at`)).all()).results.map(kbShape);
    const hls = (await db.prepare("SELECT item_id,text,note FROM highlights ORDER BY created_at").all()).results; for (const e of rows) e.highlights = e.item_id ? hls.filter((h) => h.item_id === e.item_id) : [];
    if (url.searchParams.get("format") === "json") return json({ count: rows.length, files: rows.map((e) => ({ id: e.id, path: kbPath(e), updated_at: e.updated_at, content: kbMarkdown(e) })) });
    return new Response(rows.map(kbMarkdown).join("\n\n"), { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": "attachment; filename=radar-kb.md", ...SEC } });
  }
  const km = url.pathname.match(/^\/api\/kb\/([0-9a-f-]{32,36})$/u);
  if (km && m === "PATCH") {
    const b = await request.json().catch(() => ({})); const tags = Array.isArray(b?.tags) ? JSON.stringify(b.tags.map((t) => String(t).slice(0, 40)).slice(0, 20)) : null;
    const r = await db.prepare("UPDATE kb_entries SET note=COALESCE(?,note), tags=COALESCE(?,tags), updated_at=? WHERE id=?").bind(typeof b?.note === "string" ? b.note.slice(0, 5000) : null, tags, now, km[1]).run();
    return r.meta.changes ? json({ entry: kbShape(await db.prepare(`SELECT ${KB} FROM kb_entries WHERE id=?`).bind(km[1]).first()) }) : json({ error: "not_found" }, 404);
  }
  if (km && m === "DELETE") { const r = await db.prepare("DELETE FROM kb_entries WHERE id=?").bind(km[1]).run(); return r.meta.changes ? json({ ok: true }) : json({ error: "not_found" }, 404); }
  const act = url.pathname.match(/^\/api\/items\/([0-9a-f-]{36})\/action$/u);
  if (act && m === "POST") {
    const b = await request.json().catch(() => ({})); const a = b?.action; const reason = b?.reason ?? null;
    if (a === "release_quarantine") {
      const it = await db.prepare(`SELECT ${ROW} FROM items WHERE id=?`).bind(act[1]).first(); if (!it) return json({ error: "not_found" }, 404);
      if (it.curation_status !== "quarantine") return json({ error: "not_quarantined" }, 409);
      const auditReason = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 120) : "owner_reviewed_relevance";
      const [changed] = await db.batch([
        db.prepare("UPDATE items SET curation_status='released',curation_reason=NULL,updated_at=? WHERE id=? AND curation_status='quarantine'").bind(now, it.id),
        db.prepare("INSERT INTO item_curation_actions(id,item_id,action,reason,created_at) SELECT ?,?,'release_quarantine',?,? WHERE changes()>0").bind(crypto.randomUUID(), it.id, auditReason, now),
      ]);
      if (!changed.meta.changes) return json({ error: "curation_conflict" }, 409);
      return json({ item: shape(await db.prepare(`SELECT ${ROW} FROM items WHERE id=?`).bind(it.id).first()), editorial_status_unchanged: true });
    }
    if (!["star", "unstar", "read_later", "unread_later", "not_interested", "restore"].includes(a)) return json({ error: "bad_action" }, 400);
    if (a === "not_interested" && !REASONS.includes(reason)) return json({ error: "bad_reason", hint: REASONS.join("|") }, 400);
    const it = await db.prepare(`SELECT ${ROW} FROM items WHERE id=?`).bind(act[1]).first(); if (!it) return json({ error: "not_found" }, 404);
    const set = { star: "starred=1", unstar: "starred=0", read_later: "read_later=1", unread_later: "read_later=0", not_interested: "dismissed_reason=?", restore: "dismissed_reason=NULL" }[a];
    await db.prepare(`UPDATE items SET ${set}, updated_at=? WHERE id=?`).bind(...(a === "not_interested" ? [reason, now, it.id] : [now, it.id])).run();
    await db.prepare("INSERT INTO item_actions(id,item_id,action,reason,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), it.id, a, reason, now).run();
    const w = { star: [0.6, 0.3], unstar: [-0.3, -0.15], read_later: [0.2, 0.1], unread_later: [0, 0], not_interested: [reason === "duplicate" || reason === "already_known" ? -0.2 : -0.5, -0.25], restore: [0.2, 0.1] }[a];
    await bump(db, it.source, w[0], now); if (it.category) await bump(db, `cat:${it.category}`, w[1], now);
    if (a === "star") await kbUpsert(db, it, "star", now);
    if (a === "unstar") await db.prepare("DELETE FROM kb_entries WHERE item_id=? AND origin='star'").bind(it.id).run();
    return json({ item: shape(await db.prepare(`SELECT ${ROW} FROM items WHERE id=?`).bind(it.id).first()) });
  }
  const one = url.pathname.match(/^\/api\/items\/([0-9a-f-]{36})(?:\/(review|approve|reject|translate|deep-read))?$/u);
  if (one && m === "GET" && !one[2]) {
    const r = await db.prepare(`SELECT ${DETAIL_ROW} FROM items WHERE id=?`).bind(one[1]).first();
    return r ? json({ item: shape(r) }) : json({ error: "not_found" }, 404);
  }
  if (one && m === "POST" && one[2] === "deep-read") {
    const it = await db.prepare("SELECT id,kind,source,source_type,title,url,summary,raw_excerpt,lane,updated_at,ai_provider FROM items WHERE id=?").bind(one[1]).first();
    if (!it) return json({ error: "not_found" }, 404);
    let ai; try { ai = await summarize(env, [it.title, it.url, it.raw_excerpt || it.summary || ""].filter(Boolean).join("\n"), { fetchImpl: deps.fetchImpl ?? fetch, lane: it.lane, forceModel: true }); } catch (e) { await storeAnalysisFailure(db, it.id, it.updated_at, e); return aiErr(e); }
    ai.content_basis = "from_excerpt"; ai.source_type = sourceKind(it);
    const changed = await db.prepare(AI_UPDATE.replace("updated_at=? WHERE", "review_status='ai_enriched',updated_at=? WHERE") + " AND title IS ? AND raw_excerpt IS ? AND updated_at IS ? AND ai_provider IS ?")
      .bind(...aiBind(ai, it.title, now, it.id), it.title, it.raw_excerpt, it.updated_at, it.ai_provider).run();
    if (!changed.meta.changes) return json({ error: "stale_source" }, 409);
    return json({ item: shape(await db.prepare(`SELECT ${ROW} FROM items WHERE id=?`).bind(it.id).first()), provider: ai.provider, model: ai.model || null, content_basis: ai.content_basis, source_type: ai.source_type });
  }
  if (one && m === "POST" && one[2] === "translate") {
    // 轉中文 / re-analyze one existing item (incl. imported/unanalyzed). Counts against caps; status unchanged (human review gate kept).
    const it = await db.prepare("SELECT id,kind,source,source_type,title,url,summary,raw_excerpt,updated_at,ai_provider FROM items WHERE id=?").bind(one[1]).first();
    if (!it) return json({ error: "not_found" }, 404);
    const text = [it.title, it.url, it.raw_excerpt || it.summary || ""].filter(Boolean).join("\n");
    let ai; try { ai = await summarize(env, text, { fetchImpl: deps.fetchImpl ?? fetch, task: "translate" }); } catch (e) { await storeAnalysisFailure(db, it.id, it.updated_at, e); return aiErr(e); }
    ai.content_basis = "from_excerpt"; ai.source_type = sourceKind(it);
    const changed = await db.prepare(AI_UPDATE + " AND title IS ? AND raw_excerpt IS ? AND updated_at IS ? AND ai_provider IS ?")
      .bind(...aiBind(ai, ai.title_original, now, it.id), it.title, it.raw_excerpt, it.updated_at, it.ai_provider).run();
    if (!changed.meta.changes) return json({ error: "stale_source" }, 409);
    return json({ item: shape(await db.prepare(`SELECT ${ROW} FROM items WHERE id=?`).bind(it.id).first()), provider: ai.provider, model: ai.model || null, content_basis: ai.content_basis, source_type: ai.source_type });
  }
  if (one && m === "POST" && one[2]) {
    // Human review gate: approve only after reviewed. Lightweight feedback: bump source weight for future retrieval.
    const [from, to] = { review: [["draft"], "reviewed"], approve: [["reviewed"], "approved"], reject: [["draft", "reviewed"], "rejected"] }[one[2]];
    const row = await db.prepare("SELECT source, status FROM items WHERE id=?").bind(one[1]).first();
    if (!row || !from.includes(row.status)) return json({ error: "invalid_transition" }, 409);
    const res = await db.prepare(`UPDATE items SET status=?, updated_at=? WHERE id=? AND status IN (${from.map(() => "?").join(",")})`).bind(to, now, one[1], ...from).run();
    if (!res.meta.changes) return json({ error: "invalid_transition" }, 409);
    const delta = one[2] === "reject" ? -0.5 : 0.3;
    await bump(db, row.source, delta, now);
    if (one[2] === "approve") await kbUpsert(db, await db.prepare(`SELECT ${ROW} FROM items WHERE id=?`).bind(one[1]).first(), "approved", now);
    return json({ ok: true, status: to });
  }
  if (url.pathname === "/api/capture" && m === "POST") {
    if (!(request.headers.get("content-type") || "").includes("application/json")) return json({ error: "json_required" }, 415);
    const body = await request.json().catch(() => null);
    const text = String(body?.text ?? "").slice(0, 20000); let link = String(body?.url ?? "").trim();
    if (link && !/^https?:\/\//u.test(link)) return json({ error: "bad_url" }, 400);
    const content = collapseRepeatedParagraphs(text.trim().slice(0, 20000)); if (!link && !content) return json({ error: "empty_capture" }, 400);
    const sourceLanguage = ["en", "zh-Hant", "zh-Hans"].includes(body?.source_language) ? body.source_language : "unknown";
    const languageProvenance = sourceLanguage === "unknown" ? "unknown" : "user_declared";
    const suppliedTitle = String(body?.title ?? "").trim().slice(0, 240);
    const inferredTitle = content.split(/\n/u).map((x) => x.trim()).find(Boolean)?.replace(/^#+\s*/u, "").slice(0, 160);
    const title = suppliedTitle || inferredTitle || link || "URL 待整理來源";
    const titleSource = suppliedTitle ? "user" : inferredTitle ? "inferred" : "synthesized";
    const needsSource = content.length < 80; const lane = LANES.includes(body?.lane) ? body.lane : undefined;
    const score = scoreLane({ title, url: link, raw_excerpt: content, lane, published_at: body?.published_at || null }, { nowMs: Date.now() });
    const suspect = score.injection_suspect || injectionSuspect(content);
    const id = crypto.randomUUID(); const urlNorm = normalizeUrl(link);
    const excerpt = content.replace(/\s+/gu, " ").slice(0, 280) || "尚未取得可核對正文。";
    const metrics = { source_language: sourceLanguage, language_provenance: languageProvenance };
    const paragraphs = content.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean).map((part) => ({ tag: "p", text: part }));
    const totalChunks = chunkParagraphs(paragraphs, 2500).length;
    const captureSourceType = content ? "manual_text" : "selected_url";
    const insert = db.prepare(`INSERT OR IGNORE INTO items(id,kind,status,title,title_source,url,url_norm,source,source_type,category,summary,key_points,score,raw_excerpt,ai_provider,lane,pref_score,pref_reasons,pref_breakdown,curation_status,curation_reason,published_at,claim_status,evidence_tier,review_status,injection_suspect,metrics,created_at,updated_at)
        VALUES(?, 'capture', 'draft', ?, ?, ?, ?, 'quick-capture', ?, 'CAPTURE', ?, '[]', NULL, ?, 'extractive', ?, ?, ?, ?, ?, ?, ?, 'unverified', 'social', ?, ?, ?, ?, ?)`)
      .bind(id, title, titleSource, link || null, urlNorm, captureSourceType, excerpt, content.slice(0, 280), score.lane, score.pref_score, JSON.stringify(score.pref_reasons), JSON.stringify(score.pref_breakdown), score.curation_status, score.curation_reason, body?.published_at || null, needsSource ? "NEEDS_SOURCE_REVIEW" : "needs_review", suspect ? 1 : 0, JSON.stringify(metrics), now, now);
    if (content) {
      const articleInsert = db.prepare(`INSERT INTO articles(item_id,url,status,title,site,paragraphs,chars,translation,translated_chunks,total_chunks,fetched_at,updated_at,title_source)
        SELECT id,?,'ok',?,'manual_text',?,?,'[]',0,?,?,?,? FROM items WHERE id=?`)
        .bind(link || null, title, JSON.stringify(paragraphs), content.length, totalChunks, now, now, titleSource, id);
      const [created] = await db.batch([insert, articleInsert]);
      if (created.meta.changes) return captureReply(id, score, needsSource, suspect, "created", 201);
    } else {
      const created = await insert.run();
      if (created.meta.changes) return captureReply(id, score, needsSource, suspect, "created", 201);
    }
    // The schema's exact (url, kind) uniqueness is the identity contract. url_norm is only a ranking hint.
    const existing = await db.prepare("SELECT * FROM items WHERE url=? AND kind='capture'").bind(link).first();
    if (!existing) return json({ error: "capture_conflict", hint: "擷取資料衝突，請重試" }, 409);
    const prior = await db.prepare("SELECT * FROM articles WHERE item_id=?").bind(existing.id).first();
    const priorMetrics = existing.metrics ? JSON.parse(existing.metrics) : {};
    const exactReplay = prior?.site === "manual_text" && prior.paragraphs === JSON.stringify(paragraphs)
      && priorMetrics.source_language === sourceLanguage && prior.title === title;
    if (exactReplay || !content) return storedCaptureReply(existing);
    if (existing.status !== "draft") return json({ error: "capture_conflict", id: existing.id, hint: "既有記錄已進入審核，不能直接更改正文" }, 409);
    const history = Array.isArray(priorMetrics.capture_history) ? priorMetrics.capture_history : [];
    if (history.length >= CAPTURE_HISTORY_LIMIT) return json({ error: "capture_history_full", id: existing.id, hint: "此記錄的來源歷史已滿；請先另行保存並人工處理" }, 409);
    const previousItem = { ...existing }; delete previousItem.metrics;
    const snapshot = { at: now, item: { ...previousItem, source_language: priorMetrics.source_language || "unknown",
      language_provenance: priorMetrics.language_provenance || "unknown", translation_provider: priorMetrics.translation_provider || null }, article: prior };
    const nextMetrics = { ...priorMetrics, ...metrics, capture_history: [...history, snapshot], capture_revision: crypto.randomUUID() };
    delete nextMetrics.translation_provider;
    if (new TextEncoder().encode(JSON.stringify(nextMetrics)).length > CAPTURE_HISTORY_BYTES)
      return json({ error: "capture_history_full", id: existing.id, hint: "既有正文歷史超出保存上限；請先另行保存並人工處理" }, 409);
    // D1 batch runs as one transaction. Both writes are conditional on the same CAS revision.
      const update = db.prepare(`UPDATE items SET title=?,title_source=?,source_type='manual_text',summary=?,raw_excerpt=?,ai_provider='extractive',title_zh=NULL,title_original=NULL,summary_en=NULL,key_points='[]',key_points_en='[]',score=NULL,score_reason=NULL,reco_score=NULL,reco_reason=NULL,side_income_new=0,side_income_reason=NULL,
      lane=?,pref_score=?,pref_reasons=?,pref_breakdown=?,curation_status=?,curation_reason=?,metrics=?,review_status=?,injection_suspect=?,updated_at=? WHERE id=? AND status='draft' AND metrics IS ? AND updated_at IS ? AND ai_provider IS ?
      AND ((? IS NULL AND NOT EXISTS(SELECT 1 FROM articles WHERE item_id=?)) OR EXISTS(SELECT 1 FROM articles WHERE item_id=? AND updated_at IS ? AND paragraphs IS ? AND summary IS ? AND translation IS ?))`)
      .bind(title, titleSource, excerpt, content.slice(0, 280), score.lane, score.pref_score, JSON.stringify(score.pref_reasons), JSON.stringify(score.pref_breakdown), score.curation_status, score.curation_reason, JSON.stringify(nextMetrics), needsSource ? "NEEDS_SOURCE_REVIEW" : "needs_review", suspect ? 1 : 0, now,
        existing.id, existing.metrics, existing.updated_at, existing.ai_provider, prior?.item_id || null, existing.id, existing.id, prior?.updated_at || null, prior?.paragraphs || null, prior?.summary || null, prior?.translation || null);
    const articleUpsert = db.prepare(`INSERT INTO articles(item_id,url,status,title,byline,site,paragraphs,chars,error,translation,translated_chunks,total_chunks,summary,ai_provider,fetched_at,updated_at,title_source)
      SELECT id,?,'ok',?,NULL,'manual_text',?,?,NULL,'[]',0,?,NULL,NULL,?,?,? FROM items WHERE id=? AND metrics=?
      ON CONFLICT(item_id) DO UPDATE SET url=excluded.url,status='ok',title=excluded.title,byline=NULL,site='manual_text',paragraphs=excluded.paragraphs,chars=excluded.chars,error=NULL,title_source=excluded.title_source,
      translation='[]',translated_chunks=0,total_chunks=excluded.total_chunks,summary=NULL,ai_provider=NULL,fetched_at=excluded.fetched_at,updated_at=excluded.updated_at`)
      .bind(link, title, JSON.stringify(paragraphs), content.length, totalChunks, now, now, titleSource, existing.id, JSON.stringify(nextMetrics));
    const [changed] = await db.batch([update, articleUpsert]);
    if (!changed.meta.changes) return json({ error: "capture_conflict", id: existing.id, hint: "正文剛被更新；請核對後重試，貼上內容仍保留在表單" }, 409);
    return captureReply(existing.id, score, needsSource, suspect, "manual_enrichment", 200);
  }
  if (url.pathname === "/api/inbox/import" && m === "POST") {
    const body = await request.json().catch(() => null); const records = Array.isArray(body) ? body : body?.records;
    if (!Array.isArray(records) || records.length > 100) return json({ error: "bad_batch", hint: "最多 100 筆 SourceInput" }, 400);
    let inserted = 0, duplicate = 0, needsSource = 0; const ids = [];
    for (const record of records) {
      const content = collapseRepeatedParagraphs(String(record?.value ?? record?.text ?? "").trim().slice(0, 20000));
      const link = String(record?.sourceUrl ?? record?.url ?? "").trim();
      if (link && !/^https?:\/\//u.test(link)) continue;
      if (!content && !link) continue;
      const suppliedTitle = String(record?.title ?? "").trim().slice(0, 240);
      const title = suppliedTitle || link || content.slice(0, 120) || "未命名來源";
      const titleSource = suppliedTitle ? "user" : link || !content ? "synthesized" : "inferred";
      const urlNorm = normalizeUrl(link); const titleHash = await hashTitle(title);
      const exists = await db.prepare("SELECT id FROM items WHERE (url_norm=? AND ? IS NOT NULL) OR title_hash=? LIMIT 1").bind(urlNorm, urlNorm, titleHash).first();
      if (exists) { duplicate++; continue; }
      const laneHint = LANES.includes(record?.lane) ? record.lane : undefined;
      const typeInput = String(record?.sourceType ?? record?.source_type ?? record?.platform ?? "").toLocaleLowerCase();
      const sourceType = ({ x: "x_post", twitter: "x_post", rss: "rss", github_search: "github_search", github_releases: "github_releases", youtube_channel: "youtube_channel", manual: "manual_text", manual_text: "manual_text", selected_url: "selected_url" })[typeInput] || (content ? "imported" : "selected_url");
      const published = /^\d{4}-\d\d-\d\d(?:T.*)?$/u.test(record?.publishedAt || "") ? record.publishedAt : null;
      const scored = scoreLane({ title, raw_excerpt: content, lane: laneHint, published_at: published });
      const suspect = scored.injection_suspect || injectionSuspect(content); const short = content.length < 80; if (short) needsSource++;
      const id = crypto.randomUUID();
      await db.prepare(`INSERT INTO items(id,kind,status,title,title_source,url,url_norm,title_hash,source,source_type,category,summary,key_points,raw_excerpt,ai_provider,lane,pref_score,pref_reasons,pref_breakdown,curation_status,curation_reason,published_at,claim_status,evidence_tier,review_status,injection_suspect,created_at,updated_at)
        VALUES(?, 'capture', 'draft', ?, ?, ?, ?, ?, ?, ?, 'CAPTURE', ?, '[]', ?, 'extractive', ?, ?, ?, ?, ?, ?, ?, 'unverified', 'social', ?, ?, ?, ?)`)
        .bind(id, title, titleSource, link || null, urlNorm, titleHash, String(record?.platform || record?.kind || "manual").slice(0, 80), sourceType, content.replace(/\s+/gu, " ").slice(0, 280) || "尚未取得可核對正文。", content.slice(0, 4000), scored.lane, scored.pref_score, JSON.stringify(scored.pref_reasons), JSON.stringify(scored.pref_breakdown), scored.curation_status, scored.curation_reason, published, short ? "NEEDS_SOURCE_REVIEW" : "needs_review", suspect ? 1 : 0, now, now).run();
      inserted++; ids.push(id);
    }
    return json({ inserted, duplicate, needs_source_review: needsSource, ai_calls: 0, ids }, 201);
  }
  return json({ error: "api_route_not_found" }, 404);
}

async function listSources(db, url, owner = false) {
  const t = url.searchParams.get("type"); if (t && !["rss", "x", "github_search", "github_releases", "youtube_channel"].includes(t)) return json({ error: "bad_type" }, 400);
  const includeDisabled = owner && url.searchParams.get("include_disabled") === "1";
  const enabled = url.searchParams.get("enabled");
  const where = [], args = [];
  if (t === "x") where.push("(type='x' OR adapter_type='x')");
  else if (t) { where.push("adapter_type=? AND type!='x'"); args.push(t); }
  if (enabled === "0" && owner) { where.push("enabled=0"); }
  else if (!includeDisabled || enabled === "1") where.push("enabled=1");
  const q = db.prepare(`SELECT ${SRC} FROM sources ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY type, created_at`).bind(...args);
  return json({ sources: (await q.all()).results });
}

export default {
  fetch: (req, env) => handle(req, env),
  scheduled: (event, env, ctx) => ctx.waitUntil(runDaily(env)),
};
