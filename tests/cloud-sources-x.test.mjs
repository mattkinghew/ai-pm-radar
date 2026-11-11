import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../cloud/src/worker.mjs";
import { runDaily } from "../cloud/src/collector.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";
const kit = accessKit();
const authFetch = async () => new Response(kit.jwks, { headers: { "content-type": "application/json" } });
const TOKEN = "t".repeat(40);
const LONG_TEXT = "A practical low cost workflow for a solopreneur using AI tools, React, and clear pricing. ".repeat(6);
const mkEnv = (o = {}) => ({ DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash, GEMINI_API_KEY: "k", AI_DAILY_CAP: "10", INGEST_TOKEN: TOKEN, ...o });
const J = { "content-type": "application/json" };
const owner = (p, o = {}) => new Request("https://r.x" + p, { ...o, headers: { "Cf-Access-Jwt-Assertion": kit.token(), ...(o.headers || {}) } });
const bot = (p, o = {}, tok = TOKEN) => new Request("https://r.x" + p, { ...o, headers: { authorization: `Bearer ${tok}`, ...(o.headers || {}) } });
const RECO = { title_zh: "標題", summary: "摘要", key_points_zh: ["a"], score: 6, reco_score: 9, reco_reason: "可用於顧問提案" };
const gem = async (u) => String(u).includes("generativelanguage") ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(RECO) }] } }] }))
  : String(u).includes("algolia") ? new Response(JSON.stringify({ hits: [] })) : String(u).includes("my.feed") ? new Response(`<rss><channel><item><title>React workflow for solopreneur</title><link>https://my.feed/1</link><description>${LONG_TEXT}</description></item></channel></rss>`) : new Response("x", { status: 404 });

test("sources CRUD (owner), validation, dedupe", async () => {
  const env = mkEnv(); const d = { authFetch };
  const add = (b) => handle(owner("/api/sources", { method: "POST", headers: J, body: JSON.stringify(b) }), env, d);
  const r = await add({ type: "x", value: "openai", label: "OpenAI" }); assert.equal(r.status, 201); const { source } = await r.json(); assert.equal(source.value, "@openai");
  assert.equal((await add({ type: "x", value: "@openai" })).status, 409);
  assert.equal((await add({ type: "rss", value: "http://insecure" })).status, 400);
  assert.equal((await add({ type: "x", value: "bad handle!" })).status, 400);
  const p = await handle(owner(`/api/sources/${source.id}`, { method: "PATCH", headers: J, body: JSON.stringify({ enabled: false }) }), env, d); assert.equal((await p.json()).source.enabled, 0);
  assert.equal((await handle(owner(`/api/sources/${source.id}`, { method: "DELETE" }), env, d)).status, 200);
  assert.equal((await (await handle(owner("/api/sources"), env, d)).json()).sources.length, 8); // enabled seeded watchlist only
  assert.equal((await (await handle(owner("/api/sources?include_disabled=1"), env, d)).json()).sources.length, 11); // disabled accounts remain reversible
});

test("bearer: only ingest + read sources; wrong/short token or missing secret -> 401", async () => {
  const env = mkEnv();
  assert.equal((await handle(bot("/api/sources?type=x"), env)).status, 200);
  assert.equal((await handle(bot("/api/library"), env)).status, 401);
  assert.equal((await handle(bot("/api/sources", { method: "POST", headers: J, body: "{}" }), env)).status, 401);
  assert.equal((await handle(bot("/api/sources?type=x", {}, "wrong".repeat(10)), env)).status, 401);
  assert.equal((await handle(bot("/api/sources?type=x"), mkEnv({ INGEST_TOKEN: undefined }))).status, 401);
  assert.equal((await handle(bot("/api/sources?type=x"), mkEnv({ INGEST_TOKEN: "short" }), {}, "short")).status, 401);
});

test("X ingest dedups by post_id, rejects bad rows, cron analyzes with reco", async () => {
  const env = mkEnv();
  const stamp = new Date().toISOString();
  await env.DB.prepare("INSERT INTO sources(id,type,value,label,enabled,created_at,updated_at) VALUES('test-sama','x','@sama',NULL,1,?,?)").bind(stamp, stamp).run();
  const posts = [{ handle: "@sama", post_id: "1900000000000000001", text: `React workflow for solopreneurs. ${LONG_TEXT}`, url: "https://x.com/sama/status/1900000000000000001", created_at: "2026-10-31T10:00:00Z", metrics: { likes: 5 } },
    { handle: "sama", post_id: "1900000000000000001", text: "dup" }, { handle: "bad handle", post_id: "1", text: "x" }, { handle: "a", post_id: "abc", text: "x" }];
  const r = await (await handle(bot("/api/ingest/x", { method: "POST", headers: J, body: JSON.stringify({ posts }) }), env)).json();
  assert.deepEqual([r.inserted, r.duplicate, r.rejected], [1, 1, [2, 3]]);
  await handle(owner("/api/sources", { method: "POST", headers: J, body: JSON.stringify({ type: "rss", value: "https://my.feed/rss", label: "mine" }) }), env, { authFetch });
  const run = await runDaily(env, { fetchImpl: gem }); assert.equal(run.collected, 1); assert.equal(run.analyzed, 0); // user sources default ai_eligible=0
  const d = await (await handle(owner("/api/daily"), env, { authFetch })).json();
  const x = d.items.find((i) => i.source === "x:@sama"); assert.equal(x.reco_score, null); assert.deepEqual(x.metrics, { likes: 5 });
  assert.ok(d.items.some((i) => i.source === "user:mine"));
});

