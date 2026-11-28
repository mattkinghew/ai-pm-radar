import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportNavideKb, MAX_BYTES, renderKnowledgeBase } from "../scripts/export-navide-kb.mjs";

const article = (extra = {}) => ({
  short_title: "產品更新", summary: "核心洞見：先驗證需求。", category: "AI_TECH_NEWS", tags: ["AI", "產品"],
  published_at: "2026-11-20T02:00:00Z", source_url: "https://example.test/news?utm_source=feed#section", ...extra,
});
const thread = (extra = {}) => ({
  title: "工作流分享", raw_text: "公開工作流的用途與限制。", lane: "APPLY_NOW", published_at: "2026-11-21T01:00:00Z",
  canonical_url: "https://www.threads.net/@public-source/post/abc?tracking=remove", quarantined: false,
  review_status: "READY_FOR_INBOX", ...extra,
});

async function fixture(t, articles = [article()], threads) {
  const root = await mkdtemp(join(tmpdir(), "radar-navide-kb-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "data", "daily"), { recursive: true });
  const dailyPath = join(root, "data", "daily", "2026-11-20.json");
  await writeFile(dailyPath, JSON.stringify({ date: "2026-11-20", articles }));
  if (threads !== undefined) {
    await mkdir(join(root, "output", "threads-cleaned"), { recursive: true });
    await writeFile(join(root, "output", "threads-cleaned", "radar-threads-inbox.json"), JSON.stringify({ items: threads }));
  }
  return { root, dailyPath, output: join(root, "exports", "navide-kb") };
}

async function outputs(output) {
  const briefing = await readFile(join(output, "latest-briefing.md"), "utf8");
  const index = await readFile(join(output, "topics-index.json"), "utf8");
  return { briefing, index, topics: JSON.parse(index) };
}

test("merges cleaned local sources newest first, with exact allowlist, safe links and no input writes", async (t) => {
  const { root, dailyPath, output } = await fixture(t, [article({
    id: "owner-private-id", api_key: "synthetic-private-value", cookie: "synthetic-cookie", owner_email: "owner@example.test",
    metadata: { phone: "synthetic-private-phone" }, review: { status: "reviewed" },
  })], [thread({ author_name: "Synthetic Author", author_handle: "private-handle", metrics: { likes: 9 } })]);
  const before = await readFile(dailyPath);
  const threadsPath = join(root, "output", "threads-cleaned", "radar-threads-inbox.json");
  const threadsBefore = await readFile(threadsPath);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Network forbidden"); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const result = await exportNavideKb(root);
  assert.equal(result.count, 2);
  assert.deepEqual(await readFile(dailyPath), before);
  assert.deepEqual(await readFile(threadsPath), threadsBefore);
  const { briefing, index, topics } = await outputs(output);
  assert.equal(topics[0].title, "工作流分享");
  assert.match(topics[0].summary, /未核實/u);
  for (const topic of topics) {
    assert.deepEqual(Object.keys(topic), ["id", "date", "category", "title", "summary", "tags"]);
    assert.match(topic.id, /^[a-f0-9]{20}$/u);
  }
  assert.match(briefing, /https:\/\/example\.test\/news>/u);
  assert.match(briefing, /主題分類/u);
  assert.doesNotMatch(briefing + index, /synthetic-private|synthetic-cookie|owner-private|owner@example|Synthetic Author|private-handle|metrics|utm_source|tracking=|#section/u);
});

test("skips drafts, quarantine, synthetic fixtures, invalid dates and unsafe URLs", async (t) => {
  const { root, output } = await fixture(t, [article(),
    ...[
      { needs_review: true }, { review: { status: "draft" } }, { review: { human_review_required: true } },
      { local_fixture: true }, { synthetic: true }, { injection_suspect: true }, { curation_status: "quarantine" },
      { published_at: "not-a-date" }, { source_url: "javascript:alert(1)" },
      { source_url: "https://user:password@example.test/private" }, { source_url: "http://127.0.0.1/private" },
      { source_url: "https://example.test/api_key%3Dsynthetic-value" },
    ].map((extra) => article(extra))
  ], [thread({ quarantined: true }), thread({ review_status: "NEEDS_SOURCE_REVIEW" })]);
  await exportNavideKb(root);
  assert.equal((await outputs(output)).topics.length, 1);
});

test("drops whole records with secrets/PII even beyond the summary excerpt; removes author metadata and mentions", async (t) => {
  const unsafe = [
    "API Key: synthetic-value", "Cookie: synthetic-session", "Authorization: Bearer synthetic",
    "api\u200b_key=synthetic-value", "Ｃｏｏｋｉｅ：synthetic-session",
    "password=synthetic", "sk-abcdefghijklmno123456", "contact person@example.test", "電話：12345678",
    "-----BEGIN PRIVATE KEY-----", "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoxfQ.signature", "+852 9123 4567",
    "x".repeat(700) + " api_key=synthetic-value",
  ];
  const { root, output } = await fixture(t, [article(), ...unsafe.map((summary) => article({ summary }))], [thread({
    title: "Synthetic Author 的更新", raw_text: "Synthetic Author 與 @private_handle 分享公開資訊 https://example.test/public",
    author_name: "Synthetic Author", author_handle: "private_handle",
  })]);
  await exportNavideKb(root);
  const { briefing, index, topics } = await outputs(output);
  assert.equal(topics.length, 2);
  assert.doesNotMatch(briefing + index, /Synthetic Author|private_handle|api_key|signature|person@example/u);
  assert.match(topics[0].summary, /\[REDACTED\]/u);
});

test("sorting and deduplication are deterministic across files and repeated read-only exports", async (t) => {
  const { root, output } = await fixture(t, [article(), article()], [thread()]);
  await exportNavideKb(root);
  const first = await outputs(output);
  await exportNavideKb(root);
  assert.deepEqual(await outputs(output), first);
  for (const name of ["latest-briefing.md", "topics-index.json"]) {
    assert.equal((await stat(join(output, name))).mode & 0o777, 0o400);
  }
  assert.equal((await stat(output)).mode & 0o777, 0o700);
});

test("both outputs stay strictly below 40,000 UTF-8 bytes and retain the same newest prefix", async (t) => {
  const articles = Array.from({ length: 120 }, (_, i) => article({
    source_url: `https://example.test/item/${i}`, short_title: `第 ${i} 則重點`,
    summary: "多位元組摘要與核心洞見。".repeat(120), tags: ["繁體中文"],
    published_at: new Date(Date.UTC(2026, 10, 20, 0, 0, i)).toISOString(),
  }));
  const { root, output } = await fixture(t, articles);
  await exportNavideKb(root);
  const { briefing, index, topics } = await outputs(output);
  assert.ok(topics.length > 0 && topics.length < articles.length);
  assert.ok(Buffer.byteLength(briefing) < MAX_BYTES);
  assert.ok(Buffer.byteLength(index) < MAX_BYTES);
  assert.equal(topics[0].title, "第 119 則重點");
  assert.equal(topics.at(-1).title, `第 ${120 - topics.length} 則重點`);
  assert.equal((briefing.match(/^## /gmu) || []).length, topics.length);
});

test("JSON escaping also counts toward the cap; empty render remains valid JSON", () => {
  const records = Array.from({ length: 1000 }, (_, i) => ({
    topic: { id: String(i), date: "2026-11-20T00:00:00.000Z", category: "AI", title: "測試", summary: '\\"'.repeat(300), tags: [] },
    url: `https://example.test/${i}`,
  }));
  const result = renderKnowledgeBase(records);
  assert.ok(result.count > 0 && result.count < records.length);
  assert.ok(Buffer.byteLength(result.briefing) < MAX_BYTES);
  assert.ok(Buffer.byteLength(result.index) < MAX_BYTES);
  assert.deepEqual(JSON.parse(renderKnowledgeBase([]).index), []);
});

test("no eligible records or malformed JSON leaves prior exports unchanged", async (t) => {
  const { root, dailyPath, output } = await fixture(t);
  await exportNavideKb(root);
  const before = await outputs(output);
  await writeFile(dailyPath, JSON.stringify({ date: "2026-11-20", articles: [] }));
  await assert.rejects(exportNavideKb(root), /No eligible/u);
  assert.deepEqual(await outputs(output), before);
  await writeFile(dailyPath, '{"secret":"synthetic-private-value", broken');
  await assert.rejects(exportNavideKb(root), (error) => !error.message.includes("synthetic-private-value") && /read\/parse/u.test(error.message));
  assert.deepEqual(await outputs(output), before);
});

test("refuses symlink export directories and targets without changing their destination", async (t) => {
  const { root } = await fixture(t);
  const outside = join(root, "outside");
  await mkdir(outside);
  await symlink(outside, join(root, "exports"));
  await assert.rejects(exportNavideKb(root), /symlink/u);
  await rm(join(root, "exports"));
  await exportNavideKb(root);
  const destination = join(outside, "untouched.txt");
  await writeFile(destination, "unchanged");
  const target = join(root, "exports", "navide-kb", "latest-briefing.md");
  await rm(target);
  await symlink(destination, target);
  await assert.rejects(exportNavideKb(root), /symlink/u);
  assert.equal(await readFile(destination, "utf8"), "unchanged");
});

test("refuses symlink JSON input without logging its content", async (t) => {
  const { root, dailyPath } = await fixture(t);
  const destination = join(root, "private.json");
  await writeFile(destination, '{"secret":"synthetic-private-value"}');
  await rm(dailyPath);
  await symlink(destination, dailyPath);
  await assert.rejects(exportNavideKb(root), /Local JSON read\/parse failed/u);
  await assert.rejects(stat(join(root, "exports")), { code: "ENOENT" });
});
