import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../cloud/src/worker.mjs";
import { formatDigestMarkdown } from "../cloud/public/digest-markdown.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";

const kit = accessKit();
const nowMs = Date.parse("2026-11-26T16:00:00Z"); // HKT November 27, midnight.
const deps = { authFetch: async () => new Response(kit.jwks), nowMs,
  fetchImpl: async () => { throw new Error("AI/network must not be called"); } };
const makeEnv = () => ({ DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash });
const request = (query = "", method = "GET", authenticated = true, token = kit.token({ iat: nowMs / 1000 - 10, exp: nowMs / 1000 + 600 })) => new Request(`https://radar.example/api/digest${query}`, { method, headers: authenticated ? { "Cf-Access-Jwt-Assertion": token } : {} });
const get = async (env, query = "") => {
  const response = await handle(request(query), env, deps); assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store"); return response.json();
};
function add(env, id, item = {}, kb = {}) {
  const at = "2026-11-26T16:00:00Z";
  const row = { id, kind: "daily", status: "approved", title: `Signal ${id}`, url: `https://example.test/${id}`, source: "Synthetic source", lane: "TECH_NEWS", score: 8,
    summary: "Approved takeaway", key_points: '["First point","Second point"]', published_at: at, created_at: at, updated_at: at,
    curation_status: "main", injection_suspect: 0, raw_excerpt: "PRIVATE_RAW", ...item };
  env.DB.raw.prepare(`INSERT INTO items(${Object.keys(row)}) VALUES(${Object.keys(row).map(() => "?")})`).run(...Object.values(row));
  if (kb === null) return;
  const entry = { id: `kb-${id}`, item_id: id, title: "PRIVATE_KB_TITLE", summary: "PRIVATE_KB_SUMMARY", note: "PRIVATE_NOTE", tags: '["AI PM"]', origin: "approved", kb_type: "item", created_at: at, updated_at: at, ...kb };
  env.DB.raw.prepare(`INSERT INTO kb_entries(${Object.keys(entry)}) VALUES(${Object.keys(entry).map(() => "?")})`).run(...Object.values(entry));
}

test("G05 Access is mandatory, including legacy digest and static formatter; machine credentials cannot enter", async () => {
  const env = makeEnv(); env.DB = { prepare() { throw new Error("D1 must not be touched"); } };
  for (const query of ["", "?window=weekly", "?days=7"]) assert.equal((await handle(request(query, "GET", false), env, deps)).status, 401);
  assert.equal((await handle(request("", "GET", true, "invalid.jwt.value"), env, deps)).status, 401);
  assert.equal((await handle(request("", "GET", true, kit.token({ email: "other@example.test", exp: nowMs / 1000 + 600, iat: nowMs / 1000 - 10 })), env, deps)).status, 401);
  assert.equal((await handle(new Request("https://radar.example/api/digest", { headers: { authorization: "Bearer synthetic-machine-token" } }), env, deps)).status, 401);
  assert.equal((await handle(new Request("https://radar.example/digest-markdown.mjs"), env, deps)).status, 401);
  assert.equal((await handle(new Request("https://radar.example/api/public/digest"), env, deps)).status, 401);
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]) {
    const response = await handle(request("", method), env, deps);
    assert.equal(response.status, 405, method); assert.equal(response.headers.get("allow"), "GET");
  }
});

