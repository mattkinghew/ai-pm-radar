import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../cloud/src/worker.mjs";
import { cleanThreadsExport } from "../cloud/public/threads-import.mjs";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";

const TOKEN = "synthetic-g07-token-not-a-real-secret";
const kit = accessKit();
const noNetwork = async () => { throw new Error("Network and AI must not be called"); };
const deps = { authFetch: noNetwork, fetchImpl: noNetwork };
const makeEnv = () => ({ DB: fakeD1(), INGEST_API_TOKEN: TOKEN, INGEST_TOKEN: "synthetic-legacy-token-with-32-characters", CLOUD_ACCESS_REQUIRED: "true",
  CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash,
  AI: { run: noNetwork } });
const payload = (items = [{ title: "Synthetic private note", content: "Owned synthetic content" }], source_type = "generic", dry_run = false) => ({ source_type, items, dry_run });
const request = (body = payload(), { method = "POST", authorization = `Bearer ${TOKEN}`, path = "/api/ingest/batch" } = {}) => new Request(`https://radar.example${path}`, {
  method, headers: { "content-type": "application/json", ...(authorization === null ? {} : { authorization }) },
  ...(["GET", "HEAD"].includes(method) ? {} : { body: JSON.stringify(body) }),
});
const ingest = async (env, body) => { const r = await handle(request(body), env, deps); assert.equal(r.status, 200); return r.json(); };
const count = (env, table = "kb_entries") => env.DB.raw.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;
const thread = (id, text = "A useful product workflow with enough synthetic context to retain privately.") => ({ id, url: `https://www.threads.net/@synthetic/post/${id}`, text });

test("G07 fails closed before D1 or Access: unconfigured, invalid bearer, non-POST", async () => {
  const env = makeEnv(); env.DB = { prepare() { assert.fail("D1 must not be touched"); } };
  for (const token of [undefined, "", "   "]) {
    env.INGEST_API_TOKEN = token;
    const r = await handle(request(), env, deps);
    assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: "ingest_not_configured" });
  }
  env.INGEST_API_TOKEN = TOKEN;
  for (const authorization of [null, "", "Basic invalid", "Bearer invalid", `Bearer ${TOKEN}extra`, `Bearer ${env.INGEST_TOKEN}`, `Bearer ${TOKEN} extra`]) {
    const r = await handle(request(payload(), { authorization }), env, deps);
    assert.equal(r.status, 401); assert.deepEqual(await r.json(), { error: "unauthorized" });
    assert.equal(r.headers.get("cache-control"), "no-store");
  }
  for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const r = await handle(request(payload(), { method }), env, deps);
    assert.equal(r.status, 405); assert.equal(r.headers.get("allow"), "POST");
  }
});

test("G07 token cannot read owner routes or use legacy machine routes", async () => {
  const env = makeEnv();
  for (const path of ["/api/kb", "/api/digest", "/api/digest?days=7", "/api/sources", "/api/ingest/batch/", "/api/ingest/x"]) {
    for (const method of ["GET", "POST"]) assert.equal((await handle(request(payload(), { path, method }), env, deps)).status, 401, `${method} ${path}`);
  }
  const ownerOnly = new Request("https://radar.example/api/ingest/batch", { method: "POST", headers: { "Cf-Access-Jwt-Assertion": kit.token() }, body: JSON.stringify(payload()) });
  assert.equal((await handle(ownerOnly, env, deps)).status, 401);
});

test("G07 rejects invalid envelope, source, items, dry_run and malformed JSON", async () => {
  const env = makeEnv();
  for (const body of [null, [], {}, payload([], "generic"), payload("bad"), payload(Array(51).fill({ title: "note" })), payload(undefined, "unknown"), payload(undefined, "generic", "false")]) {
    assert.equal((await handle(request(body), env, deps)).status, 400, JSON.stringify(body));
  }
  const malformed = new Request("https://radar.example/api/ingest/batch", { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: "{" });
  assert.equal((await handle(malformed, env, deps)).status, 400);
  assert.equal((await handle(request(payload([{ id: { toString: "untrusted" }, text: "Synthetic malformed ID" }], "threads_saved")), env, deps)).status, 400);
  assert.equal(count(env), 0);
});

