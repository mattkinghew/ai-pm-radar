import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../cloud/src/worker.mjs";
import { runDaily } from "../cloud/src/collector.mjs";
import { normalizeUrl, simhash, hamming, dedup, applyQuotas, isMuted, kbMarkdown } from "../cloud/src/curation.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";
const kit = accessKit();
const authFetch = async () => new Response(kit.jwks, { headers: { "content-type": "application/json" } });
const TOKEN = "t".repeat(40);
const mkEnv = () => ({ DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash, GEMINI_API_KEY: "k", AI_DAILY_CAP: "10", INGEST_TOKEN: TOKEN, AI_ANALYSIS_ENABLED: "false" });
const J = { "content-type": "application/json" };
const owner = (p, o = {}) => new Request("https://r.x" + p, { ...o, headers: { "Cf-Access-Jwt-Assertion": kit.token(), ...(o.headers || {}) } });
const call = (env, p, o) => handle(owner(p, o), env, { authFetch });
const post = (env, p, b) => call(env, p, { method: "POST", headers: J, body: JSON.stringify(b) });

test("normalizeUrl strips tracking, www, trailing slash, twitter->x", () => {
  assert.equal(normalizeUrl("https://www.Example.com/a/?utm_source=x&b=2&fbclid=1#h"), "example.com/a?b=2");
  assert.equal(normalizeUrl("https://twitter.com/sama/status/1/"), normalizeUrl("https://x.com/sama/status/1"));
  assert.equal(normalizeUrl("not a url"), null);
});

test("simhash: near-duplicate titles close, different titles far; CJK works", () => {
  const a = simhash("OpenAI launches GPT-6 with new agent features"), b = simhash("OpenAI launches GPT-6 with new agent features!"), c = simhash("Google releases Gemini 4 pricing for developers");
  assert.ok(hamming(a, b) <= 3); assert.ok(hamming(a, c) > 10);
  assert.ok(hamming(simhash("用AI做副業每月多賺一萬元的方法"), simhash("用AI做副業每月多賺一萬元的方法！")) <= 3);
});

test("dedup + quotas: X <= 30%, per-handle <= 2, mutes", () => {
  const news = Array.from({ length: 7 }, (_, i) => ({ id: "n" + i, title: ["Anthropic raises funding round","Nvidia earnings beat estimates","Meta open sources Llama model","Apple adds AI to Siri","Mistral launches coding agent","EU passes AI Act update","Coursera free prompt course"][i], url: `https://n.com/${i}`, source: "rss", category: "AI_TECH_NEWS" }));
  const xs = Array.from({ length: 10 }, (_, i) => ({ id: "x" + i, title: ["alpha bravo charlie","delta echo foxtrot","golf hotel india","juliet kilo lima","mike november oscar","papa quebec romeo","sierra tango uniform","victor whiskey xray","yankee zulu one","two three four five"][i], url: `https://x.com/h${i % 2}/status/${i}`, source: `x:@h${i % 2}`, category: "X_POST" }));
  const dup = { ...news[0], id: "d", url: "https://www.n.com/0/?utm_source=t" };
  const d = dedup([news[0], dup, ...news.slice(1), ...xs]); assert.equal(d.length, 17); assert.equal(d[0].dup_count, 1); assert.deepEqual(d[0].dup_sources, [{ source: "rss", url: "https://www.n.com/0/?utm_source=t", title: dup.title }]);
  const q = applyQuotas(d); const nx = q.items.filter((i) => i.source.startsWith("x:")).length;
  assert.equal(nx, 3); assert.ok(nx / q.items.length <= 0.3 + 1e-9);
  const q2 = applyQuotas([...news, ...news.map((n) => ({ ...n, id: n.id + "b" })), ...xs]); // 14 non-X -> xCap 6 but 2 handles x 2 = 4
  assert.equal(q2.items.filter((i) => i.source.startsWith("x:")).length, 4);
  assert.ok(isMuted({ source: "x:@H0" }, [{ kind: "handle", value: "@h0" }]));
  assert.ok(isMuted({ title: "Crypto pump" }, [{ kind: "keyword", value: "crypto" }]));
  assert.ok(isMuted({ category: "X_POST" }, [{ kind: "topic", value: "x_post" }]));
});

