import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../cloud/src/worker.mjs";
import { runDaily, analyzePending, parseFeed } from "../cloud/src/collector.mjs";
import { usage, generate } from "../cloud/src/ai.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";

const kit = accessKit();
const authFetch = async () => new Response(kit.jwks, { headers: { "content-type": "application/json" } });
const gemOk = (payload) => async (u) => String(u).includes("generativelanguage") ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })) : new Response("<p>" + "內容".repeat(100) + "</p>");
function mkEnv(over = {}) {
  return { DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash, GEMINI_API_KEY: "test-key", AI_DAILY_CAP: "10", ...over };
}
const req = (path, { token = kit.token(), ...o } = {}) => new Request("https://radar.example" + path, { ...o, headers: { ...(token ? { "Cf-Access-Jwt-Assertion": token } : {}), ...(o.headers || {}) } });
const AI = { title: "T", summary: "摘要", key_points: ["a", "b", "c"], score: 8 };
const LONG_TEXT = "This English article describes a product workflow, market research, and practical implementation lessons for a small team. ".repeat(5);
async function captureThenRead(env, body, deps) {
  const cap = await handle(req("/api/capture", body), env, deps); if (cap.status !== 201) return cap;
  const { id } = await cap.json(); return handle(req(`/api/items/${id}/deep-read`, { method: "POST" }), env, deps);
}
async function captureThenTranslate(env, body, deps) {
  const cap = await handle(req("/api/capture", body), env, deps); if (cap.status !== 201) return cap;
  const { id } = await cap.json(); return handle(req(`/api/items/${id}/translate`, { method: "POST" }), env, deps);
}

test("deny by default: no JWT, bad aud, wrong owner, unconfigured", async () => {
  const env = mkEnv();
  assert.equal((await handle(req("/api/library", { token: null }), env, { authFetch })).status, 401);
  assert.equal((await handle(req("/api/library", { token: kit.token({ aud: ["other"] }) }), env, { authFetch })).status, 401);
  assert.equal((await handle(req("/api/library", { token: kit.token({ email: "x@evil.test" }) }), env, { authFetch })).status, 401);
  assert.equal((await handle(req("/"), mkEnv({ CLOUD_ACCESS_REQUIRED: "false" }), { authFetch })).status, 401);
  assert.equal((await handle(req("/api/cloud/capabilities"), env, { authFetch })).status, 200);
});

test("source health reports catalog types without claiming current availability", async () => {
  const env = mkEnv();
  const response = await handle(req("/api/source-health"), env, { authFetch });
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.catalog_counts.rss, 10);
  assert.equal(health.catalog_counts.api, 1);
  assert.equal(health.catalog_counts.official_html, 0);
  assert.equal(health.catalog_counts.manual, 1);
  assert.equal(health.sources.find((s) => s.id === "hn").status, "unknown");
  assert.equal(health.sources.find((s) => s.id === "anthropic").last_check_at, null);
});

test("source health records actual fixture HTTP failure reason and check time", async () => {
  const env = mkEnv({ AI_ANALYSIS_ENABLED: "false" });
  const fetchImpl = async (url) => String(url).includes("techcrunch.com") ? new Response("denied", { status: 403 })
    : String(url).includes("algolia.com") ? new Response(JSON.stringify({ hits: [] })) : new Response(RSS);
  const run = await runDaily(env, { fetchImpl });
  assert.ok(run.sourceErrors.some((x) => x.source === "techcrunch-ai" && x.error === "http_403"));
  const health = await handle(req("/api/source-health"), env, { authFetch }).then((r) => r.json());
  const source = health.sources.find((x) => x.id === "techcrunch-ai");
  assert.equal(source.status, "error");
  assert.equal(source.reason, "http_403");
  assert.ok(source.last_check_at);
});

