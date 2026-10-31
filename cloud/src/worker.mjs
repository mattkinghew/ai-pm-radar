import { verifyCloudflareAccessOwner } from "./access-jwt.mjs";
import { summarize } from "./ai.mjs";
import { runDaily } from "./collector.mjs";

const SEC = { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...SEC } });
const ROW = "id,kind,status,title,url,source,category,summary,key_points,score,ai_provider,run_date,created_at,updated_at";
const shape = (r) => r && ({ ...r, key_points: r.key_points ? JSON.parse(r.key_points) : [] });

// Local-only test hook: lets wrangler dev smoke tests use a mocked JWKS. Ignored unless ENVIRONMENT === "local".
function authFetch(env) {
  if (env.ENVIRONMENT === "local" && env.ACCESS_TEST_JWKS) return async () => new Response(env.ACCESS_TEST_JWKS, { headers: { "content-type": "application/json" } });
  return fetch;
}

export async function handle(request, env, deps = {}) {
  const url = new URL(request.url);
  const owner = await verifyCloudflareAccessOwner(request, env, { fetchImpl: deps.authFetch ?? authFetch(env), nowMs: deps.nowMs });
  if (!owner) return url.pathname.startsWith("/api/") ? json({ error: "unauthorized" }, 401) : new Response("Unauthorized", { status: 401, headers: SEC });
  if (!url.pathname.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  const db = env.DB; const now = new Date().toISOString(); const m = request.method;

  if (url.pathname === "/api/cloud/capabilities" && m === "GET") {
    return json({ backend: "cloudflare", d1: !!db, ai: { gemini: !!env.GEMINI_API_KEY, fallback: env.AI_FALLBACK_PROVIDER || "none", dailyCap: Number(env.AI_DAILY_CAP || 10) }, cron: "0 0 * * * (08:00 HKT)", humanReviewRequired: true });
  }
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
  const one = url.pathname.match(/^\/api\/items\/([0-9a-f-]{36})(?:\/(review|approve|reject))?$/u);
  if (one && m === "GET" && !one[2]) {
    const r = await db.prepare(`SELECT ${ROW},raw_excerpt FROM items WHERE id=?`).bind(one[1]).first();
    return r ? json({ item: shape(r) }) : json({ error: "not_found" }, 404);
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
    catch (e) { return json({ error: e.message === "ai_daily_cap_reached" ? "ai_daily_cap_reached" : "ai_failed", detail: e.message }, e.message === "ai_daily_cap_reached" ? 429 : 502); }
    const id = crypto.randomUUID();
    await db.prepare(`INSERT INTO items(id,kind,status,title,url,source,category,summary,key_points,score,raw_excerpt,ai_provider,created_at,updated_at)
      VALUES(?, 'capture', 'draft', ?, ?, 'quick-capture', 'CAPTURE', ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, ai.title || link || "Quick Capture", link || null, ai.summary, JSON.stringify(ai.key_points), ai.score, content.slice(0, 4000), ai.provider, now, now).run();
    return json({ id, status: "draft", ...ai }, 201);
  }
  return json({ error: "api_route_not_found" }, 404);
}

export default {
  fetch: (req, env) => handle(req, env),
  scheduled: (event, env, ctx) => ctx.waitUntil(runDaily(env)),
};
