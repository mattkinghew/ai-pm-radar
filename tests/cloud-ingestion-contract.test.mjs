import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handle } from "../cloud/src/worker.mjs";
import { parseFeed, runDaily } from "../cloud/src/collector.mjs";
import { collapseRepeatedParagraphs } from "../cloud/src/curation.mjs";
import { extractArticle } from "../cloud/src/reader.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";

const kit = accessKit();
const authFetch = async () => new Response(kit.jwks, { headers: { "content-type": "application/json" } });
const env = (over = {}) => ({ DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD,
  OWNER_EMAIL_SHA256: ownerHash, INGEST_TOKEN: "t".repeat(40), AI_ANALYSIS_ENABLED: "false", ...over });
const ownerReq = (path, options = {}) => new Request(`https://radar.example${path}`, { ...options,
  headers: { "Cf-Access-Jwt-Assertion": kit.token(), ...(options.headers || {}) } });
const textBody = (value) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
const duplicate = "A repeated synthetic paragraph that should appear only once in the saved preview.";

test("missing RSS title keeps its URL and labels an excerpt-derived title as inferred", () => {
  const parsed = parseFeed(`<rss><channel><item><link>https://news.example/story</link><description>${duplicate}</description></item></channel></rss>`, { id: "fixture", category: "OTHER" });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].url, "https://news.example/story");
  assert.equal(parsed[0].title, duplicate.slice(0, 160));
  assert.equal(parsed[0].title_source, "inferred");
});

test("feed ingestion stores feed title provenance and collapses repeated excerpt paragraphs", async () => {
  const database = env();
  const feed = `<rss><channel><item><title>Fixture headline</title><link>https://news.example/story</link><description><![CDATA[<p>${duplicate}</p><p>${duplicate}</p>]]></description></item></channel></rss>`;
  const fetchImpl = async (url) => String(url).includes("algolia.com") ? new Response(JSON.stringify({ hits: [] })) : new Response(feed);
  const result = await runDaily(database, { fetchImpl });
  assert.equal(result.collected, 1);
  const row = await database.DB.prepare("SELECT title_source,raw_excerpt FROM items WHERE url=?").bind("https://news.example/story").first();
  assert.equal(row.title_source, "feed");
  assert.equal(row.raw_excerpt, duplicate);
  assert.equal((await database.DB.prepare("SELECT source_type FROM items WHERE url=?").bind("https://news.example/story").first()).source_type, "rss");
});

test("X ingestion labels truncated title and collapses duplicate body paragraphs", async () => {
  const database = env(); const now = new Date().toISOString();
  await database.DB.prepare("INSERT INTO sources(id,type,value,enabled,created_at,updated_at,adapter_type) VALUES('x-fixture','x','@fixture',1,?,?,'x')").bind(now, now).run();
  const post = { handle: "fixture", post_id: "12345", text: `${duplicate}\n\n${duplicate}` };
  const response = await handle(new Request("https://radar.example/api/ingest/x", { method: "POST", headers: { authorization: `Bearer ${"t".repeat(40)}`, "content-type": "application/json" }, body: JSON.stringify({ posts: [post] }) }), database);
  assert.equal(response.status, 200);
  const row = await database.DB.prepare("SELECT id,title,title_source,source_type,raw_excerpt FROM items WHERE external_id='x:12345'").first();
  assert.equal(row.title, duplicate.slice(0, 140));
  assert.equal(row.title_source, "x_text_truncation");
  assert.equal(row.source_type, "x_post");
  assert.equal(row.raw_excerpt, duplicate);
  const item = await handle(ownerReq(`/api/items/${row.id}`), database, { authFetch }).then((r) => r.json());
  assert.equal(item.item.title_source, "x_text_truncation");
});

