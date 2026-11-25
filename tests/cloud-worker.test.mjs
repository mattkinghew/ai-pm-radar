import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../cloud/src/worker.mjs";
import { runDaily, analyzePending, parseFeed } from "../cloud/src/collector.mjs";
import { usage, generate, classifyAiFailure, modelFor, targetLanguageFor } from "../cloud/src/ai.mjs";
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

test("AI failures map to stable actionable classes without carrying provider response text", () => {
  assert.deepEqual(classifyAiFailure(new Error("gemini_http_403")), { code: "auth_or_config", status: 403, provider: "gemini", retryable: false, hint: "AI 服務未設定或認證失敗；檢查 server-side provider 設定與權限。" });
  assert.equal(classifyAiFailure(new Error("gemini_http_429")).code, "provider_http");
  assert.equal(classifyAiFailure(new Error("ai_daily_cap_reached")).code, "cap_reached");
  assert.equal(classifyAiFailure(new DOMException("deadline", "TimeoutError")).code, "timeout");
  assert.equal(classifyAiFailure(new Error("ai_bad_output")).code, "malformed");
  assert.equal(modelFor({ GEMINI_MODEL: "fixture-model" }, "gemini"), "fixture-model");
  assert.equal(targetLanguageFor({}), "zh-Hant");
  assert.equal(targetLanguageFor({ AI_TARGET_LANGUAGE: "en" }), "en");
});
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