test("capture -> draft -> review -> approve; approve before review rejected", async () => {
  const env = mkEnv(); const d = { authFetch, fetchImpl: gemOk(AI) };
  const r = await handle(req("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: LONG_TEXT }) }), env, d);
  assert.equal(r.status, 201); const { id, status } = await r.json(); assert.equal(status, "draft");
  assert.equal((await handle(req(`/api/library?status=approved`), env, d).then((x) => x.json())).items.length, 0);
  assert.equal((await handle(req(`/api/items/${id}/approve`, { method: "POST" }), env, d)).status, 409);
  assert.equal((await handle(req(`/api/items/${id}/review`, { method: "POST" }), env, d)).status, 200);
  assert.equal((await handle(req(`/api/items/${id}/approve`, { method: "POST" }), env, d)).status, 200);
  const lib = await handle(req(`/api/library`), env, d).then((x) => x.json());
  assert.deepEqual(lib.items[0].key_points, []); // store-first capture has no model output
});

test("capture stores URL-only or short content without calling AI", async () => {
  let called = false; const env = mkEnv();
  const r = await handle(req("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "short" }) }), env, { authFetch, fetchImpl: async () => { called = true; } });
  assert.equal(r.status, 201); assert.equal((await r.json()).review_status, "NEEDS_SOURCE_REVIEW"); assert.equal(called, false);
});

test("deep-read makes one provider attempt and does not fall back after Gemini 429/403", async () => {
  const fail = (s) => async () => new Response("x", { status: s });
  const ai = { run: async () => ({ response: JSON.stringify(AI) }) };
  const body = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: LONG_TEXT }) };
  const r1 = await captureThenRead(mkEnv({ AI: ai, AI_FALLBACK_PROVIDER: "workers-ai" }), body, { authFetch, fetchImpl: fail(429) });
  assert.equal(r1.status, 502);
  const r2 = await captureThenRead(mkEnv({ AI: ai, AI_FALLBACK_PROVIDER: "workers-ai" }), body, { authFetch, fetchImpl: fail(403) });
  assert.equal(r2.status, 502);
});

const RSS = `<?xml version="1.0"?><rss><channel>${Array.from({ length: 8 }, (_, i) => `<item><title>News ${i}</title><link>https://ex.test/${i}</link><description>d${i}</description></item>`).join("")}</channel></rss>`;
test("cron runDaily collects feeds, dedupes, and respects daily AI cap", async () => {
  const env = mkEnv({ AI_DAILY_CAP: "3", AI_MANUAL_RESERVE_GEMINI: "0", AI_MANUAL_RESERVE_WORKERS: "0", AI_AUTO_ANALYZE_LIMIT: "5" });
  const f = async (u) => String(u).includes("generativelanguage") ? gemOk(AI)(u) : String(u).includes("algolia") ? new Response(JSON.stringify({ hits: [] })) : new Response(RSS);
  const r = await runDaily(env, { fetchImpl: f });
  assert.equal(r.collected, 5); assert.equal(r.analyzed, 0); assert.equal(r.error, null);
  const again = await runDaily(env, { fetchImpl: f }); assert.equal(again.collected, 0);
  assert.equal(parseFeed(RSS, { id: "x", category: "C" }).length, 5);
});

test("unknown api route 404, bad status 400", async () => {
  const env = mkEnv();
  assert.equal((await handle(req("/api/nope"), env, { authFetch })).status, 404);
  assert.equal((await handle(req("/api/library?status=x"), env, { authFetch })).status, 400);
});

const BI = { title_original: "OpenAI ships X", title_zh: "OpenAI 推出 X", summary: "中文摘要", summary_en: "English summary", key_points_zh: ["甲", "乙", "丙"], key_points_en: ["a", "b", "c"], score: 7 };
const wai = (calls = { n: 0 }) => ({ run: async (model, input) => { calls.n++; calls.model = model; return { response: JSON.stringify(BI) }; } });
const capBody = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: LONG_TEXT }) };

test("bilingual output stored and returned", async () => {
  const env = mkEnv(); const d = { authFetch, fetchImpl: gemOk(BI) };
  const cap = await handle(req("/api/capture", capBody), env, d); const { id } = await cap.json();
  const r = await handle(req(`/api/items/${id}/deep-read`, { method: "POST" }), env, d); assert.equal(r.status, 200);
  const it = (await handle(req(`/api/items/${id}`), env, d).then((x) => x.json())).item;
  assert.equal(it.title_zh, "OpenAI 推出 X"); assert.equal(it.title_original, LONG_TEXT.slice(0, 160));
  assert.deepEqual(it.key_points, ["甲", "乙", "丙"]); assert.deepEqual(it.key_points_en, ["a", "b", "c"]); assert.equal(it.summary_en, "English summary");
});