test("kbMarkdown has valid frontmatter", () => {
  const md = kbMarkdown({ id: "abc", title: 'A "quoted": title', url: "https://a.b", source: "rss", category: "AI", score: 7, origin: "star", key_points: ["k1"], tags: ["t"], created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" });
  assert.match(md, /^---\nradar_id: "abc"\ntitle: "A \\"quoted\\": title"/u); assert.match(md, /tags: \["radar", "t"\]/u); assert.match(md, /- k1/u);
});

test("API: actions, feedback weights, mutes, curated daily, KB export", async () => {
  const env = mkEnv();
  const feed = (u) => String(u).includes("algolia") ? new Response(JSON.stringify({ hits: [] })) : String(u).includes("openai.com") ? new Response(`<rss><channel><item><title>OpenAI ships a big new model today</title><link>https://openai.com/a?utm_source=rss</link></item><item><title>Second</title><link>https://openai.com/b</link></item></channel></rss>`)
    : String(u).includes("theverge") ? new Response(`<rss><channel><item><title>Same story</title><link>https://www.openai.com/a/</link></item></channel></rss>`) : new Response("x", { status: 404 });
  const run = await runDaily(env, { fetchImpl: feed }); assert.equal(run.collected, 2); // verge copy deduped by url_norm
  const posts = Array.from({ length: 6 }, (_, i) => ({ handle: "spam", post_id: String(1000 + i), text: `spam post ${i} unique ${i * 31}` }));
  await handle(new Request("https://r.x/api/ingest/x", { method: "POST", headers: { ...J, authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ posts }) }), env);
  let d = await (await call(env, "/api/daily")).json();
  assert.equal(d.mode, "curated"); assert.equal(d.items.filter((i) => i.source === "x:@spam").length, 2); assert.ok(d.stats.quota_held >= 4);
  assert.equal((await (await call(env, "/api/daily?all=1")).json()).items.length, 8);
  const [a, b] = d.items.filter((i) => i.source === "openai");
  assert.equal((await post(env, `/api/items/${a.id}/action`, { action: "not_interested" })).status, 400);
  assert.equal((await post(env, `/api/items/${a.id}/action`, { action: "not_interested", reason: "low_quality" })).status, 200);
  assert.equal((await post(env, `/api/items/${b.id}/action`, { action: "star" })).status, 200);
  assert.equal((await post(env, `/api/items/${b.id}/action`, { action: "read_later" })).status, 200);
  assert.equal((await (await call(env, "/api/read-later")).json()).items.length, 1);
  const w = env.DB.raw.prepare("SELECT weight FROM feedback_weights WHERE key='openai'").get(); assert.ok(Math.abs(w.weight - 0.3) < 1e-9); // -0.5 +0.6 +0.2
  assert.equal((await post(env, "/api/mutes", { kind: "handle", value: "spam" })).status, 201);
  assert.equal((await post(env, "/api/mutes", { kind: "handle", value: "@spam" })).status, 409);
  assert.equal((await post(env, "/api/mutes", { kind: "bogus", value: "x" })).status, 400);
  d = await (await call(env, "/api/daily")).json();
  assert.equal(d.items.length, 1); assert.equal(d.items[0].id, b.id); assert.equal(d.items[0].starred, 1);
  const kb = await (await call(env, "/api/kb")).json(); assert.equal(kb.entries.length, 1); assert.equal(kb.entries[0].origin, "star");
  const pt = await call(env, `/api/kb/${kb.entries[0].id}`, { method: "PATCH", headers: J, body: JSON.stringify({ note: "my note", tags: ["agent"] }) }); assert.equal(pt.status, 200);
  const ex = await (await call(env, "/api/kb/export?format=json")).json(); assert.equal(ex.count, 1); assert.match(ex.files[0].path, /\.md$/u); assert.match(ex.files[0].content, /## 筆記\nmy note/u);
  const md = await call(env, "/api/kb/export"); assert.match(md.headers.get("content-type"), /markdown/u); assert.match(await md.text(), /^---/u);
  assert.equal((await call(env, "/api/kb/export?since=bad")).status, 400);
  await post(env, `/api/items/${b.id}/action`, { action: "unstar" }); assert.equal((await (await call(env, "/api/kb")).json()).entries.length, 0);
  // approve path also feeds KB
  await post(env, `/api/items/${b.id}/review`, {}); await post(env, `/api/items/${b.id}/approve`, {});
  assert.equal((await (await call(env, "/api/kb")).json()).entries[0].origin, "approved");
  // bearer token still cannot reach new routes
  assert.equal((await handle(new Request("https://r.x/api/kb/export", { headers: { authorization: `Bearer ${TOKEN}` } }), env)).status, 401);
});

test("UI: ⋯ menu is accessible (aria, Esc, outside click) and dup sources listed", async () => {
  const { readFileSync } = await import("node:fs");
  const js = readFileSync(new URL("../cloud/public/app.js", import.meta.url), "utf8");
  for (const s of ['aria-haspopup="menu"', 'aria-expanded', 'role="menuitem"', '"Escape"', 'closest(".more")', "dup_sources", "<details"]) assert.ok(js.includes(s), s);
  assert.ok(!js.includes("個來源報道同一件事"));
});