test("rejects expired, wrong-issuer and invalid-signature Access JWTs before protected routes", async () => {
  const env = mkEnv();
  const now = Math.floor(Date.now() / 1000);
  const valid = kit.token();
  const [header, payload, signature] = valid.split(".");
  const invalidSignature = `${header}.${payload}.${(signature[0] === "A" ? "B" : "A")}${signature.slice(1)}`;
  const invalidTokens = [
    kit.token({ iat: now - 600, exp: now - 300 }),
    kit.token({ iss: "https://attacker.cloudflareaccess.com" }),
    invalidSignature,
  ];
  for (const token of invalidTokens) {
    assert.equal((await handle(req("/api/cloud/capabilities", { token }), env, { authFetch })).status, 401);
  }
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
  assert.equal(r1.status, 502); assert.equal((await r1.json()).code, "provider_http");
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

test("Gemini provider errors return stable code and safe hint without provider body", async () => {
  const env = mkEnv();
  const cap = await handle(req("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: LONG_TEXT }) }), env, { authFetch });
  const { id } = await cap.json();
  const fail = await handle(req(`/api/items/${id}/deep-read`, { method: "POST" }), env, { authFetch, fetchImpl: async () => new Response("PRIVATE_PROVIDER_DETAIL", { status: 403 }) });
  const body = await fail.text();
  assert.equal(fail.status, 502); assert.match(body, /auth_or_config/u); assert.match(body, /provider_status":403/u); assert.doesNotMatch(body, /PRIVATE_PROVIDER_DETAIL/u);
  const failedItem = (await handle(req(`/api/items/${id}`), env, { authFetch }).then((r) => r.json())).item;
  assert.equal(failedItem.analysis_status, "failed"); assert.equal(failedItem.analysis_error_code, "auth_or_config");
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
  assert.equal(r2.status, 502); assert.equal((await r2.json()).error, "malformed");
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
  const run = await analyzePending(env, { fetchImpl, nowMs }); assert.equal(run.analyzed, 3); assert.equal(run.status, "partial"); assert.equal(run.skipped.filter((x) => x.reason === "auto_limit_reached").length, 2); assert.equal(calls, 2);
  const u = await usage(env); assert.equal(u.gemini.used, 2); assert.equal(u.gemini.autoUsed, 2); assert.equal(u.auto.used, 2);
  assert.equal((await env.DB.prepare("SELECT ai_provider FROM items WHERE id=?").bind(shortId).first()).ai_provider, "extractive");
  const pending = await env.DB.prepare("SELECT COUNT(*) n FROM items WHERE ai_provider IS NULL").first(); assert.equal(pending.n, 2);
  const capBody2 = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: LONG_TEXT }) };
  const manual = await captureThenRead(env, capBody2, { authFetch, fetchImpl }); assert.equal(manual.status, 200);
  assert.equal((await usage(env)).gemini.used, 3, "owner can spend the reserved call");
  const again = await analyzePending(env, { fetchImpl, nowMs }); assert.equal(again.analyzed, 0);
});

test("auto-analysis configurable gates and provider failures persist sanitized per-item reasons", async () => {
  const env = mkEnv({ AI_AUTO_ANALYZE_INCLUDE_TERMS: "radar", AI_AUTO_ANALYZE_EXCLUDE_TERMS: "blocked", AI_AUTO_ANALYZE_LIMIT: "4", AI_MANUAL_RESERVE_GEMINI: "0" });
  const nowMs = Date.now(), day = new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10), now = new Date(nowMs).toISOString();
  const add = async (title, excerpt, eligible = 1) => { const id = crypto.randomUUID(); await env.DB.prepare("INSERT INTO items(id,kind,status,title,url,source,raw_excerpt,run_date,created_at,updated_at,ai_eligible) VALUES(?, 'daily','draft',?,?,?, ?,?,?,?,?)").bind(id, title, `https://example.test/${id}`, "synthetic-rss", excerpt, day, now, now, eligible).run(); return id; };
  const disabled = await add("Radar disabled", "Synthetic source opted out of AI", 0);
  const noTerm = await add("Unmatched topic", "Synthetic content without configured trigger terms");
  const excluded = await add("Radar blocked", "radar blocked synthetic content");
  const failing = await add("Radar product", "radar synthetic workflow source has enough content to request analysis");
  const result = await analyzePending(env, { nowMs, fetchImpl: async () => new Response("PRIVATE_PROVIDER_DETAIL", { status: 403 }) });
  assert.equal(result.status, "failed");
  assert.deepEqual(result.skipped.map((x) => x.reason), ["source_not_ai_eligible", "no_include_term", "exclude_term"]);
  assert.equal(result.failures[0].code, "auth_or_config");
  assert.equal(JSON.stringify(result).includes("PRIVATE_PROVIDER_DETAIL"), false);
  const states = await env.DB.prepare("SELECT id,analysis_status,analysis_error_code,analysis_basis FROM items ORDER BY created_at").all();
  const byId = new Map(states.results.map((row) => [row.id, row]));
  assert.equal(byId.get(disabled).analysis_error_code, "source_not_ai_eligible");
  assert.equal(byId.get(noTerm).analysis_error_code, "no_include_term");
  assert.equal(byId.get(excluded).analysis_error_code, "exclude_term");
  assert.equal(byId.get(failing).analysis_error_code, "auth_or_config");
  assert.equal(byId.get(failing).analysis_basis, "from_excerpt");
});

test("shared analysis persists source type, content basis, provider and model across RSS, X and official adapters", async () => {
  const env = mkEnv({ AI_AUTO_ANALYZE_INCLUDE_TERMS: "radar", AI_AUTO_ANALYZE_EXCLUDE_TERMS: "", AI_AUTO_ANALYZE_LIMIT: "4", AI_MANUAL_RESERVE_GEMINI: "0", GEMINI_MODEL: "fixture-gemini" });
  const nowMs = Date.now(), day = new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10), now = new Date(nowMs).toISOString();
  const types = ["rss", "x_post", "github_search"];
  for (const sourceType of types) await env.DB.prepare("INSERT INTO items(id,kind,status,title,url,source,source_type,category,raw_excerpt,run_date,created_at,updated_at,ai_eligible) VALUES(?, 'daily','draft',?,?,?,?,?,?,?, ?,?,1)")
    .bind(crypto.randomUUID(), `Radar workflow ${sourceType}`, `https://example.test/${sourceType}`, sourceType, sourceType, sourceType === "x_post" ? "X_POST" : "AI_PRACTICE", "radar product workflow and implementation lesson for product teams. ".repeat(5), day, now, now).run();
  let calls = 0;
  const result = await analyzePending(env, { nowMs, fetchImpl: async () => { calls++; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(BI) }] } }] })); } });
  assert.equal(result.analyzed, 3); assert.equal(calls, 3);
  const rows = (await env.DB.prepare("SELECT source_type,analysis_source_type,analysis_basis,analysis_status,ai_provider,ai_model FROM items ORDER BY source_type").all()).results;
  assert.deepEqual(rows.map((row) => [row.source_type, row.analysis_source_type, row.analysis_basis, row.analysis_status, row.ai_provider, row.ai_model]), types.slice().sort().map((t) => [t, t, "from_excerpt", "completed", "gemini", "fixture-gemini"]));
});