test("Gemini cap reached is not a retryable failure, so it does not fall back", async () => {
  const calls = { n: 0 }; const env = mkEnv({ AI_DAILY_CAP: "1", WORKERS_AI_DAILY_CAP: "2", AI_FALLBACK_PROVIDER: "workers-ai", AI: wai(calls), WORKERS_AI_MODEL: "@cf/qwen/qwen3-30b-a3b-fp8" });
  const d = { authFetch, fetchImpl: gemOk(BI) }; const prov = [];
  for (let i = 0; i < 4; i++) { const r = await captureThenRead(env, capBody, d); prov.push(r.status === 200 ? (await r.json()).provider : r.status); }
  assert.deepEqual(prov, ["gemini", 429, 429, 429]); assert.equal(calls.n, 0);
  const c = await handle(req("/api/cloud/capabilities"), env, d).then((x) => x.json());
  assert.deepEqual([c.ai.usage.gemini.used, c.ai.usage.gemini.cap, c.ai.usage.workersAi.used, c.ai.usage.workersAi.cap], [1, 1, 0, 2]);
});

test("Gemini 5xx falls back; 403 does not; fallback disabled means no Workers AI", async () => {
  const fail = (s) => async () => new Response("x", { status: s });
  const on = { AI: wai(), AI_FALLBACK_PROVIDER: "workers-ai" };
  assert.equal((await (await captureThenTranslate(mkEnv(on), capBody, { authFetch, fetchImpl: fail(503) })).json()).item.ai_provider, "workers-ai");
  assert.equal((await captureThenTranslate(mkEnv(on), capBody, { authFetch, fetchImpl: fail(403) })).status, 502);
  const off = { calls: 0 }; const env = mkEnv({ AI_DAILY_CAP: "0", AI: { run: async () => { off.calls++; } } });
  assert.equal((await captureThenRead(env, capBody, { authFetch, fetchImpl: gemOk(BI) })).status, 429); assert.equal(off.calls, 0);
});

test("轉中文 translate endpoint on imported item keeps status, counts cap", async () => {
  const env = mkEnv({ AI_DAILY_CAP: "1" }); const d = { authFetch, fetchImpl: gemOk(BI) }; const id = crypto.randomUUID(); const t = new Date().toISOString();
  await env.DB.prepare("INSERT INTO items(id,kind,status,title,url,raw_excerpt,created_at,updated_at) VALUES(?, 'library', 'approved', 'English title', 'https://e.x/1', 'some english body', ?, ?)").bind(id, t, t).run();
  const r = await handle(req(`/api/items/${id}/translate`, { method: "POST" }), env, d); assert.equal(r.status, 200);
  const it = (await r.json()).item; assert.equal(it.title_zh, "OpenAI 推出 X"); assert.equal(it.status, "approved"); assert.equal(it.ai_provider, "gemini");
  assert.equal((await handle(req(`/api/items/${id}/translate`, { method: "POST" }), env, d)).status, 429);
  assert.equal((await handle(req(`/api/items/${crypto.randomUUID()}/translate`, { method: "POST" }), env, d)).status, 404);
});

import { parseAiJson } from "../cloud/src/ai.mjs";
test("parseAiJson strips ```json fences and Qwen <think> blocks", () => {
  assert.equal(parseAiJson("<think>hmm {x}</think>\n```json\n" + JSON.stringify(BI) + "\n```").title_zh, "OpenAI 推出 X");
  assert.throws(() => parseAiJson("<think>unterminated"), /ai_bad_output/);
});
test("Gemini insufficient content and bad output do not fall back; retries only on retryable errors", async () => {
  const gem = (t) => async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }));
  const calls = { n: 0 }; const on = { AI: wai(calls), AI_FALLBACK_PROVIDER: "workers-ai" };
  for (const t of ["not json", '{"error":"insufficient_content"}']) {
    const r = await captureThenRead(mkEnv(on), capBody, { authFetch, fetchImpl: gem(t) });
    assert.equal(r.status, t === "not json" ? 502 : 422); assert.equal(calls.n, 0);
  }
  const bad = { AI: { run: async () => ({ response: '{"error":"insufficient_content"}' }) }, AI_FALLBACK_PROVIDER: "workers-ai" };
  const r = await captureThenRead(mkEnv(bad), capBody, { authFetch, fetchImpl: gem('{"error":"insufficient_content"}') });
  assert.equal(r.status, 422); assert.equal((await r.json()).error, "insufficient_content");
  const boom = { AI: { run: async () => { throw new Error("3040: capacity"); } }, AI_FALLBACK_PROVIDER: "workers-ai" };
  const r2 = await captureThenRead(mkEnv(boom), capBody, { authFetch, fetchImpl: gem("nope") });
  assert.equal(r2.status, 502); assert.equal((await r2.json()).error, "ai_bad_output");
  const gCalls = { n: 0 }; const gEnv = mkEnv({ AI_FALLBACK_PROVIDER: "workers-ai", AI: { run: async () => { gCalls.n++; return { response: "{}" }; } } });
  await assert.rejects(generate(gEnv, "task", LONG_TEXT, (x) => x, { fetchImpl: gem('{"error":"insufficient_content"}') }), /insufficient_content/u);
  assert.equal(gCalls.n, 0); assert.equal((await usage(gEnv)).gemini.used, 0);
});