test("G07 bounds the streamed body even without Content-Length", async () => {
  const env = makeEnv();
  const r = await handle(request(payload([{ title: "x", content: "a".repeat(4 * 1024 * 1024) }])), env, deps);
  assert.equal(r.status, 413); assert.deepEqual(await r.json(), { error: "payload_too_large" }); assert.equal(count(env), 0);
});

test("G07 shares G2 cleaning, ID/URL dedup, noise quarantine and URL extraction", async () => {
  const env = makeEnv();
  const valid = thread("one", "A useful workflow https://github.com/Example/Project.git with sufficient synthetic detail.");
  const items = [valid, { ...valid, text: "Changed body, same ID", url: "https://threads.net/other" },
    { ...valid, id: "different-id", url: valid.url + "/?utm_source=export" }, thread("noise", "急聘：這是用來測試雜訊隔離的合成內容。"), null];
  const result = await ingest(env, payload(items, "threads_saved"));
  assert.deepEqual([result.received, result.inserted, result.skipped_duplicates, result.rejected], [5, 1, 2, 2]);
  assert.equal(result.errors.length, 2);
  const row = env.DB.raw.prepare("SELECT * FROM kb_entries").get();
  assert.equal(row.title, cleanThreadsExport([valid]).validItems[0].title);
  assert.equal(row.url, valid.url); assert.equal(row.source, "threads_saved");
  assert.ok(JSON.parse(row.note).urls.includes("https://github.com/Example/Project.git"));
  assert.equal(row.origin, "manual"); assert.equal(row.kb_type, "note"); assert.equal(row.item_id, null);
  const retry = await ingest(env, payload([valid], "threads_saved"));
  assert.equal(retry.inserted, 0); assert.equal(retry.skipped_duplicates, 1); assert.equal(count(env), 1);
});

test("G07 video and generic sanitize structured data, preserve notes and extract only HTTP(S) URLs", async () => {
  const env = makeEnv();
  const item = { external_id: "video-123", title: "  Synthetic\u0000 video  ", summary: " Summary ", content: "Owned transcript\r\nhttps://example.test/notes. ftp://example.test/no",
    key_points: [" First point ", "", "Second point"], tags: [" AI PM ", "AI PM"], captured_at: "2026-11-26T12:00:00Z", url: "https://video.example/watch?v=123",
    origin: "approved", kb_type: "item", status: "approved", item_id: "malicious-item", threads: { unwanted: "DROP_THIS_METADATA" } };
  const result = await ingest(env, payload([item], "video_watch"));
  assert.equal(result.inserted, 1); assert.equal(result.ok, true); assert.equal(result.dry_run, false);
  const row = env.DB.raw.prepare("SELECT * FROM kb_entries").get();
  assert.equal(row.title, "Synthetic video"); assert.equal(row.summary, "Summary");
  assert.deepEqual(JSON.parse(row.key_points), ["First point", "Second point"]); assert.deepEqual(JSON.parse(row.tags), ["AI PM"]);
  const note = JSON.parse(row.note);
  assert.equal(note.content, "Owned transcript\nhttps://example.test/notes. ftp://example.test/no");
  assert.ok(!row.note.includes("DROP_THIS_METADATA"));
  assert.deepEqual(note.urls, [item.url, "https://example.test/notes"]); assert.equal(note.captured_at, "2026-11-26T12:00:00.000Z");
  assert.equal(row.origin, "manual"); assert.equal(row.kb_type, "note"); assert.equal(row.item_id, null);
  assert.equal((await ingest(env, payload([{ title: "Generic", content: "https://example.test/extracted" }]))).inserted, 1);
  assert.equal(env.DB.raw.prepare("SELECT url FROM kb_entries WHERE title='Generic'").get().url, "https://example.test/extracted");
  assert.equal(count(env, "items"), 0); assert.equal(count(env, "ai_usage"), 0);
});

