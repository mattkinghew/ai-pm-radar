import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { collect, FEEDS, HN_URL, userFeeds } from "../cloud/src/collector.mjs";
import { handle } from "../cloud/src/worker.mjs";
import { scoreLane } from "../cloud/src/curation.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";

const kit = accessKit();
const authFetch = async () => new Response(kit.jwks, { headers: { "content-type": "application/json" } });
const owner = (path, body) => new Request(`https://radar.example${path}`, {
  method: "POST",
  headers: { "Cf-Access-Jwt-Assertion": kit.token(), "content-type": "application/json" },
  body: JSON.stringify(body),
});
const ownerGet = (path) => new Request(`https://radar.example${path}`, { headers: { "Cf-Access-Jwt-Assertion": kit.token() } });

test("registry migration preserves colliding legacy rows and blocks new canonical duplicates", () => {
  const DB = new DatabaseSync(":memory:");
  for (const name of ["0001_init.sql", "0002_bilingual_provider_usage.sql", "0003_sources_x_reco.sql", "0004_x_watchlist_side_income.sql", "0005_x_watchlist_more.sql", "0006_score_feedback.sql", "0007_p0_actions_quota_kb.sql", "0008_reader_notes_synthesis.sql", "0009_quota_governor_source_correction.sql", "0010_research_lanes.sql", "0011_trainer_actions.sql", "0012_source_http_cache.sql"]) {
    DB.exec(readFileSync(new URL(`../cloud/migrations/${name}`, import.meta.url), "utf8"));
  }
  const add = DB.prepare("INSERT INTO sources(id,type,adapter_type,value,label,created_at,updated_at) VALUES(?,?,?,?,?,'2026-11-19','2026-11-19')");
  add.run("legacy-x-seed", "x", "rss", "@duplicate_fixture", "Legacy seed");
  add.run("legacy-x-route", "rss", "x", "@duplicate_fixture", "Legacy route row");
  DB.exec(readFileSync(new URL("../cloud/migrations/0013_source_registry_type_contract.sql", import.meta.url), "utf8"));

  const rows = DB.prepare("SELECT type,adapter_type FROM sources WHERE value='@duplicate_fixture' ORDER BY id").all();
  assert.equal(rows.length, 2, "migration must preserve both legacy rows");
  assert.ok(rows.every((row) => row.type === "x" && row.adapter_type === "x"));
  const duplicate = DB.prepare("INSERT INTO sources(id,type,adapter_type,value,label,created_at,updated_at) VALUES('third-copy','x','x','@duplicate_fixture','Duplicate','2026-11-19','2026-11-19')").run();
  assert.equal(duplicate.changes, 0);
  DB.close();
});

test("source registry canonicalizes legacy X rows and writes new X rows consistently", async () => {
  const DB = fakeD1();
  const sources = await userFeeds(DB);
  const legacyX = sources.filter((source) => source.value.startsWith("@"));
  assert.ok(legacyX.length > 0);
  assert.ok(legacyX.every((source) => source.type === "x"));
  assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM sources").first()).n, 11, "migration preserves enabled and disabled watchlist rows");
  assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM sources WHERE type!=adapter_type").first()).n, 0);

  const env = { DB, CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash };
  const created = [];
  for (const [type, value] of [["rss", "https://synthetic.example/feed.xml"], ["x", "synthetic_feed"], ["github_search", "synthetic query"], ["github_releases", "synthetic/repo"], ["youtube_channel", "UC1234567890123456789012"]]) {
    const response = await handle(owner("/api/sources", { type, value, label: `Synthetic ${type}` }), env, { authFetch });
    assert.equal(response.status, 201);
    const { source } = await response.json();
    assert.equal(source.type, type);
    const stored = await DB.prepare("SELECT type,adapter_type FROM sources WHERE id=?").bind(source.id).first();
    assert.equal(stored.type, type);
    assert.equal(stored.adapter_type, type);
    created.push(source.id);
  }

  const legacyDuplicate = await handle(owner("/api/sources", { type: "x", value: "MILES_MAZY" }), env, { authFetch });
  assert.equal(legacyDuplicate.status, 409);
  assert.equal((await DB.prepare(`SELECT COUNT(*) AS n FROM sources WHERE id IN (${created.map(() => "?").join(",")}) AND type=adapter_type`).bind(...created).first()).n, 5);
  const listedResponse = await handle(ownerGet("/api/sources?include_disabled=1"), env, { authFetch });
  assert.equal(listedResponse.status, 200);
  const listed = (await listedResponse.json()).sources;
  for (const id of created) {
    const source = listed.find((row) => row.id === id);
    assert.ok(source, `source ${id} missing from read API`);
    assert.equal(source.type, source.adapter_type);
  }
});

