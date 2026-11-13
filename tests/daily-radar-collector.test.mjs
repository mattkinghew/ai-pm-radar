import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { collectDailyRadar, writeInbox } from "../scripts/daily_radar_collector.mjs";
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
  assert.deepEqual({ lane: item.lane, pref_score: item.pref_score, pref_reasons: item.pref_reasons, injection_suspect: item.injection_suspect },
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

test("collector stops at HTTP 403 and reports the failing source without continuing network requests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "radar-forbidden-"));
  const path = join(dir, "inbox.json");
  await writeInbox([{ id: "existing", title: "Existing draft", sourceId: "openai", url: "https://example.test/existing", discoveredAt: "2026-11-11T00:00:00Z", reviewStatus: "needs_review" }], path);
  const before = await readFile(path, "utf8");
  const calls = [];
  const results = [];
  const items = await collectDailyRadar({
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: false, status: 403 };
    },
    onSourceResult: (source, result) => results.push({ source, result }),
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(results, [{ source: "openai", result: "http_403" }]);
  assert.deepEqual(items, []);
  const script = new URL("../scripts/daily_radar_collector.mjs", import.meta.url).pathname;
  const preload = "data:text/javascript,globalThis.fetch%3Dasync()%3D%3Enew%20Response(null%2C%7Bstatus%3A403%7D)%3B";
  const run = spawnSync(process.execPath, ["--experimental-strip-types", "--import", preload, script], { env: { ...process.env, RADAR_INBOX_PATH: path }, encoding: "utf8" });
  assert.equal(run.status, 3);
  assert.match(run.stderr, /openai \(http_403\)/u);
  assert.equal(await readFile(path, "utf8"), before);
  await rm(dir, { recursive: true, force: true });
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
