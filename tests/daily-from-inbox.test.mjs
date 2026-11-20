import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDailyFromInbox, hktDate } from "../scripts/daily-from-inbox.mjs";

const now = new Date("2026-11-15T00:30:00.000Z");
const item = (id, extra = {}) => ({
  id, sourceId: "openai", title: `AI update ${id}`, url: `https://example.test/${id}`,
  summary: `Source summary ${id}`, category: "AI_TECH_NEWS", publishedAt: "2026-11-14T23:00:00Z",
  discoveredAt: "2026-11-15T00:00:00Z", reviewStatus: "needs_review",
  lane: "TECH_NEWS", pref_score: 10, pref_reasons: ["freshness_published_at"], injection_suspect: false,
  ...extra,
});

async function fixture(items, run) {
  const dir = await mkdtemp(join(tmpdir(), "radar-daily-real-"));
  const inboxPath = join(dir, "inbox.json");
  const outputDir = join(dir, "daily");
  await writeFile(inboxPath, JSON.stringify({ version: 1, items }));
  try { await run({ inboxPath, outputDir }); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test("HKT date crosses UTC boundary", () => {
  assert.equal(hktDate(new Date("2026-11-14T16:00:00Z")), "2026-11-15");
});

test("builds top ranked real draft, holds injection, rejects synthetic and stale, and passes both validators", async () => {
  await fixture([
    item("low", { pref_score: 1 }),
    item("high", { pref_score: 30, publishedAt: "2026-11-14T22:00:00Z" }),
    item("high-duplicate", { pref_score: 25, url: "https://www.example.test/high?utm_source=feed#fragment" }),
    item("middle", { pref_score: 20 }),
    item("held", { pref_score: 99, injection_suspect: true }),
    item("synthetic", { synthetic: true }),
    item("fixture", { local_fixture: true }),
    item("old", { discoveredAt: "2026-10-18T00:00:00Z" }),
  ], async ({ inboxPath, outputDir }) => {
    const result = await buildDailyFromInbox({ inboxPath, outputDir, now, limit: 3 });
    assert.equal(result.selected, 3);
    assert.equal(result.held, 1);
    const daily = JSON.parse(await readFile(result.target, "utf8"));
    assert.deepEqual(daily.articles.map((article) => article.source_url), ["https://example.test/high", "https://example.test/middle", "https://example.test/low"]);
    assert.equal(daily.review.status, "draft");
    assert.equal(daily.needs_review, true);
    assert.equal(daily.articles[0].generated_by, "scripts/daily-from-inbox.mjs");
    assert.ok(daily.articles.every((article) => article.review.status === "draft" && article.needs_review));
    for (const validator of ["validate-daily-json.mjs", "validate_daily_data.mjs"]) {
      const check = spawnSync(process.execPath, [join("scripts", validator), outputDir], { encoding: "utf8" });
      assert.equal(check.status, 0, `${validator}: ${check.stdout}\n${check.stderr}`);
    }
    await assert.rejects(buildDailyFromInbox({ inboxPath, outputDir, now }), { code: "EEXIST" });
  });
});

test("fewer than three real same-day items leaves daily directory untouched", async () => {
  await fixture([item("a"), item("b"), item("bad", { injection_suspect: true })], async ({ inboxPath, outputDir }) => {
    await assert.rejects(buildDailyFromInbox({ inboxPath, outputDir, now }), /need at least 3/u);
    await assert.rejects(readdir(outputDir), { code: "ENOENT" });
  });
});

test("equal preference uses publication recency and unknown publication is labeled", async () => {
  await fixture([
    item("older", { publishedAt: "2026-11-13T00:00:00Z" }),
    item("newer", { publishedAt: "2026-11-15T00:00:00Z" }),
    item("unknown", { publishedAt: null }),
  ], async ({ inboxPath, outputDir }) => {
    const { target } = await buildDailyFromInbox({ inboxPath, outputDir, now });
    const daily = JSON.parse(await readFile(target, "utf8"));
    assert.equal(daily.articles[0].source_url, "https://example.test/newer");
    assert.equal(daily.articles.find((article) => article.source_url.endsWith("/unknown")).published_at_basis, "discovered_at_fallback");
  });
});
