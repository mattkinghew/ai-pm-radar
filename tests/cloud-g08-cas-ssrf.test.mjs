import test from "node:test";
import assert from "node:assert/strict";
import { analyzePending, collect } from "../cloud/src/collector.mjs";
import { fetchRestricted } from "../cloud/src/safe-fetch.mjs";
import { hktDay } from "../cloud/src/ai.mjs";
import { handle } from "../cloud/src/worker.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";

const kit = accessKit();
const authFetch = async () => new Response(kit.jwks, { headers: { "content-type": "application/json" } });
const envFor = () => ({ DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash,
  GEMINI_API_KEY: "synthetic-only", AI_DAILY_CAP: "10", AI_ANALYSIS_ENABLED: "false" });
const ownerGet = (path) => new Request(`https://radar.example${path}`, { headers: { "Cf-Access-Jwt-Assertion": kit.token() } });
const HTML = `<html><head><title>Old source title</title></head><body><article>${Array.from({ length: 8 }, (_, i) => `<p>${"A synthetic source paragraph long enough to be extracted safely. ".repeat(2)}${i}</p>`).join("")}</article></body></html>`;

test("reader fetch discards extracted content when the source revision changes during fetch", async () => {
  const env = envFor(), url = "https://news.example.com/source-revision";
  const capture = await handle(new Request("https://radar.example/api/capture", { method: "POST", headers: { "Cf-Access-Jwt-Assertion": kit.token(), "content-type": "application/json" }, body: JSON.stringify({ url }) }), env, { authFetch });
  const { id } = await capture.json();
  const response = await handle(ownerGet(`/api/items/${id}/reader`), env, { authFetch, fetchImpl: async () => {
    await env.DB.prepare("UPDATE items SET title=?,url=?,raw_excerpt=?,updated_at=? WHERE id=?")
      .bind("Updated source title", "https://news.example.com/new-revision", "new owner text", "2026-11-21T12:34:56.000Z", id).run();
    return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
  } });
  assert.equal(response.status, 409);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM articles WHERE item_id=?").bind(id).first()).n, 0);
  const item = await env.DB.prepare("SELECT title,url,raw_excerpt FROM items WHERE id=?").bind(id).first();
  assert.equal(item.title, "Updated source title");
  assert.equal(item.url, "https://news.example.com/new-revision");
  assert.equal(item.raw_excerpt, "new owner text");
});

test("extractive analysis does not write or count a result from a stale source snapshot", async () => {
  const env = envFor(), nowMs = Date.parse("2026-11-21T12:00:00.000Z"), day = hktDay(nowMs), id = "g08-extractive-cas";
  await env.DB.prepare("INSERT INTO items(id,kind,status,title,url,source_type,raw_excerpt,run_date,created_at,updated_at,ai_eligible) VALUES(?,'daily','draft',?,'https://example.test/synthetic','rss',?,?,?, ?,1)")
    .bind(id, "合成來源", "某教育中心以合成查詢測試AI分類，結果需要人工檢查。", day, new Date(nowMs).toISOString(), new Date(nowMs).toISOString()).run();
  const prepare = env.DB.prepare.bind(env.DB); let changed = false;
  env.DB.prepare = (sql) => {
    const statement = prepare(sql);
    if (!sql.startsWith("SELECT id,title,url,source,source_type,category,raw_excerpt,lane,ai_eligible,updated_at FROM items")) return statement;
    return { bind: (...args) => {
      const bound = statement.bind(...args);
      return { all: async () => {
        const result = await bound.all();
        if (!changed) {
          changed = true;
          await prepare("UPDATE items SET raw_excerpt=?,updated_at=? WHERE id=?").bind("修訂後的合成原文", "2026-11-21T12:00:01.000Z", id).run();
        }
        return result;
      } };
    } };
  };
  const result = await analyzePending(env, { nowMs, day });
  assert.equal(result.analyzed, 0);
  const row = await prepare("SELECT raw_excerpt,summary,ai_provider,analysis_status FROM items WHERE id=?").bind(id).first();
  assert.equal(row.raw_excerpt, "修訂後的合成原文");
  assert.equal(row.summary, null);
  assert.equal(row.ai_provider, null);
});

