import { verifyCloudflareAccessOwner } from "./access-jwt.mjs";
import { summarize, usage } from "./ai.mjs";
import { runDaily, analyzePending, AI_UPDATE, aiBind } from "./collector.mjs";
import { hktDay } from "./ai.mjs";
import { normalizeUrl, dedup, applyQuotas, isMuted, kbMarkdown, kbPath } from "./curation.mjs";

const SEC = { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...SEC } });
const ROW = "id,kind,status,title,url,source,category,summary,key_points,score,ai_provider,title_zh,title_original,summary_en,key_points_en,run_date,created_at,updated_at,reco_score,reco_reason,metrics,side_income_new,side_income_reason,score_reason,starred,read_later,dismissed_reason";
const pj = (v) => { try { return v ? JSON.parse(v) : []; } catch { return []; } };
const shape = (r) => r && ({ ...r, key_points: pj(r.key_points), key_points_en: pj(r.key_points_en), metrics: r.metrics ? pj(r.metrics) : null });
const SRC = "id,type,value,label,enabled,created_at,updated_at";
const HANDLE = /^@?([A-Za-z0-9_]{1,15})$/u;
const RANK = "(COALESCE(score,0)+COALESCE((SELECT weight FROM feedback_weights WHERE key=items.source),0)+COALESCE((SELECT weight FROM feedback_weights WHERE key='cat:'||items.category),0))";
const REASONS = ["not_relevant", "duplicate", "low_quality", "already_known", "too_much_x", "other"];
const KB = "id,item_id,title,url,source,category,summary,key_points,tags,note,score,origin,created_at,updated_at";
const kbShape = (r) => r && ({ ...r, key_points: pj(r.key_points), tags: pj(r.tags) });
// Feedback learning: clamp weights to [-2, 3].
async function bump(db, key, delta, now) {
  if (!key || !delta) return; const pos = delta > 0 ? 1 : 0, neg = delta < 0 ? 1 : 0;
  await db.prepare(`INSERT INTO feedback_weights(key,weight,pos,neg,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET weight=MIN(3, MAX(-2, weight+?)), pos=pos+?, neg=neg+?, updated_at=?`).bind(key, Math.max(-2, Math.min(3, delta)), pos, neg, now, delta, pos, neg, now).run();
}
async function kbUpsert(db, item, origin, now) {
  await db.prepare(`INSERT INTO kb_entries(${KB}) VALUES(?,?,?,?,?,?,?,?,'[]',NULL,?,?,?,?)
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

async function ingestX(request, env) {
  const body = await request.json().catch(() => null);
  const posts = Array.isArray(body) ? body : body?.posts;
  if (!Array.isArray(posts) || posts.length > 200) return json({ error: "bad_batch", hint: "posts: array (<=200)" }, 400);
  const now = new Date().toISOString(); const day = hktDay(); let inserted = 0, duplicate = 0; const rejected = [];
  for (const [i, p] of posts.entries()) {
    const hm = String(p?.handle ?? "").match(HANDLE); const pid = String(p?.post_id ?? "");
    const text = String(p?.text ?? "").trim();
    if (!hm || !/^\d{1,25}$/u.test(pid) || !text) { rejected.push(i); continue; }
    const handle = hm[1]; const url = /^https:\/\/(x|twitter)\.com\//u.test(p.url || "") ? p.url : `https://x.com/${handle}/status/${pid}`;
    const title = text.replace(/\s+/gu, " ").slice(0, 140);
    const res = await env.DB.prepare(`INSERT OR IGNORE INTO items(id,kind,status,title,url,url_norm,source,category,raw_excerpt,run_date,external_id,metrics,created_at,updated_at)
      VALUES(?, 'daily', 'draft', ?, ?, ?, ?, 'X_POST', ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), title, url, normalizeUrl(url), `x:@${handle}`, text.slice(0, 4000), day, `x:${pid}`, p.metrics ? JSON.stringify(p.metrics).slice(0, 1000) : null,
        /^\d{4}-\d{2}-\d{2}T/u.test(p.created_at || "") ? p.created_at : now, now).run();
    res.meta?.changes > 0 ? inserted++ : duplicate++;
  }
  return json({ inserted, duplicate, rejected, note: "AI 分析會喺下次每日排程（或 /api/analyze）按額度處理" });
}
const aiErr = (e) => { const code = /^[a-z0-9_]+$/u.test(e.message || "") ? e.message : "ai_error"; console.log(JSON.stringify({ ai_error: code, cause: e.cause?.message?.slice(0, 200) }));
  return json({ error: code, detail: code }, code === "ai_daily_cap_reached" ? 429 : code === "insufficient_content" ? 422 : 502); };

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
    return listSources(env.DB, url);
  }
  const owner = await verifyCloudflareAccessOwner(request, env, { fetchImpl: deps.authFetch ?? authFetch(env), nowMs: deps.nowMs });
  if (!owner) return url.pathname.startsWith("/api/") ? json({ error: "unauthorized" }, 401) : new Response("Unauthorized", { status: 401, headers: SEC });
  if (!url.pathname.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  const db = env.DB; const now = new Date().toISOString(); const m = request.method;

  if (url.pathname === "/api/cloud/capabilities" && m === "GET") {
    return json({ backend: "cloudflare", d1: !!db, ai: { gemini: !!env.GEMINI_API_KEY, fallback: env.AI_FALLBACK_PROVIDER || "none", dailyCap: Number(env.AI_DAILY_CAP || 10), usage: await usage(env) }, cron: "0 0 * * * (08:00 HKT)", humanReviewRequired: true });
  }
  if (url.pathname === "/api/sources" && m === "GET") return listSources(db, url);
  if (url.pathname === "/api/analyze" && m === "POST") return json(await analyzePending(env, { fetchImpl: deps.fetchImpl ?? fetch, limit: 20 }));
  if (url.pathname === "/api/sources" && m === "POST") {
    const b = await request.json().catch(() => ({})); const type = b?.type; let value = String(b?.value ?? "").trim();
    if (type === "rss") { if (!/^https:\/\/[^\s]+$/u.test(value)) return json({ error: "bad_source", hint: "RSS 需為 https:// 網址" }, 400); }
    else if (type === "x") { const hm = value.match(HANDLE); if (!hm) return json({ error: "bad_source", hint: "X 帳號格式：@handle" }, 400); value = "@" + hm[1]; }
    else return json({ error: "bad_source", hint: "type 需為 rss 或 x" }, 400);
    const id = crypto.randomUUID(); const label = String(b?.label ?? "").trim().slice(0, 60) || null;
    const r = await db.prepare(`INSERT OR IGNORE INTO sources(id,type,value,label,enabled,created_at,updated_at) VALUES(?,?,?,?,1,?,?)`).bind(id, type, value, label, now, now).run();
    return r.meta.changes ? json({ source: await db.prepare(`SELECT ${SRC} FROM sources WHERE id=?`).bind(id).first() }, 201) : json({ error: "duplicate_source", hint: "已經有呢個訊息源" }, 409);
  }
  const sm = url.pathname.match(/^\/api\/sources\/([0-9a-f-]{36})$/u);
  if (sm && m === "PATCH") {
    const b = await request.json().catch(() => ({}));
    const r = await db.prepare("UPDATE sources SET enabled=COALESCE(?,enabled), label=COALESCE(?,label), updated_at=? WHERE id=?")
      .bind(typeof b?.enabled === "boolean" ? (b.enabled ? 1 : 0) : null, typeof b?.label === "string" ? b.label.slice(0, 60) : null, now, sm[1]).run();
    return r.meta.changes ? json({ source: await db.prepare(`SELECT ${SRC} FROM sources WHERE id=?`).bind(sm[1]).first() }) : json({ error: "not_found" }, 404);
  }
  if (sm && m === "DELETE") { const r = await db.prepare("DELETE FROM sources WHERE id=?").bind(sm[1]).run(); return r.meta.changes ? json({ ok: true }) : json({ error: "not_found" }, 404); }
  if (url.pathname === "/api/library" && m === "GET") {
    const status = url.searchParams.get("status") || "approved";
    if (!["draft", "reviewed", "approved", "rejected", "all"].includes(status)) return json({ error: "bad_status" }, 400);
    const q = status === "all" ? db.prepare(`SELECT ${ROW} FROM items ORDER BY ${RANK} DESC, updated_at DESC LIMIT 200`)
      : db.prepare(`SELECT ${ROW} FROM items WHERE status=? ORDER BY ${RANK} DESC, updated_at DESC LIMIT 200`).bind(status);
    return json({ items: (await q.all()).results.map(shape) });
  }
  if (url.pathname === "/api/daily" && m === "GET") {
    const date = url.searchParams.get("date") || (await db.prepare("SELECT MAX(run_date) d FROM items WHERE kind='daily'").first())?.d;
    if (date && !/^\d{4}-\d{2}-\d{2}$/u.test(date)) return json({ error: "bad_date" }, 400);
    const r = await db.prepare(`SELECT ${ROW},url_norm FROM items WHERE kind='daily' AND run_date=? ORDER BY ${RANK} DESC, reco_score DESC NULLS LAST, score DESC NULLS LAST`).bind(date ?? "").all();
    const mutes = (await db.prepare("SELECT kind,value FROM mutes").all()).results;
    const all = r.results.map(shape);
    if (url.searchParams.get("all") === "1") return json({ date: date ?? null, items: all, mode: "all" });
    const visible = all.filter((i) => !i.dismissed_reason && !isMuted(i, mutes));
    const deduped = dedup(visible); const q = applyQuotas(deduped);
    return json({ date: date ?? null, items: q.items, mode: "curated", stats: { total: all.length, hidden: all.length - visible.length, duplicates: visible.length - deduped.length, quota_held: q.held, x_cap: q.xCap } });
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
  const one = url.pathname.match(/^\/api\/items\/([0-9a-f-]{36})(?:\/(review|approve|reject|translate))?$/u);
  if (one && m === "GET" && !one[2]) {
    const r = await db.prepare(`SELECT ${ROW},raw_excerpt FROM items WHERE id=?`).bind(one[1]).first();
    return r ? json({ item: shape(r) }) : json({ error: "not_found" }, 404);
  }
  if (one && m === "POST" && one[2] === "translate") {
    // 轉中文 / re-analyze one existing item (incl. imported/unanalyzed). Counts against caps; status unchanged (human review gate kept).
    const it = await db.prepare("SELECT id,title,url,summary,raw_excerpt FROM items WHERE id=?").bind(one[1]).first();
    if (!it) return json({ error: "not_found" }, 404);
    const text = [it.title, it.url, it.raw_excerpt || it.summary || ""].filter(Boolean).join("\n");
    let ai; try { ai = await summarize(env, text, { fetchImpl: deps.fetchImpl ?? fetch }); } catch (e) { return aiErr(e); }
    await db.prepare(AI_UPDATE).bind(...aiBind(ai, ai.title_original, now, it.id)).run();
    return json({ item: shape(await db.prepare(`SELECT ${ROW} FROM items WHERE id=?`).bind(it.id).first()) });
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
    let content = text;
    if (!content && link) {
      try { const r = await (deps.fetchImpl ?? fetch)(link, { headers: { "user-agent": "ai-pm-radar-cloud/1" }, signal: AbortSignal.timeout(10000) });
        if (r.ok) content = (await r.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 20000); } catch { /* fallthrough */ }
    }
    if (content.length < 80) return json({ error: "insufficient_content", hint: "影片/社交連結請直接貼字幕或正文" }, 422);
    let ai;
    try { ai = await summarize(env, `${link}\n${content}`, { fetchImpl: deps.fetchImpl ?? fetch }); }
    catch (e) { return aiErr(e); }
    const id = crypto.randomUUID();
    await db.prepare(`INSERT INTO items(id,kind,status,title,url,source,category,summary,key_points,score,raw_excerpt,ai_provider,title_zh,title_original,summary_en,key_points_en,reco_score,reco_reason,side_income_new,side_income_reason,score_reason,created_at,updated_at)
      VALUES(?, 'capture', 'draft', ?, ?, 'quick-capture', 'CAPTURE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, ai.title_original || ai.title || link || "Quick Capture", link || null, ai.summary, JSON.stringify(ai.key_points), ai.score, content.slice(0, 4000), ai.provider,
        ai.title_zh, ai.title_original || null, ai.summary_en, JSON.stringify(ai.key_points_en), ai.reco_score, ai.reco_reason, ai.side_income_new ?? 0, ai.side_income_reason ?? null, ai.score_reason ?? null, now, now).run();
    return json({ id, status: "draft", ...ai }, 201);
  }
  return json({ error: "api_route_not_found" }, 404);
}

async function listSources(db, url) {
  const t = url.searchParams.get("type"); if (t && !["rss", "x"].includes(t)) return json({ error: "bad_type" }, 400);
  const q = t ? db.prepare(`SELECT ${SRC} FROM sources WHERE type=? ORDER BY created_at`).bind(t) : db.prepare(`SELECT ${SRC} FROM sources ORDER BY type, created_at`);
  return json({ sources: (await q.all()).results });
}

export default {
  fetch: (req, env) => handle(req, env),
  scheduled: (event, env, ctx) => ctx.waitUntil(runDaily(env)),
};
