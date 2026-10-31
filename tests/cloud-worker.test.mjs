import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../cloud/src/worker.mjs";
import { runDaily, parseFeed } from "../cloud/src/collector.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";

const kit = accessKit();
const authFetch = async () => new Response(kit.jwks, { headers: { "content-type": "application/json" } });
const gemOk = (payload) => async (u) => String(u).includes("generativelanguage") ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })) : new Response("<p>" + "內容".repeat(100) + "</p>");
function mkEnv(over = {}) {
  return { DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash, GEMINI_API_KEY: "test-key", AI_DAILY_CAP: "10", ...over };
}
const req = (path, { token = kit.token(), ...o } = {}) => new Request("https://radar.example" + path, { ...o, headers: { ...(token ? { "Cf-Access-Jwt-Assertion": token } : {}), ...(o.headers || {}) } });
const AI = { title: "T", summary: "摘要", key_points: ["a", "b", "c"], score: 8 };

test("deny by default: no JWT, bad aud, wrong owner, unconfigured", async () => {
  const env = mkEnv();
  assert.equal((await handle(req("/api/library", { token: null }), env, { authFetch })).status, 401);
  assert.equal((await handle(req("/api/library", { token: kit.token({ aud: ["other"] }) }), env, { authFetch })).status, 401);
  assert.equal((await handle(req("/api/library", { token: kit.token({ email: "x@evil.test" }) }), env, { authFetch })).status, 401);
  assert.equal((await handle(req("/"), mkEnv({ CLOUD_ACCESS_REQUIRED: "false" }), { authFetch })).status, 401);
  assert.equal((await handle(req("/api/cloud/capabilities"), env, { authFetch })).status, 200);
});

test("capture -> draft -> review -> approve; approve before review rejected", async () => {
  const env = mkEnv(); const d = { authFetch, fetchImpl: gemOk(AI) };
  const r = await handle(req("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "長文".repeat(60) }) }), env, d);
  assert.equal(r.status, 201); const { id, status } = await r.json(); assert.equal(status, "draft");
  assert.equal((await handle(req(`/api/library?status=approved`), env, d).then((x) => x.json())).items.length, 0);
  assert.equal((await handle(req(`/api/items/${id}/approve`, { method: "POST" }), env, d)).status, 409);
  assert.equal((await handle(req(`/api/items/${id}/review`, { method: "POST" }), env, d)).status, 200);
  assert.equal((await handle(req(`/api/items/${id}/approve`, { method: "POST" }), env, d)).status, 200);
  const lib = await handle(req(`/api/library`), env, d).then((x) => x.json());
  assert.deepEqual(lib.items[0].key_points, ["a", "b", "c"]);
});

test("capture rejects thin content without calling AI", async () => {
  let called = false; const env = mkEnv();
  const r = await handle(req("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "short" }) }), env, { authFetch, fetchImpl: async () => { called = true; } });
  assert.equal(r.status, 422); assert.equal(called, false);
});

test("fallback to Workers AI on Gemini 429 only when enabled; not on 403", async () => {
  const fail = (s) => async () => new Response("x", { status: s });
  const ai = { run: async () => ({ response: JSON.stringify(AI) }) };
  const body = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "內容".repeat(60) }) };
  const r1 = await handle(req("/api/capture", body), mkEnv({ AI: ai, AI_FALLBACK_PROVIDER: "workers-ai" }), { authFetch, fetchImpl: fail(429) });
  assert.equal(r1.status, 201); assert.equal((await r1.json()).provider, "workers-ai");
  const r2 = await handle(req("/api/capture", body), mkEnv({ AI: ai, AI_FALLBACK_PROVIDER: "workers-ai" }), { authFetch, fetchImpl: fail(403) });
  assert.equal(r2.status, 502);
});

const RSS = `<?xml version="1.0"?><rss><channel>${Array.from({ length: 8 }, (_, i) => `<item><title>News ${i}</title><link>https://ex.test/${i}</link><description>d${i}</description></item>`).join("")}</channel></rss>`;
test("cron runDaily collects feeds, dedupes, and respects daily AI cap", async () => {
  const env = mkEnv({ AI_DAILY_CAP: "3" });
  const f = async (u) => String(u).includes("generativelanguage") ? gemOk(AI)(u) : String(u).includes("algolia") ? new Response(JSON.stringify({ hits: [] })) : new Response(RSS);
  const r = await runDaily(env, { fetchImpl: f });
  assert.equal(r.collected, 5); assert.equal(r.analyzed, 3); assert.equal(r.error, "cap_reached");
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
const capBody = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "內容".repeat(60) }) };