test("G05 daily uses HKT boundaries, score order, top three and count/score lane ordering", async () => {
  const env = makeEnv();
  add(env, "before", { published_at: "2026-11-26T15:59:59Z", score: 10 });
  add(env, "start", { score: 9, lane: "APPLY_NOW" });
  add(env, "second", { score: 8, lane: "APPLY_NOW" });
  add(env, "best", { score: 10, lane: "CONTENT_WORKFLOW", published_at: "2026-11-27T15:59:59Z" });
  add(env, "fourth", { score: 7, lane: "GITHUB_PROJECT" });
  add(env, "after", { published_at: "2026-11-27T16:00:00Z", score: 10 });
  const d = await get(env, "?date=2026-11-27");
  assert.equal(d.window, "daily"); assert.equal(d.timezone, "Asia/Hong_Kong"); assert.equal(d.date_label, "2026-11-27");
  assert.equal(d.generated_at, new Date(nowMs).toISOString()); assert.equal(d.total_items, 4); assert.equal(d.fallback_used, false);
  assert.deepEqual(d.top_highlights.map((i) => i.title), ["Signal best", "Signal start", "Signal second"]);
  assert.deepEqual(d.lanes.map((l) => [l.lane, l.count]), [["APPLY_NOW", 2], ["CONTENT_WORKFLOW", 1], ["GITHUB_PROJECT", 1]]);
  assert.deepEqual(d.lanes[0].items.map((i) => i.score), [9, 8]);
  assert.equal((await get(env, "?date=2026-11-27&lane=APPLY_NOW&limit=1")).total_items, 1);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM ai_usage").get().n, 0); assert.equal(d.ai_calls, 0);
});

test("G05 weekly covers seven HKT calendar days inclusively, without daily fallback", async () => {
  const env = makeEnv();
  add(env, "before", { published_at: "2026-11-20T15:59:59Z" });
  add(env, "start", { published_at: "2026-11-20T16:00:00Z" });
  add(env, "end", { published_at: "2026-11-27T15:59:59Z" });
  add(env, "after", { published_at: "2026-11-27T16:00:00Z" });
  const d = await get(env, "?window=weekly&date=2026-11-27");
  assert.equal(d.date_label, "2026-11-21 ~ 2026-11-27"); assert.equal(d.total_items, 2); assert.equal(d.fallback_used, false);
  assert.equal((await get(env, "?window=weekly&date=2020-01-01")).total_items, 0);
});

test("G05 default HKT today falls back to latest eligible day, respects lane, handles date-less rows and empty store", async () => {
  const env = makeEnv();
  add(env, "old", { published_at: "2026-11-24T16:00:00Z", lane: "APPLY_NOW" });
  add(env, "recent", { published_at: null, run_date: "2026-11-26", created_at: "2026-11-27T16:00:00Z" });
  add(env, "future", { published_at: "2026-11-28T00:00:00Z" });
  add(env, "private-today", {}, { origin: "manual" });
  const d = await get(env); assert.equal(d.date_label, "2026-11-26"); assert.equal(d.fallback_used, true); assert.equal(d.total_items, 1);
  assert.equal((await get(env, "?lane=APPLY_NOW")).date_label, "2026-11-25");
  assert.equal((await get(env, "?date=2026-11-27")).fallback_used, false);
  const empty = await get(makeEnv()); assert.equal(empty.total_items, 0); assert.equal(empty.fallback_used, true); assert.deepEqual(empty.lanes, []);
  add(env, "created", { published_at: null, run_date: null, created_at: "2026-11-26T16:00:00Z" });
  assert.equal((await get(env)).fallback_used, false);
});

test("G05 rejects invalid filters and dates; default 30 and hard maximum 60 are deterministic", async () => {
  const env = makeEnv();
  for (const query of ["?window=yearly", "?window=", "?date=2026-02-30", "?date=2026-13-01", "?date=26-11-27", "?date=", "?lane=unknown", "?lane=%27%20OR%201=1--", "?limit=0", "?limit=-1", "?limit=1.5", "?limit=NaN", "?limit=1e2", "?limit=", "?limit=9999999999999999999"]) assert.equal((await handle(request(query), env, deps)).status, 400, query);
  for (let i = 0; i < 65; i++) add(env, `item-${String(i).padStart(2, "0")}`);
  assert.equal((await get(env)).total_items, 30);
  const capped = await get(env, "?limit=100"); assert.equal(capped.total_items, 60); assert.equal(capped.top_highlights.length, 3);
  assert.equal(capped.lanes[0].count, 60);
  assert.deepEqual(await get(env), await get(env));
});

