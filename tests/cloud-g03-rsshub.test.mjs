import assert from "node:assert/strict";
import test from "node:test";
import { collect, HN_URL } from "../cloud/src/collector.mjs";
import { canonicalSourceValue, parseSourceImport, resolveRsshubUrl } from "../cloud/src/source-import.mjs";
import { fetchRestricted, RADAR_FETCH_HOSTS } from "../cloud/src/safe-fetch.mjs";
import { handle } from "../cloud/src/worker.mjs";
import { accessKit, fakeD1, ownerHash, TEAM, AUD } from "./helpers/cloud-fakes.mjs";

const access = accessKit();
const authFetch = async () => new Response(access.jwks, { headers: { "content-type": "application/json" } });
const env = () => ({ DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash });
const request = (path, body) => new Request(`https://radar.example${path}`, { method: body ? "POST" : "GET", headers: { "Cf-Access-Jwt-Assertion": access.token(), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });

test("RSSHub source imports normalize routes, deduplicate, and reject unsafe syntax", () => {
  const parsed = parseSourceImport({ format: "text", content: " RSSHUB://github/release/owner/repo/ \nrsshub:///github/release/owner/repo" });
  assert.deepEqual(parsed.rows.map(({ type, value, canonical_value, status }) => [type, value, canonical_value, status]), [
    ["rss", "rsshub://github/release/owner/repo", "rsshub://github/release/owner/repo", "new"],
    ["rss", "rsshub://github/release/owner/repo", "rsshub://github/release/owner/repo", "duplicate_in_batch"],
  ]);
  for (const value of ["rsshub://", "rsshub:///", "rsshub://../etc/passwd", "rsshub://%2e%2e/etc", "rsshub://user:pass@evil.com/x", "rsshub://github/a b", "rsshub://github/feed?x=1"]) {
    assert.equal(parseSourceImport({ format: "text", content: value }).rows[0].status, "invalid", value);
  }
  assert.equal(canonicalSourceValue("rss", "RSSHUB:///threads/user/handle/"), "rsshub://threads/user/handle");
});

test("CSV and OPML accept RSSHub as the existing RSS adapter type", () => {
  const csv = parseSourceImport({ format: "csv", content: "Source,Adapter\nrsshub://github/release/owner/repo,", mapping: { url: "Source", adapter_type: "Adapter" } });
  const opml = parseSourceImport({ format: "opml", content: '<opml><body><outline title="Synthetic" xmlUrl="rsshub:///threads/user/handle/"/></body></opml>' });
  assert.deepEqual(csv.rows.map(({ type, value, status }) => [type, value, status]), [["rss", "rsshub://github/release/owner/repo", "new"]]);
  assert.deepEqual(opml.rows.map(({ type, value, status }) => [type, value, status]), [["rss", "rsshub://threads/user/handle", "new"]]);
});

test("RSSHub base resolution requires safe configured HTTPS and returns a useful missing-config error", () => {
  assert.deepEqual(resolveRsshubUrl("rsshub://threads/user/handle", {}), {
    error: "rsshub_base_url_not_configured", hint: "請先設定 RSSHUB_BASE_URL，才能讀取 rsshub:// 來源。",
  });
  assert.equal(resolveRsshubUrl("rsshub://threads/user/handle", { RSSHUB_BASE_URL: "http://rsshub.example.test" }).error, "rsshub_base_url_invalid");
  assert.equal(resolveRsshubUrl("rsshub://threads/user/handle", { RSSHUB_BASE_URL: "https://user:pass@rsshub.example.test" }).error, "rsshub_base_url_invalid");
  assert.deepEqual(resolveRsshubUrl("rsshub:///threads/user/handle/", { RSSHUB_BASE_URL: " https://rsshub.example.test/base/// " }), {
    url: "https://rsshub.example.test/base/threads/user/handle", hostname: "rsshub.example.test",
  });
});

test("configured RSSHub host is narrowly allowlisted while arbitrary and private hosts stay blocked", async () => {
  const configured = resolveRsshubUrl("rsshub://threads/user/handle", { RSSHUB_BASE_URL: "https://rsshub.example.test" });
  const allowedHosts = new Set([...RADAR_FETCH_HOSTS, configured.hostname]);
  const fetched = await fetchRestricted(async () => new Response("feed", { headers: { "content-type": "application/rss+xml" } }), configured.url, { allowedHosts, allowedMime: ["application/rss+xml"] });
  assert.equal(fetched.response.status, 200);
  assert.equal((await fetchRestricted(async () => new Response("unexpected"), "https://other.example.test/feed", { allowedHosts })).error, "unsupported_host");
  assert.equal((await fetchRestricted(async () => new Response("unexpected"), "https://127.0.0.1/feed", { allowedHosts })).error, "unsupported_host");
});

test("source-import preview and confirmed import identify equivalent RSSHub routes as existing", async () => {
  const e = env();
  const post = (path, body) => handle(request(path, body), e, { authFetch });
  const input = { format: "text", content: "RSSHUB://github/release/owner/repo/" };
  const firstPreview = await post("/api/source-imports/preview", input);
  assert.equal((await firstPreview.json()).preview[0].status, "new");
  const created = await post("/api/source-imports", { ...input, confirm: true });
  const jobId = (await created.json()).job.id;
  await post(`/api/source-imports/${jobId}/run`, {});
  const secondPreview = await post("/api/source-imports/preview", { ...input, content: "rsshub:///github/release/owner/repo" });
  assert.equal((await secondPreview.json()).preview[0].status, "exists");
  const duplicate = await post("/api/source-imports", { ...input, confirm: true });
  const duplicateJob = (await duplicate.json()).job.id;
  await post(`/api/source-imports/${duplicateJob}/run`, {});
  const result = await post(`/api/source-imports/${duplicateJob}`, null);
  assert.equal((await result.json()).job.rows[0].status, "exists");
});

test("legacy bulk-source preview validates RSSHub through the configured base", async () => {
  const e = env(); e.RSSHUB_BASE_URL = "https://rsshub.example.test";
  const response = await handle(request("/api/sources/bulk", { text: "rsshub:///threads/user/handle/" }), e, {
    authFetch,
    fetchImpl: async (url) => {
      assert.equal(String(url), "https://rsshub.example.test/threads/user/handle");
      return new Response("<rss><channel></channel></rss>", { headers: { "content-type": "application/rss+xml" } });
    },
  });
  const preview = await response.json();
  assert.equal(preview.preview[0].status, "new");
  assert.equal(preview.preview[0].value, "rsshub://threads/user/handle");
});

test("collector resolves RSSHub through the RSS pipeline and reuses HTTP validators", async () => {
  const db = fakeD1(), target = "https://rsshub.example.test/base/github/release/owner/repo";
  const calls = [];
  const fetchImpl = async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl === HN_URL) return Response.json({ hits: [] });
    if (requestUrl === target) {
      calls.push(init.headers);
      if (init.headers["if-none-match"]) return new Response(null, { status: 304, headers: { etag: '"g3-v1"', "last-modified": "Wed, 11 Nov 2026 00:00:00 GMT" } });
      return new Response('<rss><channel><item><title>Synthetic release</title><link>https://example.test/release</link></item></channel></rss>', {
        headers: { "content-type": "application/rss+xml", etag: '"g3-v1"', "last-modified": "Wed, 11 Nov 2026 00:00:00 GMT" },
      });
    }
    return new Response("<rss><channel></channel></rss>", { headers: { "content-type": "application/rss+xml" } });
  };
  const sources = [{ id: "rsshub-fixture", type: "rss", value: "rsshub://github/release/owner/repo", label: "RSSHub fixture" }];
  const first = await collect(fetchImpl, sources, { db, rsshubBaseUrl: "https://rsshub.example.test/base/" });
  assert.ok(first.some((item) => item.title === "Synthetic release"));
  assert.deepEqual({ ...db.raw.prepare("SELECT url,etag,last_modified FROM source_http_cache WHERE source_key='source:rsshub-fixture'").get() }, {
    url: target, etag: '"g3-v1"', last_modified: "Wed, 11 Nov 2026 00:00:00 GMT",
  });
  const second = await collect(fetchImpl, sources, { db, rsshubBaseUrl: "https://rsshub.example.test/base" });
  assert.equal(second.length, 0);
  assert.equal(calls.length, 2);
  assert.equal(calls[1]["if-none-match"], '"g3-v1"');
  assert.equal(calls[1]["if-modified-since"], "Wed, 11 Nov 2026 00:00:00 GMT");
});

test("missing RSSHub config reports its code and hint without requesting RSSHub", async () => {
  const requested = [], errors = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    if (String(url) === HN_URL) return Response.json({ hits: [] });
    return new Response("<rss><channel></channel></rss>", { headers: { "content-type": "application/rss+xml" } });
  };
  await collect(fetchImpl, [{ id: "missing-config", type: "rss", value: "rsshub://threads/user/handle" }], { onError: (error) => errors.push(error) });
  assert.ok(!requested.some((url) => url.includes("rsshub")));
  assert.ok(errors.some((error) => error.error === "rsshub_base_url_not_configured" && error.hint.includes("RSSHUB_BASE_URL")));
});