test("unsafe redirects are rejected before the internal target is fetched", async () => {
  for (const target of ["http://127.0.0.1/admin", "https://[::1]/admin"]) {
    const env = envFor(), url = "https://news.example.com/redirect";
    const capture = await handle(new Request("https://radar.example/api/capture", { method: "POST", headers: { "Cf-Access-Jwt-Assertion": kit.token(), "content-type": "application/json" }, body: JSON.stringify({ url }) }), env, { authFetch });
    const { id } = await capture.json(); const requested = [];
    const response = await handle(ownerGet(`/api/items/${id}/reader`), env, { authFetch, fetchImpl: async (requestedUrl) => {
      requested.push(String(requestedUrl));
      return new Response(null, { status: 302, headers: { location: target } });
    } });
    const { article } = await response.json();
    assert.equal(response.status, 200);
    assert.equal(article.error, "unsafe_redirect");
    assert.deepEqual(requested, [url]);
  }
});

test("restricted fetch rejects arbitrary hosts and validates each redirect target", async () => {
  const requested = [];
  const never = await fetchRestricted(async (url) => { requested.push(String(url)); return new Response("unexpected"); }, "https://attacker-controlled.example/feed.xml");
  assert.equal(never.error, "unsupported_host");
  assert.deepEqual(requested, [], "unlisted hosts are rejected before network access");
  const redirect = await fetchRestricted(async (url, init) => {
    requested.push(String(url)); assert.equal(init.redirect, "manual");
    return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
  }, "https://openai.com/feed.xml", { allowedMime: ["application/rss+xml"] });
  assert.equal(redirect.error, "unsafe_redirect");
  assert.deepEqual(requested, ["https://openai.com/feed.xml"]);
});

test("restricted fetch does not forward authorization across hosts", async () => {
  const requested = [];
  const result = await fetchRestricted(async (url, init) => {
    requested.push({ url: String(url), authorization: init.headers.authorization });
    return new Response(null, { status: 302, headers: { location: "https://openai.com/other" } });
  }, "https://api.github.com/repos/example/example/releases", {
    headers: { authorization: "Bearer SYNTHETIC_TEST_TOKEN" },
    allowedMime: ["application/json"],
  });
  assert.equal(result.error, "unsafe_redirect");
  assert.deepEqual(requested, [{ url: "https://api.github.com/repos/example/example/releases", authorization: "Bearer SYNTHETIC_TEST_TOKEN" }]);
});

test("restricted fetch rejects HTTP entry and HTTPS downgrade", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    return new Response(null, { status: 302, headers: { location: "http://api.github.com/private" } });
  };
  const entry = await fetchRestricted(fetchImpl, "http://api.github.com/public");
  assert.equal(entry.error, "unsupported_host");
  assert.deepEqual(requested, []);
  const downgrade = await fetchRestricted(fetchImpl, "https://api.github.com/public", { headers: { authorization: "Bearer SYNTHETIC_TEST_TOKEN" } });
  assert.equal(downgrade.error, "unsafe_redirect");
  assert.deepEqual(requested, ["https://api.github.com/public"]);
});

test("restricted fetch enforces MIME, byte and timeout limits", async () => {
  const mime = await fetchRestricted(async () => new Response("<html/>", { headers: { "content-type": "text/html" } }), "https://openai.com/feed.xml", { allowedMime: ["application/rss+xml"] });
  assert.equal(mime.error, "unsupported_content_type");
  const large = await fetchRestricted(async () => new Response("12345", { headers: { "content-type": "application/rss+xml" } }), "https://openai.com/feed.xml", { allowedMime: ["application/rss+xml"], maxBytes: 4 });
  assert.equal(large.error, "response_too_large");
  const timeout = await fetchRestricted(async () => { throw new DOMException("deadline", "TimeoutError"); }, "https://openai.com/feed.xml");
  assert.equal(timeout.error, "timeout");
});

test("collector blocks custom hosts and does not follow redirects", async () => {
  const requests = [], errors = [];
  const fake = async (url, init) => {
    requests.push(String(url));
    if (String(url) === "https://openai.com/news/rss.xml") {
      assert.equal(init.redirect, "manual");
      return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
    }
    if (String(url).includes("hn.algolia.com")) return new Response('{"hits":[]}', { headers: { "content-type": "application/json" } });
    return new Response("<rss><channel/></rss>", { headers: { "content-type": "application/rss+xml" } });
  };
  await collect(fake, [{ id: "custom", type: "rss", value: "https://attacker-controlled.example/feed.xml", label: "synthetic" }], { onError: (e) => errors.push(e) });
  assert.equal(requests.includes("https://attacker-controlled.example/feed.xml"), false);
  assert.equal(requests.includes("http://127.0.0.1/private"), false);
  assert.ok(errors.some((e) => e.error === "unsafe_redirect"));
  assert.ok(errors.some((e) => e.error === "unsupported_host"));
});