test("failed reserved calls refund usage, including Gemini 403", async () => {
  const env = mkEnv({ AI_FALLBACK_PROVIDER: "workers-ai", AI: { run: async () => ({ response: JSON.stringify(BI) }) } });
  const bad = async () => new Response("bad", { status: 403 });
  const r = await captureThenRead(env, capBody, { authFetch, fetchImpl: bad }); assert.equal(r.status, 502);
  const u = await usage(env); assert.equal(u.gemini.used, 0); assert.equal(u.gemini.manualReserveRemaining, 5);
});

test("short Chinese capture is extractive and consumes no model quota", async () => {
  let called = false; const env = mkEnv();
  const r = await handle(req("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "值得收藏：用 React 和 CSS 快速製作一人公司產品頁，先驗證需求再投入成本。".repeat(3) }) }), env,
    { authFetch, fetchImpl: async () => { called = true; } });
  assert.equal(r.status, 201); assert.equal(called, false); const { id, ai_calls, review_status } = await r.json(); assert.equal(ai_calls, 0); assert.equal(review_status, "needs_review");
  const item = (await handle(req(`/api/items/${id}`), env, { authFetch }).then((x) => x.json())).item;
  assert.equal(item.ai_provider, "extractive"); assert.ok(item.title_zh == null); assert.equal((await usage(env)).gemini.used, 0);
});

test("auto analysis preserves manual floor and respects daily item limit", async () => {
  const env = mkEnv({ AI_DAILY_CAP: "3", AI_MANUAL_RESERVE_GEMINI: "1", AI_AUTO_ANALYZE_LIMIT: "2" });
  const nowMs = Date.now(), day = new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10), now = new Date(nowMs).toISOString();
  const shortId = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO items(id,kind,status,title,url,raw_excerpt,run_date,created_at,updated_at) VALUES(?, 'daily','draft',?,?,?, ?,?,?)")
    .bind(shortId, "React 學習工作流", "https://example.test/short", "一人公司可以用低成本工具快速驗證產品想法並記錄實作步驟。", day, now, now).run();
  for (let i = 0; i < 4; i++) await env.DB.prepare("INSERT INTO items(id,kind,status,title,url,raw_excerpt,run_date,created_at,updated_at) VALUES(?, 'daily','draft',?,?,?, ?,?,?)")
    .bind(crypto.randomUUID(), `React workflow for solopreneur ${i}`, `https://example.test/${i}`, "A low cost workflow and pricing experiment for an indie consultant. This is a useful product learning note.", day, now, now).run();
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(BI) }] } }] })); };
  const run = await analyzePending(env, { fetchImpl, nowMs }); assert.equal(run.analyzed, 3); assert.equal(calls, 2);
  const u = await usage(env); assert.equal(u.gemini.used, 2); assert.equal(u.gemini.autoUsed, 2); assert.equal(u.auto.used, 2);
  assert.equal((await env.DB.prepare("SELECT ai_provider FROM items WHERE id=?").bind(shortId).first()).ai_provider, "extractive");
  const pending = await env.DB.prepare("SELECT COUNT(*) n FROM items WHERE ai_provider IS NULL").first(); assert.equal(pending.n, 2);
  const capBody2 = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: LONG_TEXT }) };
  const manual = await captureThenRead(env, capBody2, { authFetch, fetchImpl }); assert.equal(manual.status, 200);
  assert.equal((await usage(env)).gemini.used, 3, "owner can spend the reserved call");
  const again = await analyzePending(env, { fetchImpl, nowMs }); assert.equal(again.analyzed, 0);
});
import { decodeEntities } from "../cloud/src/collector.mjs";
test("collector decodes HTML entities in titles", () => {
  assert.equal(decodeEntities("Intel&#8217;s &amp; &#x2014; &rsquo;x&rsquo; &bogus;"), "Intel’s & — ’x’ &bogus;");
  assert.equal(parseFeed(`<rss><channel><item><title>Intel&amp;#8217;s stock</title><link>https://e.t/1</link></item></channel></rss>`, { id: "x", category: "C" })[0].title, "Intel’s stock");
});
