import { verifyCloudflareAccessOwner } from "./access-jwt.mjs";
import { summarize, usage } from "./ai.mjs";
import { runDaily, analyzePending, AI_UPDATE, aiBind } from "./collector.mjs";
import { hktDay } from "./ai.mjs";

const SEC = { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...SEC } });
const ROW = "id,kind,status,title,url,source,category,summary,key_points,score,ai_provider,title_zh,title_original,summary_en,key_points_en,run_date,created_at,updated_at,reco_score,reco_reason,metrics";
const pj = (v) => { try { return v ? JSON.parse(v) : []; } catch { return []; } };
const shape = (r) => r && ({ ...r, key_points: pj(r.key_points), key_points_en: pj(r.key_points_en), metrics: r.metrics ? pj(r.metrics) : null });
const SRC = "id,type,value,label,enabled,created_at,updated_at";
const HANDLE = /^@?([A-Za-z0-9_]{1,15})$/u;

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
    const res = await env.DB.prepare(`INSERT OR IGNORE INTO items(id,kind,status,title,url,source,category,raw_excerpt,run_date,external_id,metrics,created_at,updated_at)
      VALUES(?, 'daily', 'draft', ?, ?, ?, 'X_POST', ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), title, url, `x:@${handle}`, text.slice(0, 4000), day, `x:${pid}`, p.metrics ? JSON.stringify(p.metrics).slice(0, 1000) : null,
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
    const q = status === "all" ? db.prepare(`SELECT ${ROW} FROM items ORDER BY updated_at DESC LIMIT 200`)
      : db.prepare(`SELECT ${ROW} FROM items WHERE status=? ORDER BY updated_at DESC LIMIT 200`).bind(status);
    return json({ items: (await q.all()).results.map(shape) });
  }
  if (url.pathname === "/api/daily" && m === "GET") {
    const date = url.searchParams.get("date") || (await db.prepare("SELECT MAX(run_date) d FROM items WHERE kind='daily'").first())?.d;
    if (date && !/^\d{4}-\d{2}-\d{2}$/u.test(date)) return json({ error: "bad_date" }, 400);
    const r = await db.prepare(`SELECT ${ROW} FROM items WHERE kind='daily' AND run_date=? ORDER BY score DESC NULLS LAST`).bind(date ?? "").all();
    return json({ date: date ?? null, items: r.results.map(shape) });
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
    // Human review gate: approve only after reviewed.
    const [from, to] = { review: [["draft"], "reviewed"], approve: [["reviewed"], "approved"], reject: [["draft", "reviewed"], "rejected"] }[one[2]];
    const res = await db.prepare(`UPDATE items SET status=?, updated_at=? WHERE id=? AND status IN (${from.map(() => "?").join(",")})`).bind(to, now, one[1], ...from).run();
    return res.meta.changes ? json({ ok: true, status: to }) : json({ error: "invalid_transition" }, 409);
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
    await db.prepare(`INSERT INTO items(id,kind,status,title,url,source,category,summary,key_points,score,raw_excerpt,ai_provider,title_zh,title_original,summary_en,key_points_en,reco_score,reco_reason,created_at,updated_at)
      VALUES(?, 'capture', 'draft', ?, ?, 'quick-capture', 'CAPTURE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, ai.title_original || ai.title || link || "Quick Capture", link || null, ai.summary, JSON.stringify(ai.key_points), ai.score, content.slice(0, 4000), ai.provider,
        ai.title_zh, ai.title_original || null, ai.summary_en, JSON.stringify(ai.key_points_en), ai.reco_score, ai.reco_reason, now, now).run();
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