test("fixture audit finds four topics beyond the example-author watchlist without fetching X as RSS", async () => {
  const DB = fakeD1();
  const env = { DB, CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash };
  const add = (id, type, value, label) => DB.prepare(`INSERT INTO sources(id,type,adapter_type,value,label,enabled,created_at,updated_at)
    VALUES(?, ?, ?, ?, ?, 1, '2026-11-19T00:00:00Z', '2026-11-19T00:00:00Z')`).bind(id, type, type, value, label).run();
  await add("fixture-github", "github_search", "synthetic ai", "Synthetic GitHub Adapter");
  await add("fixture-youtube", "youtube_channel", "UC1234567890123456789012", "Synthetic YouTube Adapter");
  const sources = await userFeeds(DB);
  const calls = [];
  const rssByFeed = new Map([
    ["openai", ["AI model release from a synthetic lab", "https://openai.example/ai"]],
    ["simonwillison", ["Side hustle tests a productized service and pricing", "https://simonwillison.example/income"]],
    ["techcrunch-ai", ["A solopreneur builds a one-person business workflow", "https://techcrunch.example/solo"]],
    ["coursera-ai", ["Official free credits for a synthetic workshop", "https://coursera.example/free"]],
  ]);
  const fetchImpl = async (url) => {
    const target = String(url); calls.push(target);
    const builtIn = FEEDS.find((feed) => feed.url === target);
    if (builtIn && rssByFeed.has(builtIn.id)) {
      const [title, itemUrl] = rssByFeed.get(builtIn.id);
      return new Response(`<rss><channel><item><title>${title}</title><link>${itemUrl}</link><description>Synthetic fixture only</description></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } });
    }
    if (target.startsWith("https://api.github.com/search/repositories?")) return Response.json({ items: [{ full_name: "synthetic/ai", description: "Open source AI tool", stargazers_count: 1, language: "JS", pushed_at: "2026-11-19", html_url: "https://github.com/synthetic/ai" }] });
    if (target.includes("youtube.com/feeds/videos.xml")) return new Response(`<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><entry><title>Synthetic workflow video</title><link href="https://youtube.example/video"/><published>2026-11-19</published><summary>Workflow implementation</summary></entry></feed>`, { headers: { "content-type": "application/atom+xml" } });
    if (FEEDS.some((feed) => feed.url === target)) return new Response("<rss><channel/></rss>", { headers: { "content-type": "application/rss+xml" } });
    if (target === HN_URL) return Response.json({ hits: [] });
    throw new Error(`unexpected_fixture_url:${target}`);
  };

  const items = await collect(fetchImpl, sources);
  const seededHandles = sources.filter((source) => source.type === "x").map((source) => source.value);
  assert.equal(calls.some((url) => seededHandles.includes(url) || url.startsWith("@")), false, "an X handle must never become an RSS request URL");
  const expected = [
    ["AI model release", "TECH_NEWS", "openai"],
    ["Side hustle", "MONETIZATION_GAP", "simonwillison"],
    ["solopreneur", "APPLY_NOW", "techcrunch-ai"],
    ["Official free credits", "FREE_RESOURCE", "coursera-ai"],
  ];
  const topicHits = expected.map(([title, lane, source]) => {
    const item = items.find((candidate) => candidate.source === source && candidate.title.includes(title));
    assert.ok(item, `missing built-in RSS topic: ${title}`);
    assert.equal(scoreLane(item, { nowMs: Date.parse("2026-11-19T12:00:00Z") }).lane, lane);
    return { topic: title, source: item.source, lane };
  });
  assert.equal(topicHits.length, 4);
  assert.ok(items.some((item) => item.source === "Synthetic GitHub Adapter"));
  assert.ok(items.some((item) => item.source === "Synthetic YouTube Adapter"));
  const manual = await handle(owner("/api/capture", { text: "A solopreneur uses a practical workflow to manage a one-person business with a repeatable process. This synthetic note has enough context for a source capture fixture." }), env, { authFetch });
  assert.equal(manual.status, 201);
  assert.equal((await manual.json()).lane, "APPLY_NOW");
});