test("G05 both digest contracts exclude private/manual, notes, rejected, quarantined, suspect and unapproved material", async () => {
  const env = makeEnv(); add(env, "public"); add(env, "released", { curation_status: "released" });
  for (const status of ["draft", "reviewed", "rejected"]) add(env, status, { status });
  for (const origin of ["manual", "star"]) add(env, origin, {}, { origin });
  for (const kb_type of ["note", "synthesis"]) add(env, kb_type, {}, { kb_type });
  add(env, "no-kb", {}, null); add(env, "quarantine", { curation_status: "quarantine" });
  add(env, "suspect", { injection_suspect: 1 }); add(env, "dismissed", { dismissed_reason: "other" });
  add(env, "capture", { kind: "capture" }); add(env, "library", { kind: "library" });
  const d = await get(env);
  assert.deepEqual(d.lanes.flatMap((l) => l.items.map((i) => i.title)), ["Signal public", "Signal released"]);
  assert.deepEqual(Object.keys(d.top_highlights[0]).sort(), ["title", "url", "source", "lane", "score", "summary", "key_points", "tags", "published_at"].sort());
  for (const query of ["", "?window=weekly", "?days=7"]) {
    const body = await get(env, query), serialized = JSON.stringify(body);
    for (const secret of ["PRIVATE_RAW", "PRIVATE_NOTE", "PRIVATE_KB_TITLE", "PRIVATE_KB_SUMMARY", "Signal rejected", "Signal quarantine", "Signal manual", "Signal note"]) assert.ok(!serialized.includes(secret), secret);
  }
  const malformed = makeEnv(); add(malformed, "bad-json", { key_points: '{"secret":"PRIVATE"}' }, { tags: '["safe",{"secret":"PRIVATE"}]' });
  const safe = (await get(malformed)).top_highlights[0]; assert.deepEqual(safe.key_points, []); assert.deepEqual(safe.tags, ["safe"]);
});

test("G05 database failure returns sanitized no-store error", async () => {
  const env = makeEnv(); env.DB = { prepare() { throw new Error("PRIVATE_DB_ERROR"); } };
  const response = await handle(request(), env, deps); assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store"); assert.deepEqual(await response.json(), { error: "digest_unavailable" });
});

test("G05 Markdown headers, lane groups, highlights, indentation and escaping are deterministic", () => {
  const item = { title: "A [title]\nwith *markup*", url: "https://example.test/a(b)?q=x", score: 9, source: "Source", summary: "One\nline <script>", key_points: ["Point [one]"] };
  const d = { window: "daily", date_label: "2026-11-27", total_items: 1, top_highlights: [item], lanes: [{ lane: "TECH_NEWS", items: [item] }] };
  const md = formatDigestMarkdown(d); assert.equal(md, formatDigestMarkdown(d));
  assert.match(md, /^# AI PM Radar 今日晨報（2026-11-27 HKT）/u);
  assert.ok(md.includes("共 1 則訊號｜涵蓋 1 個 Research Lane")); assert.ok(md.includes("## Top 3 重點快覽")); assert.ok(md.includes("## TECH\\_NEWS"));
  assert.ok(md.includes("[A \\[title\\] with \\*markup\\*](https://example.test/a%28b%29?q=x)"));
  assert.ok(md.includes("  - Point \\[one\\]")); assert.ok(md.includes("One line &lt;script&gt;"));
  assert.match(formatDigestMarkdown({ ...d, window: "weekly", date_label: "2026-11-21 ~ 2026-11-27" }), /^# AI PM Radar 每週精選週報（2026-11-21 ~ 2026-11-27）/u);
  for (const url of ["javascript:alert(1)", "data:text/html,bad", "https://user:password@example.test", "invalid"]) {
    const bad = formatDigestMarkdown({ ...d, lanes: [{ lane: "safe", items: [{ ...item, url }] }], top_highlights: [] });
    assert.ok(!bad.includes(url));
  }
  for (const empty of [undefined, null, {}, { total_items: 0, lanes: [], top_highlights: [] }]) assert.match(formatDigestMarkdown(empty), /暫無已批准的可分享訊號/u);
});