test("bilingual output stored and returned", async () => {
  const env = mkEnv(); const d = { authFetch, fetchImpl: gemOk(BI) };
  const r = await handle(req("/api/capture", capBody), env, d); assert.equal(r.status, 201);
  const { id } = await r.json();
  const it = (await handle(req(`/api/items/${id}`), env, d).then((x) => x.json())).item;
  assert.equal(it.title_zh, "OpenAI 推出 X"); assert.equal(it.title_original, "OpenAI ships X");
  assert.deepEqual(it.key_points, ["甲", "乙", "丙"]); assert.deepEqual(it.key_points_en, ["a", "b", "c"]); assert.equal(it.summary_en, "English summary");
});

test("Gemini cap reached -> Workers AI overflow under its own cap; usage per provider", async () => {
  const calls = { n: 0 }; const env = mkEnv({ AI_DAILY_CAP: "1", WORKERS_AI_DAILY_CAP: "2", AI_FALLBACK_PROVIDER: "workers-ai", AI: wai(calls), WORKERS_AI_MODEL: "@cf/qwen/qwen3-30b-a3b-fp8" });
  const d = { authFetch, fetchImpl: gemOk(BI) }; const prov = [];
  for (let i = 0; i < 4; i++) { const r = await handle(req("/api/capture", capBody), env, d); prov.push(r.status === 201 ? (await r.json()).provider : r.status); }
  assert.deepEqual(prov, ["gemini", "workers-ai", "workers-ai", 429]); assert.equal(calls.model, "@cf/qwen/qwen3-30b-a3b-fp8");
  const c = await handle(req("/api/cloud/capabilities"), env, d).then((x) => x.json());
  assert.deepEqual([c.ai.usage.gemini.used, c.ai.usage.gemini.cap, c.ai.usage.workersAi.used, c.ai.usage.workersAi.cap], [1, 1, 2, 2]);
});

test("Gemini 5xx falls back; 403 does not; fallback disabled means no Workers AI", async () => {
  const fail = (s) => async () => new Response("x", { status: s });
  const on = { AI: wai(), AI_FALLBACK_PROVIDER: "workers-ai" };
  assert.equal((await (await handle(req("/api/capture", capBody), mkEnv(on), { authFetch, fetchImpl: fail(503) })).json()).provider, "workers-ai");
  assert.equal((await handle(req("/api/capture", capBody), mkEnv(on), { authFetch, fetchImpl: fail(403) })).status, 502);
  const off = { calls: 0 }; const env = mkEnv({ AI_DAILY_CAP: "0", AI: { run: async () => { off.calls++; } } });
  assert.equal((await handle(req("/api/capture", capBody), env, { authFetch, fetchImpl: gemOk(BI) })).status, 429); assert.equal(off.calls, 0);
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
test("轉中文: Gemini bad output / insufficient -> Workers AI once; friendly codes", async () => {
  const gem = (t) => async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }));
  const on = { AI: wai(), AI_FALLBACK_PROVIDER: "workers-ai" };
  for (const t of ["not json", '{"error":"insufficient_content"}']) {
    const r = await handle(req("/api/capture", capBody), mkEnv(on), { authFetch, fetchImpl: gem(t) });
    assert.equal(r.status, 201); assert.equal((await r.json()).provider, "workers-ai");
  }
  const bad = { AI: { run: async () => ({ response: '{"error":"insufficient_content"}' }) }, AI_FALLBACK_PROVIDER: "workers-ai" };
  const r = await handle(req("/api/capture", capBody), mkEnv(bad), { authFetch, fetchImpl: gem('{"error":"insufficient_content"}') });
  assert.equal(r.status, 422); assert.equal((await r.json()).error, "insufficient_content");
  const boom = { AI: { run: async () => { throw new Error("3040: capacity"); } }, AI_FALLBACK_PROVIDER: "workers-ai" };
  const r2 = await handle(req("/api/capture", capBody), mkEnv(boom), { authFetch, fetchImpl: gem("nope") });
  assert.equal(r2.status, 502); assert.equal((await r2.json()).error, "workers_ai_error");
});
import { decodeEntities } from "../cloud/src/collector.mjs";
test("collector decodes HTML entities in titles", () => {
  assert.equal(decodeEntities("Intel&#8217;s &amp; &#x2014; &rsquo;x&rsquo; &bogus;"), "Intel’s & — ’x’ &bogus;");
  assert.equal(parseFeed(`<rss><channel><item><title>Intel&amp;#8217;s stock</title><link>https://e.t/1</link></item></channel></rss>`, { id: "x", category: "C" })[0].title, "Intel’s stock");
});
