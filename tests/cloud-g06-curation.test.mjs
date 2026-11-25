import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handle } from "../cloud/src/worker.mjs";
import { runDaily } from "../cloud/src/collector.mjs";
import { scoreLane } from "../cloud/src/curation.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/g06-curation-marked.synthetic.json", import.meta.url), "utf8"));
const kit = accessKit();
const authFetch = async () => new Response(kit.jwks, { headers: { "content-type": "application/json" } });
const env = () => ({ DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash });
const req = (path, body) => new Request(`https://radar.example${path}`, { method: body ? "POST" : "GET", headers: { "Cf-Access-Jwt-Assertion": kit.token(), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });

test("G06 marked synthetic fixture distinguishes useful, noisy, boundary, title-less and unknown content", () => {
  const results = fixture.map((item) => ({ item, score: scoreLane({ title: item.title, raw_excerpt: item.value }) }));
  for (const { item, score } of results) {
    assert.equal(score.curation_status, item.expected_curation, item.id);
    assert.equal(score.pref_breakdown.dimensions.relevance.status, item.expected_relevance, item.id);
    assert.ok(score.pref_breakdown.dimensions.novelty.status === "unknown", item.id);
  }
  const unknown = results.find(({ item }) => item.id === "unknown-topic-zh").score;
  assert.equal(unknown.pref_score, 0); // storage-compatible value is not surfaced as a score
  assert.equal(unknown.curation_reason, "relevance_unknown");
  assert.equal(results.find(({ item }) => item.id === "boundary-free-course").score.pref_breakdown.dimensions.relevance.score, 0);
  assert.ok(results.find(({ item }) => item.id === "boundary-free-course").score.pref_breakdown.dimensions.relevance.evidence.includes("free_resource_lane"));
  assert.equal(results.filter(({ item, score }) => item.expected_curation === "quarantine" && score.curation_status === "quarantine").length, 3);
  assert.equal(results.filter(({ item, score }) => item.expected_curation === "main" && score.curation_status === "main").length, 2);
});

test("unknown relevance is quarantined, releasable, audited, and not editorial approval", async () => {
  const e = env();
  const imported = await handle(req("/api/inbox/import", fixture.map(({ title, value }) => ({ title, value }))), e, { authFetch });
  assert.equal(imported.status, 201);
  const { ids } = await imported.json();
  const now = new Date().toISOString(), day = now.slice(0, 10);
  e.DB.raw.prepare("UPDATE items SET kind='daily',run_date=? WHERE id IN (" + ids.map(() => "?").join(",") + ")").run(day, ...ids);

  const main = await (await handle(req("/api/daily"), e, { authFetch })).json();
  assert.equal(main.items.length, 2);
  assert.ok(main.items.every((item) => item.curation_status === "main"));
  assert.equal(main.quarantine_count, 3);

  const held = await (await handle(req("/api/daily?quarantine=1"), e, { authFetch })).json();
  assert.equal(held.mode, "quarantine");
  assert.equal(held.items.length, 3);
  const unknown = held.items.find((item) => item.title === "相機曝光補償設定筆記");
  assert.equal(unknown.pref_score, null);
  assert.equal(unknown.curation_status, "quarantine");
  assert.equal(unknown.status, "draft");
  assert.equal(unknown.review_status, "NEEDS_SOURCE_REVIEW");
  assert.equal(unknown.claim_status, "unverified");

  const released = await handle(req(`/api/items/${unknown.id}/action`, { action: "release_quarantine" }), e, { authFetch });
  assert.equal(released.status, 200);
  const result = await released.json();
  assert.equal(result.item.curation_status, "released");
  assert.equal(result.editorial_status_unchanged, true);
  assert.equal(result.item.status, "draft");
  assert.equal(result.item.review_status, "NEEDS_SOURCE_REVIEW");
  assert.equal(result.item.claim_status, "unverified");
  assert.equal(e.DB.raw.prepare("SELECT COUNT(*) n FROM item_curation_actions WHERE item_id=? AND action='release_quarantine'").get(unknown.id).n, 1);
  assert.equal((await (await handle(req("/api/daily"), e, { authFetch })).json()).items.length, 3);
  assert.equal(e.DB.raw.prepare("SELECT COUNT(*) n FROM items").get().n, 5);
});

test("RSS body evidence is scored even when the headline has no mapped term", async () => {
  const e = env(); e.AI_ANALYSIS_ENABLED = "false";
  const feed = `<rss><channel><item><title>Update</title><link>https://synthetic.example/body-signal</link><description>A fictional team tested a paid pilot and documented customer willingness to pay.</description></item></channel></rss>`;
  const result = await runDaily(e, { fetchImpl: async (url) => String(url).includes("algolia") ? Response.json({ hits: [] }) : new Response(feed) });
  assert.equal(result.collected, 1);
  const row = await e.DB.prepare("SELECT raw_excerpt,curation_status,pref_breakdown FROM items WHERE url='https://synthetic.example/body-signal'").first();
  assert.match(row.raw_excerpt, /paid pilot/u);
  assert.equal(row.curation_status, "main");
  assert.ok(JSON.parse(row.pref_breakdown).dimensions.relevance.evidence.includes("paid_pilot"));
});

test("card exposes dimension uncertainty, feedback reasons, and explicit quarantine release copy", () => {
  const app = readFileSync(new URL("../cloud/public/app.js", import.meta.url), "utf8");
  assert.match(app, /未知／未評/u);
  assert.match(app, /人工放行至主列表/u);
  assert.match(app, /放行只會把素材移出隔離清單/u);
  assert.match(app, /train_reasons/u);
  assert.match(app, /隔離待判斷/u);
});