test("G07 rejects invalid individual fields without dropping valid items or echoing content", async () => {
  const env = makeEnv();
  const invalid = [null, [], {}, { title: {} }, { title: " " }, { title: "x", url: "javascript:alert(1)" },
    { title: "x", url: "https://user:password@example.test/" }, { title: "x", captured_at: "not-a-date" },
    { title: "x", tags: [1] }, { title: "x", content: "a".repeat(20001) }, { title: "x", key_points: "not-an-array" },
    { title: "x", external_id: {} }];
  const r = await ingest(env, payload([...invalid, { title: "Valid" }]));
  assert.equal(r.inserted, 1); assert.equal(r.rejected, invalid.length); assert.equal(r.errors.length, invalid.length);
  assert.doesNotMatch(JSON.stringify(r), /password|javascript|not-a-date/u);
});

test("G07 dry-run performs no writes, reports duplicates and leaves later ingestion unchanged", async () => {
  for (const source of ["threads_saved", "video_watch", "generic"]) {
    const env = makeEnv();
    const item = source === "threads_saved" ? thread("dry") : { title: "Dry note", external_id: "dry" };
    const preview = await ingest(env, payload([item, item], source, true));
    assert.equal(preview.dry_run, true); assert.equal(preview.inserted, 0); assert.equal(preview.skipped_duplicates, 1); assert.equal(count(env), 0);
    assert.equal((await ingest(env, payload([item], source))).inserted, 1);
    const again = await ingest(env, payload([item], source, true));
    assert.equal(again.inserted, 0); assert.equal(again.skipped_duplicates, 1); assert.equal(count(env), 1);
  }
});

test("G07 deterministic keys handle external IDs, normalized URLs, content fallback and source isolation", async () => {
  const env = makeEnv();
  const items = [{ external_id: "stable", title: "By ID" }, { title: "By URL", url: "https://example.test/watch?v=1&utm_source=one" }, { title: "By content", content: "Stable content" }];
  assert.equal((await ingest(env, payload(items))).inserted, 3);
  const retry = await ingest(env, payload([{ ...items[0], title: "Revised", captured_at: new Date().toISOString() },
    { title: "Changed title", url: "https://example.test/watch?utm_source=two&v=1#top" }, { content: "Stable content", title: "By content", captured_at: new Date().toISOString() }]));
  assert.equal(retry.inserted, 0); assert.equal(retry.skipped_duplicates, 3);
  assert.equal((await ingest(env, payload([{ title: "Other video", url: "https://example.test/watch?v=2" }]))).inserted, 1);
  assert.equal((await ingest(env, payload([items[0]], "video_watch"))).inserted, 1);
  assert.equal(env.DB.raw.prepare("SELECT title FROM kb_entries WHERE title='By ID'").get().title, "By ID");
});

test("G07 accepts exactly 50 and concurrent retries insert each deterministic key once", async () => {
  const env = makeEnv(); const body = payload(Array.from({ length: 50 }, (_, i) => ({ title: `Synthetic ${i}`, external_id: String(i) })));
  const results = await Promise.all([ingest(env, body), ingest(env, body)]);
  assert.equal(results.reduce((n, r) => n + r.inserted, 0), 50);
  assert.equal(results.reduce((n, r) => n + r.skipped_duplicates, 0), 50); assert.equal(count(env), 50);
});

