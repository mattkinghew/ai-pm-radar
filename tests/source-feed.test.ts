import assert from "node:assert/strict";
import test from "node:test";

import { parseFeedXml } from "../lib/source-feed-parser.ts";
import { mergeFeedItems, mergeRuntimeSubscriptionMetadata, parseSourceFeeds, serializeSourceFeeds, type FeedItem, type SourceSubscription } from "../lib/source-feed.ts";

const feedUrl = "https://example.com/feed.xml";

test("parses RSS CDATA, namespace author, and relative article URLs", () => {
  const result = parseFeedXml(`<?xml version="1.0"?><rss version="2.0"><channel><title>Research feed</title><link>https://example.com/</link><item><guid>entry-1</guid><title><![CDATA[First &amp; useful]]></title><link>/articles/one?utm_source=test&amp;ref=keep</link><dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Author A</dc:creator><pubDate>Tue, 15 Sep 2026 12:00:00 GMT</pubDate><description><![CDATA[Short summary]]></description></item></channel></rss>`, feedUrl, "sub_1", "2026-09-19T00:00:00.000Z");
  assert.equal(result.format, "rss");
  assert.equal(result.items[0]?.article_url, "https://example.com/articles/one?ref=keep");
  assert.equal(result.items[0]?.creator, "Author A");
  assert.equal(result.items[0]?.content_kind, "summary");
  assert.equal(result.items[0]?.summary, "Short summary");
});

test("parses Atom links and full content without treating feed summary as article text", () => {
  const result = parseFeedXml(`<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom feed</title><link href="/home"/><entry><id>tag:example.com,2026:one</id><title>Atom one</title><link rel="alternate" href="/one"/><author><name>Author B</name></author><published>2026-09-18T10:00:00Z</published><summary>Preview only</summary><content><![CDATA[Full feed content]]></content></entry></feed>`, feedUrl, "sub_2");
  assert.equal(result.format, "atom");
  assert.equal(result.home_url, "https://example.com/home");
  assert.equal(result.items[0]?.article_url, "https://example.com/one");
  assert.equal(result.items[0]?.content_kind, "feed_content");
  assert.equal(result.items[0]?.content, "Full feed content");
});

test("rejects DTD/entity input and preserves only allowed tracking removal", () => {
  assert.throws(() => parseFeedXml("<!DOCTYPE feed [<!ENTITY x 'bad'>]><rss><channel><item><title>&x;</title></item></channel></rss>", feedUrl, "sub_1"), /DTD|entities/i);
});

test("deduplicates within a feed and across feeds without overwriting existing material", () => {
  const item = (overrides: Partial<FeedItem> = {}): FeedItem => ({
    id: "feed_1", feed_url: feedUrl, source_id: "sub_1", item_id: "guid-1", article_url: "https://example.com/article", title: "Original", creator: null, published_at: null, updated_at: null, summary: "Original summary", content: null, content_kind: "summary", discovered_at: "2026-09-19T00:00:00.000Z", source_refs: [{ source_id: "sub_1", feed_url: feedUrl, item_id: "guid-1" }], ...overrides,
  });
  const existing = item({ summary: "Human preserved summary" });
  const result = mergeFeedItems([existing], [item({ title: "Feed update", summary: "New feed summary", updated_at: "2026-09-20T00:00:00.000Z" }), item({ feed_url: "https://other.example/feed", source_id: "sub_2", source_refs: [{ source_id: "sub_2", feed_url: "https://other.example/feed", item_id: "guid-1" }] })]);
  assert.equal(result.additions.length, 0);
  assert.equal(result.duplicates.length, 2);
  assert.equal(result.updates.length, 1);
  assert.equal(result.items.find((entry) => entry.feed_url === feedUrl)?.summary, "Human preserved summary");
  assert.equal(result.items[0]?.source_refs.length, 2);
});

test("round-trips versioned source feed backup", () => {
  const value = { subscriptions: [], items: [] };
  const parsed = parseSourceFeeds(serializeSourceFeeds(value, "2026-09-19T00:00:00.000Z"));
  assert.equal(parsed.version, 1);
  assert.equal(parsed.saved_at, "2026-09-19T00:00:00.000Z");
  assert.deepEqual(parsed.items, []);
});

test("merges runner sync metadata without overwriting browser-owned source fields", () => {
  const local: SourceSubscription = {
    id: "feed_1", name: "My source", feed_url: "https://example.com/feed.xml", expert_name: "Expert",
    reason: "Manual reason", topic_tags: ["AI PM"], priority: "high", enabled: false,
    last_attempted_at: null, last_successful_at: null, etag: null, last_modified: null, recent_runs: [],
  };
  const runtime: SourceSubscription = {
    ...local,
    name: "Stale runner name", reason: "Stale runner reason", topic_tags: ["stale"], priority: "low", enabled: true,
    last_attempted_at: "2026-09-20T01:00:00.000Z", last_successful_at: "2026-09-20T01:00:00.000Z",
    etag: "etag-2", last_modified: "Sat, 20 Sep 2026 01:00:00 GMT",
    recent_runs: [{ attempted_at: "2026-09-20T01:00:00.000Z", status: "success", added: 2, duplicates: 1, updates: 0, skipped: 0, reason: null, duration_ms: 20 }],
  };
  const [merged] = mergeRuntimeSubscriptionMetadata([local], [runtime]);
  assert.equal(merged.name, local.name);
  assert.equal(merged.reason, local.reason);
  assert.deepEqual(merged.topic_tags, local.topic_tags);
  assert.equal(merged.priority, local.priority);
  assert.equal(merged.enabled, local.enabled);
  assert.equal(merged.etag, runtime.etag);
  assert.equal(merged.recent_runs[0]?.added, 2);
  assert.strictEqual(mergeRuntimeSubscriptionMetadata([merged], [runtime])[0], merged);
});
