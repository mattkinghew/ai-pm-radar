import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handle } from "../cloud/src/worker.mjs";
import { fakeD1, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";

const request = (path, method = "GET") => new Request(`https://radar.example${path}`, { method });
const makeEnv = () => ({ DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash });
async function add(env, id, item = {}, kb = {}) {
  const now = "2026-11-26T00:00:00.000Z";
  const row = { id, kind: "daily", status: "approved", title: `Public ${id}`, url: `https://example.test/${id}`, source: "Synthetic newsroom", source_type: "rss", category: "AI", lane: "TECH_NEWS", summary: "Public summary", key_points: '["Public point"]', score: 8, curation_status: "main", injection_suspect: 0, published_at: now, created_at: now, updated_at: now, ...item };
  const keys = Object.keys(row);
  await env.DB.prepare(`INSERT INTO items(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`).bind(...Object.values(row)).run();
  if (kb === null) return;
  const entry = { id: `kb-${id}`, item_id: id, title: `Private KB title ${id}`, origin: "approved", kb_type: "item", note: "PRIVATE_NOTE", summary: "PRIVATE_KB_SUMMARY", tags: '["AI PM"]', created_at: now, updated_at: now, ...kb };
  await env.DB.prepare(`INSERT INTO kb_entries(${Object.keys(entry).join(",")}) VALUES(${Object.keys(entry).map(() => "?").join(",")})`).bind(...Object.values(entry)).run();
}

test("G04 public GET bypasses Access and exposes only public fields and public-only telemetry", async () => {
  const env = makeEnv(); await add(env, "approved");
  await env.DB.prepare("INSERT INTO runs(id,error) VALUES('private-run','PRIVATE_RUN_ERROR')").run();
  const response = await handle(request("/api/public/showcase"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=300");
  const body = await response.json();
  assert.equal(body.items.length, 1);
  assert.deepEqual(Object.keys(body.items[0]).sort(), ["title", "url", "source", "lane", "category", "summary", "key_points", "tags", "score", "published_at"].sort());
  assert.deepEqual(body.items[0].key_points, ["Public point"]);
  assert.deepEqual(body.items[0].tags, ["AI PM"]);
  assert.deepEqual(body.stats, { approved_items: 1, sources: 1, lanes: 1, latest_published_at: "2026-11-26T00:00:00.000Z" });
  const serialized = JSON.stringify(body);
  for (const value of ["PRIVATE_NOTE", "PRIVATE_KB_SUMMARY", "PRIVATE_RUN_ERROR", "OWNER_EMAIL_SHA256", ownerHash, "raw_excerpt", "ai_provider"]) assert.ok(!serialized.includes(value), value);
});

test("G04 excludes manual KB, notes, synthesis, unapproved, quarantined and private captures", async () => {
  const env = makeEnv();
  await add(env, "public"); await add(env, "released", { curation_status: "released" });
  for (const status of ["draft", "reviewed", "rejected"]) await add(env, status, { status });
  await add(env, "manual", {}, { origin: "manual" });
  await add(env, "note", {}, { kb_type: "note" });
  await add(env, "synthesis", {}, { kb_type: "synthesis" });
  await add(env, "starred", {}, { origin: "star" });
  await add(env, "no-kb", {}, null);
  await add(env, "quarantine", { curation_status: "quarantine" });
  await add(env, "suspect", { injection_suspect: 1 });
  await add(env, "dismissed", { dismissed_reason: "other" });
  await add(env, "capture", { kind: "capture" });
  await add(env, "library", { kind: "library" });
  const body = await handle(request("/api/public/showcase"), env).then((r) => r.json());
  assert.deepEqual(body.items.map((row) => row.title).sort(), ["Public public", "Public released"]);
  assert.equal(body.stats.approved_items, 2);
});

test("G04 lane filter is validated and parameterized; results are bounded to 30", async () => {
  const env = makeEnv();
  for (let i = 0; i < 33; i++) await add(env, `item-${i}`, { lane: i === 0 ? "AI_LEARNING_PATH" : "TECH_NEWS" });
  const all = await handle(request("/api/public/showcase"), env).then((r) => r.json());
  assert.equal(all.items.length, 30); assert.equal(all.stats.approved_items, 33);
  const filtered = await handle(request("/api/public/showcase?lane=AI_LEARNING_PATH"), env).then((r) => r.json());
  assert.equal(filtered.items.length, 1); assert.equal(filtered.items[0].lane, "AI_LEARNING_PATH");
  assert.equal((await handle(request("/api/public/showcase?lane='%20OR%201=1--"), env)).status, 400);
});

test("G04 rejects every non-GET API method without reading or writing D1", async () => {
  const env = makeEnv(); env.DB = { prepare() { throw new Error("D1 must not be touched"); } };
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
    const response = await handle(request("/api/public/showcase", method), env);
    assert.equal(response.status, 405, method); assert.equal(response.headers.get("allow"), "GET");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("G04 private routes and all non-GET static requests still require Access", async () => {
  const env = makeEnv();
  for (const [path, method] of [["/api/kb", "GET"], ["/api/kb/import", "POST"], ["/api/source-imports", "POST"], ["/api/items", "GET"], ["/api/cloud/capabilities", "GET"], ["/api/public/showcase/", "GET"], ["/", "GET"], ["/app.js", "GET"], ["/showcase.html", "GET"], ...["/showcase", "/showcase.js", "/showcase.css"].flatMap((path) => ["POST", "PUT", "PATCH", "DELETE", "HEAD"].map((method) => [path, method]))]) {
    assert.equal((await handle(request(path, method), env)).status, 401, `${method} ${path}`);
  }
});

test("G04 showcase HTML and exactly its static dependencies load without JWT", async () => {
  const env = makeEnv();
  env.ASSETS = { async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = path === "/showcase" ? "showcase.html" : path.slice(1);
    return new Response(readFileSync(new URL(`../cloud/public/${file}`, import.meta.url)), { headers: { "content-type": file.endsWith("html") ? "text/html" : file.endsWith("js") ? "text/javascript" : "text/css" } });
  } };
  for (const path of ["/showcase", "/showcase.js", "/showcase.css"]) assert.equal((await handle(request(path), env)).status, 200, path);
  const html = await handle(request("/showcase"), env).then((r) => r.text());
  assert.match(html, /<html lang="zh-Hant">/u); assert.match(html, /Owner Console/u);
  assert.doesNotMatch(html, /<form|\/app\.js|\/app\.css/iu);
});

test("G04 malformed public arrays and database failures never expose internals", async () => {
  const env = makeEnv(); await add(env, "malformed", { key_points: '{"secret":"PRIVATE"}' }, { tags: '["safe",{"secret":"PRIVATE"}]' });
  const body = await handle(request("/api/public/showcase"), env).then((r) => r.json());
  assert.deepEqual(body.items[0].key_points, []); assert.deepEqual(body.items[0].tags, ["safe"]);
  env.DB = { prepare() { throw new Error("PRIVATE_DATABASE_ERROR"); } };
  const failed = await handle(request("/api/public/showcase"), env);
  assert.equal(failed.status, 503); assert.equal(failed.headers.get("cache-control"), "no-store");
  assert.doesNotMatch(await failed.text(), /PRIVATE_DATABASE_ERROR/u);
});