test("source import preview maps CSV and never writes or calls AI", async () => {
  const env = mkEnv(); let calls = 0;
  const sourceCount = (await env.DB.prepare("SELECT COUNT(*) n FROM sources").first()).n;
  const csv = "Feed URL,Name\nhttps://example.test/feed.xml,Synthetic";
  const first = await handle(req("/api/source-imports/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: "csv", content: csv }) }), env, { authFetch, fetchImpl: async () => { calls++; } });
  assert.equal(first.status, 200); assert.equal((await first.json()).mapping_required, true);
  const preview = await handle(req("/api/source-imports/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: "csv", content: csv, mapping: { url: "Feed URL", title: "Name" } }) }), env, { authFetch, fetchImpl: async () => { calls++; } });
  const body = await preview.json(); assert.equal(body.preview[0].status, "new"); assert.equal(body.ai_calls, 0); assert.equal(calls, 0);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM sources").first()).n, sourceCount);
});

test("source import confirms recognized official adapters through the shared source registry", async () => {
  const env = mkEnv(); let calls = 0; const jobId = crypto.randomUUID();
  const sourceCount = (await env.DB.prepare("SELECT COUNT(*) n FROM sources").first()).n;
  const channel = "UCabcdefghijklmnopqrstuvwxyz123456";
  const content = ["https://example.test/g05-feed.xml", "@G05fixture", "owner/g05-repo", "https://github.com/owner/g05-repo/releases", channel,
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`, "github_search: AI product management", "https://github.com/owner/repo/issues",
    "https://x.com/example/status/123", "https://x.com/home", "https://twitter.com/search?q=ai"].join("\n");
  const preview = await handle(req("/api/source-imports/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: "text", content }) }), env, { authFetch, fetchImpl: async () => { calls++; } });
  const previewBody = await preview.json();
  assert.deepEqual(previewBody.preview.map((row) => [row.type, row.status]), [
    ["rss", "new"], ["x", "new"], ["github_releases", "new"], ["github_releases", "duplicate_in_batch"],
    ["youtube_channel", "new"], ["youtube_channel", "duplicate_in_batch"], ["github_search", "new"], [null, "needs_map"],
    [null, "needs_map"], [null, "needs_map"], [null, "needs_map"],
  ]);
  assert.equal(previewBody.ai_calls, 0); assert.equal(calls, 0);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM sources").first()).n, sourceCount);
  const created = await handle(req("/api/source-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: "text", content, confirm: true, job_id: jobId }) }), env, { authFetch });
  assert.equal(created.status, 201);
  const job = await created.json(); assert.equal(job.job.counts.pending, 5); assert.equal(job.job.counts.duplicate_in_batch, 2); assert.equal(job.job.counts.invalid, 4);
  const run = await handle(req(`/api/source-imports/${jobId}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), env, { authFetch });
  const runBody = await run.json(); assert.equal(runBody.job.counts.added, 5); assert.equal(runBody.ai_calls, 0);
  const sources = await env.DB.prepare("SELECT adapter_type,value FROM sources ORDER BY adapter_type").all();
  assert.deepEqual(sources.results.filter((row) => ["owner/g05-repo", "AI product management", "https://example.test/g05-feed.xml", "@G05fixture", channel].includes(row.value)).map((row) => ({ ...row })), [
    { adapter_type: "github_releases", value: "owner/g05-repo" },
    { adapter_type: "github_search", value: "AI product management" },
    { adapter_type: "rss", value: "https://example.test/g05-feed.xml" },
    { adapter_type: "x", value: "@G05fixture" },
    { adapter_type: "youtube_channel", value: channel },
  ]);
});

test("single source registration still accepts RSS, X, GitHub Search/Releases and YouTube channel contracts", async () => {
  const env = mkEnv();
  const sources = [
    ["rss", "https://example.test/g05-single-feed.xml"],
    ["x", "@G05single"],
    ["github_search", "AI product management"],
    ["github_releases", "owner/repository"],
    ["youtube_channel", "UCabcdefghijklmnopqrstuvwxyz123456"],
  ];
  for (const [type, value] of sources) {
    const response = await handle(req("/api/sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, value }) }), env, { authFetch });
    assert.equal(response.status, 201, `${type} registration`);
    const body = await response.json(); assert.equal(body.source.adapter_type, type); assert.equal(body.source.value, value);
  }
  const duplicate = await handle(req("/api/sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "github_releases", value: "owner/repository" }) }), env, { authFetch });
  assert.equal(duplicate.status, 409, "single and batch registrations share canonical duplicate identity");
});

test("source import is idempotent, partially resumable, cancellable, and has explicit retry states", async () => {
  const env = mkEnv(); const jobId = crypto.randomUUID();
  const content = Array.from({ length: 11 }, (_, i) => `https://example.test/feed-${i}.xml`).join("\n");
  const create = (confirm = true) => handle(req("/api/source-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: "text", content, confirm, job_id: jobId }) }), env, { authFetch });
  assert.equal((await create(false)).status, 400);
  const started = await create(); assert.equal(started.status, 201); assert.equal((await started.json()).ai_calls, 0);
  assert.equal((await create()).status, 200, "repeated confirmation with the same job id returns the same job");
  const run = () => handle(req(`/api/source-imports/${jobId}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), env, { authFetch });
  const first = await run().then((r) => r.json()); assert.equal(first.job.counts.added, 10); assert.equal(first.job.counts.pending, 1); assert.equal(first.ai_calls, 0);
  const cancelled = await handle(req(`/api/source-imports/${jobId}/cancel`, { method: "POST" }), env, { authFetch }).then((r) => r.json());
  assert.equal(cancelled.job.status, "cancelled"); assert.equal(cancelled.job.counts.added, 10);
  assert.equal((await run().then((r) => r.json())).job.counts.pending, 1, "cancel stops later rows without rolling back successful rows");
  const retry = await handle(req(`/api/source-imports/${jobId}/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ row_ids: [cancelled.job.rows.at(-1).id] }) }), env, { authFetch });
  assert.equal(retry.status, 409, "cancelled job is terminal");
});

test("invalid OPML rows stay invalid until corrected input passes revalidation, then resume import", async () => {
  const env = mkEnv(), jobId = crypto.randomUUID();
  const opml = `<opml><body><outline title="Synthetic invalid" xmlUrl="http://127.0.0.1/feed.xml"/></body></opml>`;
  const created = await handle(req("/api/source-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: "opml", content: opml, confirm: true, job_id: jobId }) }), env, { authFetch });
  const initial = await created.json(); assert.equal(initial.job.status, "completed"); assert.equal(initial.job.counts.invalid, 1);
  const row = initial.job.rows[0];
  const retry = await handle(req(`/api/source-imports/${jobId}/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ row_ids: [row.id] }) }), env, { authFetch });
  assert.equal(retry.status, 409, "invalid rows are not transient fetch failures");
  const invalidCorrection = await handle(req(`/api/source-imports/${jobId}/revalidate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: [{ id: row.id, type: "rss", value: "http://127.0.0.1/private" }] }) }), env, { authFetch });
  assert.equal(invalidCorrection.status, 200); assert.equal((await invalidCorrection.json()).job.rows[0].status, "invalid");
  const httpCorrection = await handle(req(`/api/source-imports/${jobId}/revalidate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: [{ id: row.id, type: "rss", value: "http://example.test/feed.xml" }] }) }), env, { authFetch });
  assert.equal((await httpCorrection.json()).job.rows[0].status, "invalid", "HTTP correction must not enter the import queue");
  const oversizedCorrection = await handle(req(`/api/source-imports/${jobId}/revalidate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: [{ id: row.id, type: "rss", value: `https://example.test/${"a".repeat(2050)}` }] }) }), env, { authFetch });
  assert.equal((await oversizedCorrection.json()).job.rows[0].status, "invalid", "oversized correction must not be truncated into a valid source");
  const corrected = await handle(req(`/api/source-imports/${jobId}/revalidate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: [{ id: row.id, type: "rss", value: "https://example.test/synthetic-feed.xml", label: "Corrected synthetic feed" }] }) }), env, { authFetch });
  const correctedBody = await corrected.json(); assert.equal(correctedBody.job.status, "queued"); assert.equal(correctedBody.job.counts.pending, 1); assert.equal(correctedBody.ai_calls, 0);
  const run = await handle(req(`/api/source-imports/${jobId}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), env, { authFetch });
  const completed = await run.json(); assert.equal(completed.job.status, "completed"); assert.equal(completed.job.counts.added, 1);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM sources WHERE value=?").bind("https://example.test/synthetic-feed.xml").first()).n, 1);
  const replay = await handle(req(`/api/source-imports/${jobId}/revalidate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: [{ id: row.id, type: "rss", value: "https://example.test/changed.xml" }] }) }), env, { authFetch });
  assert.equal(replay.status, 409, "completed rows cannot be rewritten by revalidation");
});

test("source import resumes remaining rows and retries only selected transient failures", async () => {
  const env = mkEnv(), now = new Date().toISOString();
  const addJob = async (content) => {
    const id = crypto.randomUUID();
    const response = await handle(req("/api/source-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: "text", content, confirm: true, job_id: id }) }), env, { authFetch });
    return { id, body: await response.json() };
  };
  const longJob = await addJob(Array.from({ length: 11 }, (_, i) => `https://resume.example/${i}.xml`).join("\n"));
  const run = (id) => handle(req(`/api/source-imports/${id}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), env, { authFetch });
  assert.equal((await run(longJob.id).then((r) => r.json())).job.status, "partial");
  const resumed = await run(longJob.id).then((r) => r.json()); assert.equal(resumed.job.status, "completed"); assert.equal(resumed.job.counts.added, 11);

  const retryJob = await addJob("https://retry.example/feed.xml");
  const rowId = retryJob.body.job.rows[0].id;
  await env.DB.prepare("UPDATE source_import_rows SET status='failed',error_code='storage_error' WHERE id=?").bind(rowId).run();
  await env.DB.prepare("UPDATE source_import_jobs SET status='partial' WHERE id=?").bind(retryJob.id).run();
  const retry = await handle(req(`/api/source-imports/${retryJob.id}/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ row_ids: [rowId] }) }), env, { authFetch }).then((r) => r.json());
  assert.equal(retry.retried, 1); assert.equal(retry.job.counts.pending, 1);
  assert.equal((await run(retryJob.id).then((r) => r.json())).job.counts.added, 1);
});

test("source import cancellation wins a race against a not-yet-started run", async () => {
  const env = mkEnv(), jobId = crypto.randomUUID();
  await handle(req("/api/source-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: "text", content: "https://race.example/feed.xml", confirm: true, job_id: jobId }) }), env, { authFetch });
  const originalPrepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    const statement = originalPrepare(sql);
    if (!sql.startsWith("UPDATE source_import_jobs SET status='running'")) return statement;
    return { bind(...args) { const bound = statement.bind(...args); return { async run() {
      await handle(req(`/api/source-imports/${jobId}/cancel`, { method: "POST" }), env, { authFetch });
      return bound.run();
    } }; } };
  };
  const result = await handle(req(`/api/source-imports/${jobId}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), env, { authFetch }).then((r) => r.json());
  assert.equal(result.job.status, "cancelled"); assert.equal(result.job.counts.pending, 1);
  assert.equal((await originalPrepare("SELECT COUNT(*) n FROM sources WHERE value='https://race.example/feed.xml'").first()).n, 0);
});

test("batch AI summary requires an explicit bounded budget and leaves output in draft review state", async () => {
  const env = mkEnv(); const now = new Date().toISOString(); const ids = [crypto.randomUUID(), crypto.randomUUID()]; let calls = 0;
  for (const [index, id] of ids.entries()) await env.DB.prepare("INSERT INTO items(id,kind,status,title,url,source_type,raw_excerpt,created_at,updated_at) VALUES(?, 'daily','draft',?,?, 'manual_text',?,?,?)")
    .bind(id, `Synthetic item ${index}`, `https://example.test/${index}`, LONG_TEXT, now, now).run();
  const request = (payload) => handle(req("/api/items/batch-summarize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }), env,
    { authFetch, fetchImpl: async (url) => { calls++; return gemOk(AI)(url); } });
  const denied = await request({ ids, confirm: true }); assert.equal(denied.status, 400); assert.equal(calls, 0);
  const result = await request({ ids, confirm: true, budget: { max_items: 2, max_calls: 1 } }); const body = await result.json();
  assert.equal(result.status, 200); assert.equal(body.model_calls, 1); assert.equal(body.budget_exhausted, true); assert.deepEqual(body.remaining_ids, [ids[1]]); assert.equal(calls, 1);
  const rows = (await env.DB.prepare("SELECT id,status,ai_provider,analysis_status FROM items WHERE id IN (?,?) ORDER BY id").bind(...ids).all()).results;
  assert.equal(rows.filter((row) => row.ai_provider === "gemini").length, 1);
  assert.ok(rows.every((row) => row.status === "draft"));
  assert.ok(rows.filter((row) => row.ai_provider === "gemini").every((row) => row.analysis_status === "completed"));
});
import { decodeEntities } from "../cloud/src/collector.mjs";
test("collector decodes HTML entities in titles", () => {
  assert.equal(decodeEntities("Intel&#8217;s &amp; &#x2014; &rsquo;x&rsquo; &bogus;"), "Intel’s & — ’x’ &bogus;");
  assert.equal(parseFeed(`<rss><channel><item><title>Intel&amp;#8217;s stock</title><link>https://e.t/1</link></item></channel></rss>`, { id: "x", category: "C" })[0].title, "Intel’s stock");
});