test("manual capture records title origin and collapses consecutive duplicate paragraphs", async () => {
  const database = env(); const repeated = `${duplicate}\n\n${duplicate}`;
  const response = await handle(ownerReq("/api/capture", textBody({ text: repeated })), database, { authFetch });
  assert.equal(response.status, 201); const { id } = await response.json();
  const row = await database.DB.prepare("SELECT title,title_source,source_type,raw_excerpt FROM items WHERE id=?").bind(id).first();
  assert.equal(row.title, duplicate.slice(0, 160));
  assert.equal(row.title_source, "inferred");
  assert.equal(row.source_type, "manual_text");
  assert.equal(row.raw_excerpt, duplicate);
  const article = await database.DB.prepare("SELECT paragraphs,title_source FROM articles WHERE item_id=?").bind(id).first();
  assert.equal(JSON.parse(article.paragraphs).length, 1);
  assert.equal(article.title_source, "inferred");
  assert.equal(collapseRepeatedParagraphs(`${duplicate}\n\n${duplicate}\n\nAnother paragraph.`), `${duplicate}\n\nAnother paragraph.`);
  const titled = await handle(ownerReq("/api/capture", textBody({ title: "Owner title", text: duplicate })), database, { authFetch });
  const titledBody = await titled.json();
  const titledRow = await database.DB.prepare("SELECT title_source FROM items WHERE id=?").bind(titledBody.id).first();
  assert.equal(titledRow.title_source, "user");
});

test("inbox import preserves canonical URL dedupe and explicit user title provenance", async () => {
  const database = env(); const body = [{ title: "Owner supplied title", url: "https://news.example/story?utm_source=fixture", text: duplicate }];
  const first = await handle(ownerReq("/api/inbox/import", textBody(body)), database, { authFetch });
  const second = await handle(ownerReq("/api/inbox/import", textBody([{ ...body[0], url: "https://news.example/story" }])), database, { authFetch });
  assert.equal((await first.json()).inserted, 1);
  assert.equal((await second.json()).duplicate, 1);
  const row = await database.DB.prepare("SELECT title_source FROM items WHERE title=?").bind("Owner supplied title").first();
  assert.equal(row.title_source, "user");
});

test("card copy separates editorial status from content review and labels the action", () => {
  const app = readFileSync(new URL("../cloud/public/app.js", import.meta.url), "utf8");
  assert.match(app, /編輯狀態：待審核/u);
  assert.match(app, /內容待人工核對/u);
  assert.match(app, /標記為已審核/u);
  assert.match(app, /由正文推定/u);
  assert.match(app, /X 正文截取（140 字）/u);
  assert.match(app, /X 完整原文（未改寫）/u);
  assert.match(app, /data-x-original/u);
});

test("reader extraction distinguishes Open Graph and page title provenance", () => {
  const content = `<article><p>${duplicate.repeat(8)}</p></article>`;
  const og = extractArticle(`<meta property="og:title" content="Open Graph title"><title>Page title</title>${content}`, "https://news.example/story");
  const page = extractArticle(`<title>Page title</title>${content}`, "https://news.example/story");
  assert.equal(og.title, "Open Graph title"); assert.equal(og.title_source, "og");
  assert.equal(page.title, "Page title"); assert.equal(page.title_source, "page");
});

test("URL reader persists extracted title provenance separately from its synthetic item title", async () => {
  const database = env(); const link = "https://news.example/og-story";
  const capture = await handle(ownerReq("/api/capture", textBody({ url: link })), database, { authFetch });
  const { id } = await capture.json();
  const html = `<html><head><meta property="og:title" content="Verified OG fixture"><title>Fallback page title</title></head><body><article><p>${duplicate.repeat(8)}</p></article></body></html>`;
  const response = await handle(ownerReq(`/api/items/${id}/reader`), database, { authFetch, fetchImpl: async () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }) });
  const article = (await response.json()).article;
  assert.equal(article.title, "Verified OG fixture");
  assert.equal(article.title_source, "og");
  const item = await database.DB.prepare("SELECT title,title_source FROM items WHERE id=?").bind(id).first();
  assert.equal(item.title_source, "synthesized");
  assert.match(item.title, /og-story/u);
});
