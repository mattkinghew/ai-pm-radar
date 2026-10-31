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