test("seeded X watchlist readable by bearer; side_income_new flag stored", async () => {
  const env = mkEnv();
  const xs = (await (await handle(bot("/api/sources?type=x"), env)).json()).sources.map((x) => x.value.toLowerCase());
  for (const h of ["@miles_mazy", "@haoge6699", "@mileson07", "@laobaishare", "@0xluffy_eth", "@dontbesilent", "@chrishkai", "@zhouluobo"]) assert.ok(xs.includes(h), h);
  for (const h of ["@wangdaso", "@goan999999", "@ai_dvd6"]) assert.ok(!xs.includes(h), h);
  const ownerAll = await (await handle(owner("/api/sources?include_disabled=1"), env, { authFetch })).json(); assert.equal(ownerAll.sources.length, 11);
  const gemSI = async (u) => String(u).includes("generativelanguage") ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...RECO, side_income_new: true, side_income_reason: "AI 短劇二創接單，成本低" }) }] } }] })) : new Response("x", { status: 404 });
  const r = await handle(owner("/api/capture", { method: "POST", headers: J, body: JSON.stringify({ text: LONG_TEXT }) }), env, { authFetch, fetchImpl: gemSI });
  const { id } = await r.json(); await handle(owner(`/api/items/${id}/deep-read`, { method: "POST" }), env, { authFetch, fetchImpl: gemSI }); const it = (await (await handle(owner(`/api/items/${id}`), env, { authFetch })).json()).item;
  assert.equal(it.side_income_new, 1); assert.equal(it.side_income_reason, "AI 短劇二創接單，成本低");
  const r2 = await handle(owner("/api/capture", { method: "POST", headers: J, body: JSON.stringify({ text: LONG_TEXT + " Additional implementation details." }) }), env, { authFetch, fetchImpl: gem });
  const id2=(await r2.json()).id; await handle(owner(`/api/items/${id2}/deep-read`, { method: "POST" }), env, { authFetch, fetchImpl: gem }); const it2 = (await (await handle(owner(`/api/items/${id2}`), env, { authFetch })).json()).item;
  assert.equal(it2.side_income_new, 0); assert.equal(it2.side_income_reason, null);
});

test("X ingest skips disabled handles and still accepts enabled handles", async () => {
  const env = mkEnv();
  const posts = [
    { handle: "Wangdaso", post_id: "2000000000000000001", text: "disabled source post" },
    { handle: "miles_mazy", post_id: "2000000000000000002", text: "enabled source post" },
  ];
  const r = await (await handle(bot("/api/ingest/x", { method: "POST", headers: J, body: JSON.stringify({ posts }) }), env)).json();
  assert.equal(r.inserted, 1); assert.equal(r.duplicate, 0); assert.equal(r.skipped_disabled, 1); assert.deepEqual(r.disabled_handles.map((x) => x.handle), ["@Wangdaso"]);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM items WHERE external_id LIKE 'x:%'").first()).n, 1);
});


test("review/approve bumps feedback weight; reject lowers; list orders by score+weight", async () => {
  const env = mkEnv();
  const gem = async (u) => String(u).includes("generativelanguage")
    ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...RECO, score: 9, score_reason: "可轉化為顧問案例", summary: "摘要內容夠長", key_points_zh: ["a","b","c"] }) }] } }] }))
    : new Response("x", { status: 404 });
  const r = await handle(owner("/api/capture", { method: "POST", headers: J, body: JSON.stringify({ text: LONG_TEXT }) }), env, { authFetch, fetchImpl: gem });
  const { id } = await r.json(); await handle(owner(`/api/items/${id}/deep-read`, { method: "POST" }), env, { authFetch, fetchImpl: gem });
  const it0 = (await (await handle(owner(`/api/items/${id}`), env, { authFetch })).json()).item;
  assert.equal(it0.score, 9); assert.equal(it0.score_reason, "可轉化為顧問案例");
  assert.equal((await handle(owner(`/api/items/${id}/review`, { method: "POST" }), env, { authFetch })).status, 200);
  assert.equal((await handle(owner(`/api/items/${id}/approve`, { method: "POST" }), env, { authFetch })).status, 200);
  const w = await env.DB.prepare("SELECT weight,pos,neg FROM feedback_weights WHERE key=?").bind("quick-capture").first();
  assert.ok(w.weight >= 0.5); assert.equal(w.pos, 2); assert.equal(w.neg, 0);
  const r2 = await handle(owner("/api/capture", { method: "POST", headers: J, body: JSON.stringify({ text: LONG_TEXT + " Different implementation example." }) }), env, { authFetch, fetchImpl: gem });
  const id2 = (await r2.json()).id;
  assert.equal((await handle(owner(`/api/items/${id2}/reject`, { method: "POST" }), env, { authFetch })).status, 200);
  const w2 = await env.DB.prepare("SELECT weight,neg FROM feedback_weights WHERE key=?").bind("quick-capture").first();
  assert.ok(w2.weight < w.weight); assert.equal(w2.neg, 1);
});
