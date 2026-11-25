import test from "node:test";
import assert from "node:assert/strict";
import { canonicalSourceValue, parseSourceImport } from "../cloud/src/source-import.mjs";

test("OPML parses feed URL, title, and category without fetching sources", () => {
  const result = parseSourceImport({ format: "opml", content: `<opml version="2.0"><body><outline text="AI &amp; Product" title="Synthetic Feed" category="Research" type="rss" xmlUrl="https://example.com/feed.xml"/></body></opml>` });
  assert.equal(result.rows.length, 1);
  assert.deepEqual([result.rows[0].type, result.rows[0].value, result.rows[0].label, result.rows[0].category, result.rows[0].status], ["rss", "https://example.com/feed.xml", "Synthetic Feed", "Research", "new"]);
});

test("OPML official adapter URLs keep their source type and ambiguous rows require mapping", () => {
  const channel = "UCabcdefghijklmnopqrstuvwxyz123456";
  const result = parseSourceImport({ format: "opml", content: `<opml><body>
    <outline title="GitHub Releases" xmlUrl="https://github.com/owner/repo/releases"/>
    <outline title="YouTube" xmlUrl="https://www.youtube.com/feeds/videos.xml?channel_id=${channel}"/>
    <outline title="Ambiguous" xmlUrl="https://github.com/owner/repo/issues"/>
  </body></opml>` });
  assert.deepEqual(result.rows.map((row) => [row.type, row.value, row.status]), [
    ["github_releases", "owner/repo", "new"], ["youtube_channel", channel, "new"], [null, "https://github.com/owner/repo/issues", "needs_map"],
  ]);
});

test("CSV requires editable source-column mapping and handles quoted commas", () => {
  const content = `Feed URL,Name,Folder,Adapter\nhttps://example.com/feed.xml,"Synthetic, Feed",AI PM,rss`;
  const pending = parseSourceImport({ format: "csv", content });
  assert.equal(pending.mapping_required, true);
  assert.deepEqual(pending.suggested, { url: "Feed URL", title: "Name", handle: "", adapter_type: "Adapter", category: "Folder" });
  const result = parseSourceImport({ format: "csv", content, mapping: pending.suggested });
  assert.deepEqual([result.rows[0].value, result.rows[0].label, result.rows[0].category, result.rows[0].status], ["https://example.com/feed.xml", "Synthetic, Feed", "AI PM", "new"]);
});

test("multi URL text preserves X/RSS recognition and canonical duplicates", () => {
  const result = parseSourceImport({ format: "text", content: "https://example.com/feed.xml?utm_source=test\nhttps://example.com/feed.xml\n@SyntheticPM" });
  assert.deepEqual(result.rows.map((row) => row.status), ["new", "duplicate_in_batch", "new"]);
  assert.equal(result.rows[2].value, "@SyntheticPM");
  assert.equal(canonicalSourceValue("x", "@SyntheticPM"), "syntheticpm");
});

test("text preview recognizes official adapters and marks ambiguous or unsafe values", () => {
  const channel = "UCabcdefghijklmnopqrstuvwxyz123456";
  const result = parseSourceImport({ format: "text", content: [
    "https://example.com/feed.xml", "@SyntheticPM", "owner/repo", "https://github.com/owner/repo/releases",
    channel, `https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`,
    "github_search: AI product management", "https://github.com/search?q=AI+product+management",
    "https://x.com/example/status/123", "https://x.com/home", "https://twitter.com/search?q=ai",
    "https://github.com/owner/repo/issues", "https://www.youtube.com/watch?v=synthetic", "https://127.0.0.1/feed.xml",
  ].join("\n") });
  assert.deepEqual(result.rows.map((row) => [row.type, row.status]), [
    ["rss", "new"], ["x", "new"], ["github_releases", "new"], ["github_releases", "duplicate_in_batch"],
    ["youtube_channel", "new"], ["youtube_channel", "duplicate_in_batch"],
    ["github_search", "new"], ["github_search", "duplicate_in_batch"],
    [null, "needs_map"], [null, "needs_map"], [null, "needs_map"], [null, "needs_map"], [null, "needs_map"], [null, "invalid"],
  ]);
  assert.equal(result.rows[8].error, "needs_map");
  assert.equal(result.rows[10].error, "needs_map");
  assert.equal(result.rows[13].error, "unsafe_or_invalid_url");
});

test("CSV source mapping infers repository, channel and RSS types, while explicit search stays bounded", () => {
  const csv = "Source,Adapter\nowner/repo,\nUCabcdefghijklmnopqrstuvwxyz123456,\nhttps://example.test/feed.xml,\nAI product management,github_search";
  const mapping = { url: "Source", adapter_type: "Adapter" };
  const result = parseSourceImport({ format: "csv", content: csv, mapping });
  assert.deepEqual(result.rows.map((row) => [row.type, row.value, row.status]), [
    ["github_releases", "owner/repo", "new"], ["youtube_channel", "UCabcdefghijklmnopqrstuvwxyz123456", "new"],
    ["rss", "https://example.test/feed.xml", "new"], ["github_search", "AI product management", "new"],
  ]);
});

test("invalid, unsafe, malformed, and oversized imports fail closed", () => {
  assert.equal(parseSourceImport({ format: "opml", content: "<!DOCTYPE opml [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><opml/>" }).error, "opml_unsafe_declaration");
  assert.equal(parseSourceImport({ format: "csv", content: "url,title\nhttps://example.test,x", mapping: { title: "title" } }).error, "csv_mapping_missing_source");
  assert.equal(parseSourceImport({ format: "text", content: "http://127.0.0.1/feed.xml" }).rows[0].status, "invalid");
  assert.equal(parseSourceImport({ format: "text", content: "x".repeat(1_000_001) }).error, "import_too_large");
  assert.equal(parseSourceImport({ format: "text", content: Array.from({ length: 101 }, (_, i) => `https://example.test/${i}.xml`).join("\n") }).error, "import_too_many_rows");
});
