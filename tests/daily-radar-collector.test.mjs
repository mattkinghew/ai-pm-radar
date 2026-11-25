import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { collectDailyRadar, loadSkipList, validateSkipList, writeInbox } from "../scripts/daily_radar_collector.mjs";
import { buildDailyFromInbox } from "../scripts/daily-from-inbox.mjs";
import { scoreLane } from "../cloud/src/curation.mjs";
import { writeLocalDailyFixture } from "../scripts/daily-radar-local-fixture.mjs";

test("collector separates source dimensions, deduplicates, and leaves candidates for human review", async () => {
  const feed = `<?xml version="1.0"?><rss><channel><title>OpenAI</title><item><title>AI launch</title><link>https://example.com/a</link><guid>a</guid><description>Summary</description></item></channel></rss>`;
  const fetchImpl = async (url) => url.includes("algolia")
    ? { ok: true, json: async () => ({ hits: [{ objectID: "1", title: "AI launch discussion", url: "https://example.com/hn", points: 99 }] }) }
    : { ok: true, text: async () => feed };
  const items = await collectDailyRadar({ fetchImpl, now: "2026-10-15T00:00:00.000Z" });
  assert.ok(items.some((item) => item.category === "AI_TECH_NEWS"));
  assert.ok(items.some((item) => item.category === "SOCIAL_VIRAL_STRATEGY"));
  assert.ok(items.every((item) => item.reviewStatus === "needs_review"));
  assert.ok(items.every((item) => typeof item.lane === "string" && Number.isFinite(item.pref_score) && Array.isArray(item.pref_reasons)));
  assert.equal(new Set(items.map((item) => item.url)).size, items.length);
  const dir = await mkdtemp(join(tmpdir(), "radar-inbox-"));
  try {
    const path = join(dir, "inbox.json");
    await writeInbox(items, path);
    const inbox = JSON.parse(await readFile(path, "utf8"));
    assert.equal(inbox.items.length, items.length);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("local candidates use the cloud lane scorer with observed publication dates", async () => {
  const feed = `<?xml version="1.0"?><rss><channel><item><title>Paid pilot pricing</title><link>https://example.com/pilot</link><guid>pilot</guid><description>Real customer pain</description><pubDate>Tue, 10 Nov 2026 00:00:00 GMT</pubDate></item></channel></rss>`;
  const items = await collectDailyRadar({ fetchImpl: async (url) => url.includes("algolia") ? { ok: true, json: async () => ({ hits: [] }) } : { ok: true, text: async () => feed }, now: "2026-11-11T00:00:00.000Z" });
  const item = items[0];
  assert.deepEqual({ lane: item.lane, pref_score: item.pref_score, pref_reasons: item.pref_reasons, pref_breakdown: item.pref_breakdown, curation_status: item.curation_status, curation_reason: item.curation_reason, injection_suspect: item.injection_suspect },
    scoreLane({ title: item.title, summary: item.summary, category: item.category, published_at: item.publishedAt }, { nowMs: Date.parse(item.discoveredAt) }));
  assert.equal(item.lane, "MONETIZATION_GAP");
  assert.ok(item.pref_reasons.includes("freshness_published_at"));
});

test("synthetic daily fixture writes the cloud lane fields and stays a review-gated draft", async () => {
  const dir = await mkdtemp(join(tmpdir(), "radar-fixture-"));
  try {
    const path = await writeLocalDailyFixture("2026-11-12", dir);
    const article = JSON.parse(await readFile(path, "utf8")).articles[0];
    assert.equal(article.lane, "OTHER");
    assert.equal(article.pref_score, 10);
    assert.deepEqual(article.pref_reasons, ["freshness_published_at"]);
    assert.equal(article.local_fixture, true);
    assert.equal(article.review.human_review_required, true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("one HTTP 403 is logged while other sources provide a daily draft", async () => {
  const dir = await mkdtemp(join(tmpdir(), "radar-forbidden-"));
  const path = join(dir, "inbox.json");
  const script = new URL("../scripts/daily_radar_collector.mjs", import.meta.url).pathname;
  const feed = '<rss><channel><item><title>Paid pilot pricing AI one</title><link>https://example.test/1</link></item><item><title>Paid pilot pricing AI two</title><link>https://example.test/2</link></item><item><title>Paid pilot pricing AI three</title><link>https://example.test/3</link></item></channel></rss>';
  const preload = `data:text/javascript,globalThis.fetch=async(url)=>url.includes('openai.com')?new Response(${JSON.stringify(feed)}):new Response(null,{status:403})`;
  try {
    const run = spawnSync(process.execPath, ["--experimental-strip-types", "--import", preload, script], { cwd: dir, env: { ...process.env, RADAR_INBOX_PATH: path }, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const logs = await readdir(join(dir, ".runtime/collector-runs"));
    assert.equal(logs.length, 1);
    const log = JSON.parse(await readFile(join(dir, ".runtime/collector-runs", logs[0]), "utf8"));
    assert.equal(log.exit_code, 0);
    assert.equal(log.counts.eligible, 3);
    assert.ok(log.sources.some((source) => source.id === "techcrunch-ai" && source.status === "http_error" && source.http_status === 403));
    assert.ok(log.sources.some((source) => source.id === "anthropic" && source.status === "disabled"));
    const daily = await buildDailyFromInbox({ inboxPath: path, outputDir: join(dir, "daily") });
    assert.equal(daily.selected, 3);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("two candidates fail closed, leave inbox and daily untouched, and write a run log", async () => {
  const dir = await mkdtemp(join(tmpdir(), "radar-shortage-"));
  const path = join(dir, "inbox.json");
  const script = new URL("../scripts/daily_radar_collector.mjs", import.meta.url).pathname;
  const feed = '<rss><channel><item><title>Paid pilot pricing AI one</title><link>https://example.test/1</link></item><item><title>Paid pilot pricing AI two</title><link>https://example.test/2</link></item></channel></rss>';
  const preload = `data:text/javascript,globalThis.fetch=async(url)=>url.includes('openai.com')?new Response(${JSON.stringify(feed)}):new Response(null,{status:403})`;
  try {
    const run = spawnSync(process.execPath, ["--experimental-strip-types", "--import", preload, script], { cwd: dir, env: { ...process.env, RADAR_INBOX_PATH: path }, encoding: "utf8" });
    assert.equal(run.status, 3, run.stderr);
    await assert.rejects(readFile(path), { code: "ENOENT" });
    await assert.rejects(readdir(join(dir, "daily")), { code: "ENOENT" });
    const logs = await readdir(join(dir, ".runtime/collector-runs"));
    const log = JSON.parse(await readFile(join(dir, ".runtime/collector-runs", logs[0]), "utf8"));
    assert.equal(log.decision, "daily_blocked");
    assert.equal(log.counts.eligible, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("disabled source is never fetched and skip-list schema is validated", async () => {
  const list = await loadSkipList();
  assert.ok(list.some((entry) => entry.id === "anthropic" && entry.since === "2026-11-15"));
  assert.throws(() => validateSkipList([{ id: "openai", reason: "", since: "2026-11-15", review_by: "2026-12-15" }]));
  assert.throws(() => validateSkipList([{ id: "unknown", reason: "bad", since: "2026-11-15", review_by: "2026-12-15" }]));
  assert.throws(() => validateSkipList([{ id: "openai", reason: "bad", since: "2026-02-30", review_by: "2026-12-15" }]));
  const calls = []; const results = [];
  await collectDailyRadar({ fetchImpl: async (url) => { calls.push(url); return { ok: false, status: 404 }; }, sourceResults: results });
  assert.ok(!calls.some((url) => url.includes("anthropic.com")));
  assert.ok(results.some((source) => source.id === "anthropic" && source.status === "disabled" && source.reason));
});

test("local RSS remembers validators and treats 304 as a successful empty result", async () => {
  const validators = {}; const seen = []; let round = 0;
  const fetchImpl = async (url, init) => {
    if (url.includes("algolia")) return Response.json({ hits: [] });
    seen.push(init.headers);
    if (round) return new Response(null, { status: 304 });
    return new Response("<rss><channel><item><title>AI update</title><link>https://example.test/update</link></item></channel></rss>", { headers: { etag: '"v1"', "last-modified": "Wed, 11 Nov 2026 00:00:00 GMT" } });
  };
  const first = await collectDailyRadar({ fetchImpl, validators });
  assert.ok(first.length > 0);
  assert.equal(validators.openai.etag, '"v1"');
  round = 1; seen.length = 0; const results = [];
  const second = await collectDailyRadar({ fetchImpl, validators, onSourceResult: (source, result) => results.push({ source, result }) });
  assert.deepEqual(second, []);
  assert.ok(results.some((x) => x.source === "openai" && x.result === "not_modified"));
  assert.ok(seen.every((headers) => headers["if-none-match"] === '"v1"' && headers["if-modified-since"] === "Wed, 11 Nov 2026 00:00:00 GMT"));
  const dir = await mkdtemp(join(tmpdir(), "radar-validators-"));
  try {
    const path = join(dir, "inbox.json");
    await writeInbox(first, path, validators);
    assert.equal(JSON.parse(await readFile(path, "utf8")).validators.openai.etag, '"v1"');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
