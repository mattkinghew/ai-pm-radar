import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectDailyRadar, writeInbox } from "../scripts/daily_radar_collector.mjs";

test("collector separates source dimensions, deduplicates, and leaves candidates for human review", async () => {
  const feed = `<?xml version="1.0"?><rss><channel><title>OpenAI</title><item><title>AI launch</title><link>https://example.com/a</link><guid>a</guid><description>Summary</description></item></channel></rss>`;
  const fetchImpl = async (url) => url.includes("algolia")
    ? { ok: true, json: async () => ({ hits: [{ objectID: "1", title: "AI launch discussion", url: "https://example.com/hn", points: 99 }] }) }
    : { ok: true, text: async () => feed };
  const items = await collectDailyRadar({ fetchImpl, now: "2026-10-15T00:00:00.000Z" });
  assert.ok(items.some((item) => item.category === "AI_TECH_NEWS"));
  assert.ok(items.some((item) => item.category === "SOCIAL_VIRAL_STRATEGY"));
  assert.ok(items.every((item) => item.reviewStatus === "needs_review"));
  assert.equal(new Set(items.map((item) => item.url)).size, items.length);
  const dir = await mkdtemp(join(tmpdir(), "radar-inbox-"));
  try {
    const path = join(dir, "inbox.json");
    await writeInbox(items, path);
    const inbox = JSON.parse(await readFile(path, "utf8"));
    assert.equal(inbox.items.length, items.length);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