test("G07 ingested notes remain compatible with owner KB list, edit and delete", async () => {
  const env = makeEnv(); await ingest(env, payload());
  const ownerDeps = { ...deps, authFetch: async () => new Response(kit.jwks) };
  const ownerRequest = (path, method = "GET", body) => new Request(`https://radar.example${path}`, { method,
    headers: { "Cf-Access-Jwt-Assertion": kit.token(), "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const list = await handle(ownerRequest("/api/kb"), env, ownerDeps).then((r) => r.json());
  assert.equal(list.entries.length, 1); const id = list.entries[0].id;
  assert.match(id, /^[0-9a-f]{32}$/u);
  const edited = await handle(ownerRequest(`/api/kb/${id}`, "PATCH", { note: "Owner edited note", tags: ["review-later"] }), env, ownerDeps);
  assert.equal(edited.status, 200); assert.equal((await edited.json()).entry.note, "Owner edited note");
  assert.equal((await ingest(env, payload())).skipped_duplicates, 1);
  assert.equal(env.DB.raw.prepare("SELECT note FROM kb_entries WHERE id=?").get(id).note, "Owner edited note");
  assert.equal((await handle(ownerRequest(`/api/kb/${id}`, "DELETE"), env, ownerDeps)).status, 200);
  assert.equal(count(env), 0);
});

test("G07 storage failures are sanitized and retry safely preserves prior writes", async () => {
  const env = makeEnv(); const db = env.DB; let writes = 0;
  env.DB = { prepare(sql) {
    if (sql.startsWith("INSERT") && ++writes === 2) throw new Error(`PRIVATE_DB_ERROR ${TOKEN}`);
    return db.prepare(sql);
  } };
  const r = await handle(request(payload([{ title: "One" }, { title: "Two" }])), env, deps);
  assert.equal(r.status, 503); assert.doesNotMatch(await r.text(), /PRIVATE_DB_ERROR|synthetic-g07-token/u);
  env.DB = db;
  const retry = await ingest(env, payload([{ title: "One" }, { title: "Two" }]));
  assert.equal(retry.inserted, 1); assert.equal(retry.skipped_duplicates, 1); assert.equal(count(env), 2);
});

test("G07 private batch notes never enter showcase or either digest path", async () => {
  const env = makeEnv();
  for (const source of ["threads_saved", "video_watch", "generic"]) {
    await ingest(env, payload([source === "threads_saved" ? thread("private", "PRIVATE_G07_THREADS Synthetic product workflow with sufficient context.") : { title: `PRIVATE_G07_${source}`, summary: "PRIVATE_G07_SUMMARY" }], source));
  }
  const at = new Date().toISOString();
  env.DB.raw.prepare("INSERT INTO items(id,kind,status,title,url,source,lane,curation_status,injection_suspect,created_at,updated_at,published_at) VALUES('public','daily','approved','Public control','https://example.test/public','synthetic','TECH_NEWS','main',0,?,?,?)").run(at, at, at);
  env.DB.raw.prepare("INSERT INTO kb_entries(id,item_id,title,origin,kb_type,created_at,updated_at) VALUES('public-kb','public','Public','approved','item',?,?)").run(at, at);
  const ownerDeps = { ...deps, authFetch: async () => new Response(kit.jwks) };
  for (const path of ["/api/public/showcase", "/api/digest", "/api/digest?days=7", "/api/digest?window=weekly"]) {
    const r = await handle(new Request(`https://radar.example${path}`, { headers: { "Cf-Access-Jwt-Assertion": kit.token() } }), env, ownerDeps);
    assert.equal(r.status, 200, path);
    const text = await r.text(); assert.match(text, /Public control/u); assert.doesNotMatch(text, /PRIVATE_G07/u);
  }
  assert.equal(count(env), 4); assert.equal(count(env, "items"), 1); assert.equal(count(env, "ai_usage"), 0);
});

test("G07 pusher chunks 120 items into 50 + 50 + 20", async () => {
  const { chunkItems } = await import("../scripts/push-radar-batch.mjs");
  assert.deepEqual(chunkItems(Array.from({ length: 120 }, (_, i) => i)).map((batch) => batch.length), [50, 50, 20]);
});

test("G07 pusher sends sequential batches, forwards dry_run and aggregates only safe counters", async () => {
  const { pushBatches } = await import("../scripts/push-radar-batch.mjs");
  const calls = []; let active = false;
  const env = { INGEST_API_TOKEN: TOKEN, RADAR_INGEST_URL: "https://radar.example/api/ingest/batch" };
  const total = await pushBatches(Array.from({ length: 120 }, (_, i) => ({ title: `Note ${i}` })), { source: "generic", dryRun: true, env, fetchImpl: async (url, options) => {
    assert.equal(active, false); active = true;
    assert.equal(String(url), env.RADAR_INGEST_URL); assert.equal(options.headers.authorization, `Bearer ${TOKEN}`);
    assert.equal(options.redirect, "error"); const body = JSON.parse(options.body); calls.push(body);
    await Promise.resolve(); active = false;
    return Response.json({ ok: true, source_type: body.source_type, dry_run: true, received: body.items.length, inserted: 0, skipped_duplicates: 0, rejected: 0, errors: [], ignored: TOKEN });
  } });
  assert.deepEqual(calls.map((x) => x.items.length), [50, 50, 20]); assert.ok(calls.every((x) => x.dry_run === true));
  assert.equal(total.received, 120); assert.equal(total.inserted, 0); assert.doesNotMatch(JSON.stringify(total), /synthetic-g07-token/u);
});

test("G07 pusher fails safely on missing secrets, unsafe URLs, HTTP failures and malformed summaries", async () => {
  const { pushBatches } = await import("../scripts/push-radar-batch.mjs");
  const items = Array.from({ length: 51 }, () => ({ title: "Synthetic" }));
  await assert.rejects(pushBatches(items, { source: "generic", env: {}, fetchImpl: noNetwork }), /INGEST_API_TOKEN/u);
  for (const url of ["http://external.example/api/ingest/batch", "https://user:pass@external.example/api/ingest/batch"]) {
    await assert.rejects(pushBatches(items, { source: "generic", env: { INGEST_API_TOKEN: TOKEN, RADAR_INGEST_URL: url }, fetchImpl: noNetwork }), /RADAR_INGEST_URL/u);
  }
  let calls = 0;
  await assert.rejects(pushBatches(items, { source: "generic", env: { INGEST_API_TOKEN: TOKEN }, fetchImpl: async () => { calls++; return new Response(TOKEN, { status: 401 }); } }), /HTTP 401/u);
  assert.equal(calls, 1);
  await assert.rejects(pushBatches(items, { source: "generic", env: { INGEST_API_TOKEN: TOKEN }, fetchImpl: async () => Response.json({ ok: true, received: TOKEN }) }), /invalid_response/u);
  await assert.rejects(pushBatches(items, { source: "generic", env: { INGEST_API_TOKEN: TOKEN }, fetchImpl: async () => { throw new Error(TOKEN); } }), /request_failed/u);
});

test("G07 CLI reads JSON files, prints safe summaries and exits nonzero for rejected items", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "radar-g07-cli-")), file = join(dir, "synthetic.json");
  t.after(() => { unlinkSync(file); rmdirSync(dir); });
  const script = fileURLToPath(new URL("../scripts/push-radar-batch.mjs", import.meta.url));
  const run = (args, rejected = 0) => spawnSync(process.execPath, ["--input-type=module", "--eval", `
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      return Response.json({ ok: true, source_type: body.source_type, dry_run: body.dry_run, received: body.items.length,
        inserted: body.dry_run ? 0 : body.items.length - ${rejected}, skipped_duplicates: 0, rejected: ${rejected}, errors: [] });
    };
    process.argv = [process.execPath, ${JSON.stringify(script)}, ...${JSON.stringify(args)}];
    await import(${JSON.stringify(pathToFileURL(script).href)});
  `], { encoding: "utf8", env: { INGEST_API_TOKEN: TOKEN, RADAR_INGEST_URL: "https://radar.example/api/ingest/batch" } });
  writeFileSync(file, JSON.stringify({ items: Array.from({ length: 120 }, (_, i) => ({ title: `Synthetic ${i}` })) }));
  const success = run(["--source", "generic", "--file", file, "--dry-run"]);
  assert.equal(success.status, 0, success.stderr); assert.equal(JSON.parse(success.stdout).batches, 3);
  assert.equal(JSON.parse(success.stdout).dry_run, true); assert.doesNotMatch(success.stdout + success.stderr, /synthetic-g07-token/u);
  writeFileSync(file, JSON.stringify([{ title: "Synthetic" }]));
  const rejected = run(["--source", "video_watch", "--file", file], 1);
  assert.equal(rejected.status, 1); assert.equal(JSON.parse(rejected.stdout).rejected, 1);
  assert.equal(run(["--source", "invalid", "--file", file]).status, 1);
  writeFileSync(file, "{");
  const malformed = run(["--source", "generic", "--file", file]);
  assert.equal(malformed.status, 1); assert.match(malformed.stderr, /valid JSON/u); assert.doesNotMatch(malformed.stderr, /synthetic-g07-token/u);
});
