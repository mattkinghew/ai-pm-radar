import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handle } from "../cloud/src/worker.mjs";
import { safeFetchUrl, extractArticle, chunkParagraphs, parseSourceLines, parseNotes, discoverFeed } from "../cloud/src/reader.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";
const kit = accessKit();
const authFetch = async () => new Response(kit.jwks, { headers: { "content-type": "application/json" } });
const mkEnv = (cap = "10") => ({ DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash, GEMINI_API_KEY: "k", AI_DAILY_CAP: cap, INGEST_TOKEN: "t".repeat(40), AI_ANALYSIS_ENABLED: "false" });
const J = { "content-type": "application/json" };
const req = (p, o = {}) => new Request("https://r.x" + p, { ...o, headers: { "Cf-Access-Jwt-Assertion": kit.token(), ...(o.headers || {}) } });
const LONG = "Large language models are changing how product teams ship software, and this paragraph is long enough to count. ";
const HTML = `<html lang="en"><head><title>Agents at work | Site</title><meta property="og:site_name" content="TechSite"></head><body><nav>menu links</nav>
<article><h1>Agents at work</h1>${Array.from({ length: 12 }, (_, i) => `<p>${LONG.repeat(3)} #${i}</p>`).join("")}</article><footer>cookie</footer></body></html>`;

test("same URL manual capture preserves reader history and rejects duplicate races", async () => {
  const env = mkEnv(), calls = { ai: 0 }, url = "https://news.example.com/a", text = LONG.repeat(6);
  const first = await post(env, calls, "/api/capture", { url });
  assert.equal(first.status, 201);
  const { id } = await first.json();
  const original = await call(env, calls, `/api/items/${id}/reader`).then((r) => r.json());
  assert.equal(original.article.source_type, "selected_url");
  await env.DB.prepare("UPDATE articles SET summary=?,translation=?,translated_chunks=1,ai_provider='fixture' WHERE item_id=?")
    .bind(JSON.stringify({ tldr: "old AI" }), JSON.stringify(["old translation"]), id).run();
  await env.DB.prepare("UPDATE items SET key_points='[\"old point\"]',score=8,ai_provider='fixture',reco_score=7,reco_reason='old',side_income_new=1,side_income_reason='old' WHERE id=?").bind(id).run();
  await env.DB.prepare("UPDATE items SET metrics=json_set(metrics,'$.translation_provider','translator-other') WHERE id=?").bind(id).run();
  const enriched = await post(env, calls, "/api/capture", { url, text, source_language: "zh-Hant" });
  assert.equal(enriched.status, 200);
  assert.equal((await enriched.json()).id, id);
  const article = await call(env, calls, `/api/items/${id}/reader`).then((r) => r.json());
  assert.equal(article.article.source_type, "manual_text");
  assert.equal(article.article.language_provenance, "user_declared");
  assert.match(article.article.paragraphs[0].text, /Large language models/u);
  assert.match(JSON.stringify(article.article.capture_history), /Agents at work/u);
  assert.match(JSON.stringify(article.article.capture_history), /old AI|old translation/u);
  assert.match(JSON.stringify(article.article.capture_history), /old point/u);
  assert.match(JSON.stringify(article.article.capture_history), /translator-other/u);
  assert.equal(article.article.summary, null);
  assert.deepEqual(article.article.translation, []);
  assert.equal(article.article.ai_provider, null);
  assert.equal(article.article.original_url, url);
  const item = await env.DB.prepare("SELECT key_points,score,ai_provider,reco_score,reco_reason,side_income_new,side_income_reason FROM items WHERE id=?").bind(id).first();
  assert.equal(item.key_points, "[]"); assert.equal(item.score, null); assert.equal(item.ai_provider, "extractive");
  for (const field of ["reco_score", "reco_reason", "side_income_reason"]) assert.equal(item[field], null);
  assert.equal(item.side_income_new, 0);
  const replay = await post(env, calls, "/api/capture", { url, text, source_language: "zh-Hant" });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).result, "duplicate");
  const afterReplay = await call(env, calls, `/api/items/${id}/reader`).then((r) => r.json());
  assert.equal(afterReplay.article.capture_history.length, 1);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM items WHERE url=? AND kind='capture'").bind(url).first()).n, 1);
  assert.equal(calls.ai, 0);
  await env.DB.prepare("UPDATE items SET status='reviewed',review_status='human_reviewed',pref_score=99 WHERE id=?").bind(id).run();
  const reviewedReplay = await post(env, calls, "/api/capture", { url, text, source_language: "zh-Hant" });
  assert.equal(reviewedReplay.status, 200);
  const replayBody = await reviewedReplay.json();
  assert.equal(replayBody.status, "reviewed"); assert.equal(replayBody.review_status, "human_reviewed"); assert.equal(replayBody.pref_score, null);
  assert.equal((await env.DB.prepare("SELECT pref_score FROM items WHERE id=?").bind(id).first()).pref_score, 99); // persisted legacy scalar is hidden because no relevance breakdown supports it
  assert.equal(replayBody.source, "quick-capture"); assert.equal(replayBody.ai_provider, "extractive");
});

test("concurrent exact URL captures use SQLite uniqueness and keep one item", async () => {
  const env = mkEnv(), calls = { ai: 0 }, url = "https://news.example.com/concurrent";
  const responses = await Promise.all(Array.from({ length: 6 }, () => post(env, calls, "/api/capture", { url })));
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 200, 200, 200, 201]);
  const ids = await Promise.all(responses.map(async (r) => (await r.json()).id));
  assert.equal(new Set(ids).size, 1);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM items WHERE url=? AND kind='capture'").bind(url).first()).n, 1);
  assert.equal(calls.ai, 0);
});

test("manual history reaches an explicit cap without dropping prior revisions", async () => {
  const env = mkEnv(), calls = { ai: 0 }, url = "https://news.example.com/history";
  assert.equal((await post(env, calls, "/api/capture", { url })).status, 201);
  for (let i = 0; i < 8; i++) assert.equal((await post(env, calls, "/api/capture", { url, text: `${LONG}${i}` })).status, 200);
  const rejected = await post(env, calls, "/api/capture", { url, text: `${LONG}new` });
  assert.equal(rejected.status, 409); assert.equal((await rejected.json()).error, "capture_history_full");
  const item = await env.DB.prepare("SELECT id FROM items WHERE url=? AND kind='capture'").bind(url).first();
  const article = await call(env, calls, `/api/items/${item.id}/reader`).then((r) => r.json());
  assert.equal(article.article.capture_history.length, 8);
  assert.equal(article.article.paragraphs[0].text, `${LONG}7`);
  assert.equal(calls.ai, 0);
});

test("manual history rejects UTF-8 byte overflow before mutating the stored body", async () => {
  const env = mkEnv(), calls = { ai: 0 }, url = "https://news.example.com/utf8-history";
  assert.equal((await post(env, calls, "/api/capture", { url, text: "漢".repeat(10000) })).status, 201);
  assert.equal((await post(env, calls, "/api/capture", { url, text: "文".repeat(10000) })).status, 200);
  const rejected = await post(env, calls, "/api/capture", { url, text: "字".repeat(10000) });
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json()).error, "capture_history_full");
  const item = await env.DB.prepare("SELECT id FROM items WHERE url=? AND kind='capture'").bind(url).first();
  const article = (await call(env, calls, `/api/items/${item.id}/reader`).then((r) => r.json())).article;
  assert.equal(article.capture_history.length, 1);
  assert.equal(article.paragraphs[0].text, "文".repeat(10000));
});
const gemText = (body) => {
  const t = JSON.parse(body).contents[0].parts[0].text;
  if (t.startsWith("你是專業科技譯者")) { const n = JSON.parse(t.split("\n---\n")[1]).paragraphs.length; return { paragraphs: Array.from({ length: n }, (_, i) => `中文段落 ${i}`) }; }
  if (t.startsWith("你是 AI PM Radar 的知識編輯") && t.includes('"title_original"')) return { title_original: "Agents at work", title_zh: "代理上班", summary: "舊摘要", key_points_zh: ["一", "二", "三"], score: 5 };
  if (t.startsWith("你是 AI PM Radar 的知識編輯")) return { title_zh: "代理上班", tldr: "AI 代理改變產品團隊", key_points: ["一", "二", "三", "四"], why_ai_pm: "幫 PM 規劃", why_side_income: "可做顧問", actions: ["試用"] };
  return { title: "綜合", summary: "總結", themes: [{ name: "主題", points: ["p"] }], insights: ["洞察 [1]", "洞察 [2]", "洞察 [1][2]"], actions: ["做 A", "做 B"], open_questions: [] };
};
const mkFetch = (calls) => async (u, o) => {
  u = String(u);
  if (u.includes("generativelanguage")) { calls.ai++; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(gemText(o.body)) }] } }] })); }
  if (u.includes("openai.com/feed")) return new Response(`<?xml version="1.0"?><rss><channel><item><title>a</title></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } });
  if (u.includes("openai.com")) return new Response(`<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>`, { headers: { "content-type": "text/html" } });
  if (u.includes("paywall.example.com")) return new Response("no", { status: 403, headers: { "content-type": "text/html" } });
  if (u.includes("news.example.com")) return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
  return new Response("nf", { status: 404 });
};
const call = (env, calls, p, o) => handle(req(p, o), env, { authFetch, fetchImpl: mkFetch(calls) });
const post = (env, calls, p, b) => call(env, calls, p, { method: "POST", headers: J, body: JSON.stringify(b ?? {}) });
const deferredProvider = (calls) => {
  let release, entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  return { started, release, fetchImpl: async (url, init) => {
    if (String(url).includes("generativelanguage")) { entered(); await gate; }
    return mkFetch(calls)(url, init);
  } };
};
test("deferred reader summary cannot replace a newer manual body", async () => {
  const env = mkEnv(), calls = { ai: 0 }, url = "https://news.example.com/deferred-summary";
  const { id } = await (await post(env, calls, "/api/capture", { url, text: LONG.repeat(6) })).json();
  const pendingProvider = deferredProvider(calls);
  const pending = handle(req(`/api/items/${id}/reader/summary`, { method: "POST" }), env, { authFetch, fetchImpl: pendingProvider.fetchImpl });
  await pendingProvider.started;
  assert.equal((await post(env, calls, "/api/capture", { url, text: LONG.repeat(7) })).status, 200);
  pendingProvider.release();
  assert.equal((await pending).status, 409);
  const article = (await call(env, calls, `/api/items/${id}/reader`).then((r) => r.json())).article;
  assert.equal(article.summary, null);
  assert.equal(article.capture_history.length, 1);
});

test("deferred translation cannot erase newer manual history or language", async () => {
  const env = mkEnv(), calls = { ai: 0 }, url = "https://news.example.com/deferred-translation";
  const { id } = await (await post(env, calls, "/api/capture", { url, text: LONG.repeat(6), source_language: "en" })).json();
  const pendingProvider = deferredProvider(calls);
  const pending = handle(req(`/api/items/${id}/reader/translate`, { method: "POST" }), env, { authFetch, fetchImpl: pendingProvider.fetchImpl });
  await pendingProvider.started;
  assert.equal((await post(env, calls, "/api/capture", { url, text: LONG.repeat(7), source_language: "zh-Hant" })).status, 200);
  pendingProvider.release();
  assert.equal((await pending).status, 409);
  const article = (await call(env, calls, `/api/items/${id}/reader`).then((r) => r.json())).article;
  assert.deepEqual(article.translation, []);
  assert.equal(article.source_language, "zh-Hant");
  assert.equal(article.capture_history.length, 1);
});

test("deferred item AI cannot overwrite manual source or appear in its earlier snapshot", async () => {
  const env = mkEnv(), calls = { ai: 0 }, url = "https://news.example.com/deferred-item";
  const { id } = await (await post(env, calls, "/api/capture", { url, text: LONG.repeat(6) })).json();
  const pendingProvider = deferredProvider(calls);
  const pending = handle(req(`/api/items/${id}/deep-read`, { method: "POST" }), env, { authFetch, fetchImpl: pendingProvider.fetchImpl });
  await pendingProvider.started;
  assert.equal((await post(env, calls, "/api/capture", { url, text: LONG.repeat(7) })).status, 200);
  pendingProvider.release();
  assert.equal((await pending).status, 409);
  const item = (await call(env, calls, `/api/items/${id}`).then((r) => r.json())).item;
  assert.equal(item.ai_provider, "extractive");
  assert.equal(item.metrics.capture_history.length, 1);
});
async function addItem(env, url, excerpt = "short") {
  const id = crypto.randomUUID(), now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO items(id,kind,status,title,url,source,raw_excerpt,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id, "daily", "draft", "Agents at work", url, "rss", excerpt, now, now).run();
  return id;
}

test("safeFetchUrl blocks SSRF targets", () => {
  for (const u of ["http://127.0.0.1/", "http://localhost/x", "https://10.0.0.1", "file:///etc/passwd", "https://a.internal/", "https://a.b:8080/", "https://[::1]/"]) assert.equal(safeFetchUrl(u), null, u);
  assert.equal(safeFetchUrl("https://example.com/a?b=1"), "https://example.com/a?b=1");
});

test("extractArticle keeps article paragraphs, drops nav; chunking respects size", () => {
  const a = extractArticle(HTML, "https://news.example.com/a");
  assert.equal(a.status, "ok"); assert.ok(a.paragraphs.length >= 12); assert.ok(!a.paragraphs.some((p) => /menu links|cookie/u.test(p.text)));
  const ch = chunkParagraphs(a.paragraphs, 2500); assert.ok(ch.length >= 2); assert.equal(ch.flat().length, a.paragraphs.length);
  assert.equal(extractArticle("<html><body><p>Subscribe to continue reading</p></body></html>", "https://x.y").status !== "ok", true);
});

test("reader: fetch+cache, chunked translation, summary cached, highlights, quota error", async () => {
  const env = mkEnv("3"), calls = { ai: 0 }; const id = await addItem(env, "https://news.example.com/a");
  let r = await call(env, calls, `/api/items/${id}/reader`); assert.equal(r.status, 200); let a = (await r.json()).article;
  assert.equal(a.status, "ok"); assert.ok(a.total_chunks >= 2); assert.equal(a.translated_chunks, 0); assert.equal(calls.ai, 0, "reading costs no AI");
  r = await post(env, calls, `/api/items/${id}/reader/translate`); a = (await r.json()).article; assert.equal(r.status, 200);
  assert.equal(a.translated_chunks, Math.min(2, a.total_chunks)); assert.equal(calls.ai, a.translated_chunks); assert.match(a.translation[0], /中文段落/u);
  r = await post(env, calls, `/api/items/${id}/reader/summary`); a = (await r.json()).article; assert.equal(a.summary.tldr, "AI 代理改變產品團隊"); assert.equal(calls.ai, 3);
  r = await post(env, calls, `/api/items/${id}/reader/summary`); assert.equal((await r.json()).cached, true); assert.equal(calls.ai, 3);
  if (a.translated_chunks < a.total_chunks) { r = await post(env, calls, `/api/items/${id}/reader/translate`); const b = await r.json(); assert.equal(r.status, 429); assert.equal(b.error, "ai_daily_cap_reached"); assert.ok(b.hint); assert.ok(b.article.translation.length > 0, "partial kept"); }
  r = await post(env, calls, `/api/items/${id}/reader/highlights`, { text: "LLMs are changing product teams" }); assert.equal(r.status, 201);
  r = await call(env, calls, `/api/items/${id}/reader`); assert.equal((await r.json()).highlights.length, 1);
});

test("selected manual English body persists separately from excerpt, summary and translation", async () => {
  const env = mkEnv(), calls = { ai: 0 }, text = LONG.repeat(6);
  const captured = await post(env, calls, "/api/capture", { title: "Manual research", text, url: "https://news.example.com/manual", source_language: "en" });
  assert.equal(captured.status, 201);
  const { id } = await captured.json();
  assert.equal(calls.ai, 0);
  let article = (await call(env, calls, `/api/items/${id}/reader`).then((r) => r.json())).article;
  assert.equal(article.status, "ok");
  assert.equal(article.original_url, "https://news.example.com/manual");
  assert.equal(article.source_type, "manual_text");
  assert.equal(article.source_language, "en");
  assert.equal(article.language_provenance, "user_declared");
  assert.equal(article.paragraphs[0].text, text.trim());
  assert.ok(article.source_excerpt.length < article.paragraphs[0].text.length);
  assert.equal(article.summary, null);
  assert.equal(calls.ai, 0);
  article = (await post(env, calls, `/api/items/${id}/reader/summary`).then((r) => r.json())).article;
  assert.equal(article.summary.tldr, "AI 代理改變產品團隊");
  assert.equal(article.summary.provider, "gemini");
  assert.equal(article.summary.model, "gemini-3.5-flash-lite");
  assert.equal(article.summary.content_basis, "full_text");
  assert.equal(article.summary.source_type, "manual_text");
  assert.equal(article.ai_model, "gemini-3.5-flash-lite");
  article = (await post(env, calls, `/api/items/${id}/reader/translate`).then((r) => r.json())).article;
  assert.match(article.translation[0], /中文段落/u);
  assert.equal(article.translation_target, "body");
  assert.equal(article.translation_language, "zh-Hant");
  assert.equal(article.translation_provider, "gemini");
  assert.equal(article.translation_model, "gemini-3.5-flash-lite");
  assert.equal(article.translation_language, "zh-Hant");
  const reloaded = (await call(env, calls, `/api/items/${id}/reader`).then((r) => r.json())).article;
  assert.deepEqual(reloaded.translation, article.translation);
  assert.deepEqual(reloaded.summary, article.summary);
  assert.equal(calls.ai, 2);
});

test("RSS excerpt is never accepted or labeled as a full-text AI summary", async () => {
  const env = mkEnv(), calls = { ai: 0 }, id = await addItem(env, "https://paywall.example.com/article", "Synthetic RSS excerpt only.");
  const read = await call(env, calls, `/api/items/${id}/reader`);
  const article = (await read.json()).article;
  assert.equal(article.content_basis, "insufficient");
  assert.equal(article.source_excerpt, "Synthetic RSS excerpt only.");
  const summary = await post(env, calls, `/api/items/${id}/reader/summary`);
  const body = await summary.json();
  assert.equal(summary.status, 422);
  assert.equal(body.code, "no_full_text");
  assert.equal(article.summary, null);
  assert.equal(calls.ai, 0);
});

test("short manual body does not reach either selected AI action", async () => {
  const env = mkEnv(), calls = { ai: 0 };
  const { id } = await post(env, calls, "/api/capture", { text: "short" }).then((r) => r.json());
  assert.equal((await post(env, calls, `/api/items/${id}/reader/summary`)).status, 422);
  assert.equal((await post(env, calls, `/api/items/${id}/reader/translate`)).status, 422);
  assert.equal(calls.ai, 0);
});

test("selected URL capture extracts before AI and keeps original URL", async () => {
  const env = mkEnv(), calls = { ai: 0 };
  const { id } = await post(env, calls, "/api/capture", { url: "https://news.example.com/a" }).then((r) => r.json());
  assert.equal(calls.ai, 0);
  const article = (await call(env, calls, `/api/items/${id}/reader`).then((r) => r.json())).article;
  assert.equal(article.status, "ok");
  assert.equal(article.original_url, "https://news.example.com/a");
  assert.equal(article.source_type, "selected_url");
  assert.equal(article.source_language, "en");
  assert.equal(article.language_provenance, "html_lang");
  assert.ok(article.paragraphs.length > 0);
  assert.equal(calls.ai, 0);
  const summaryResponse = await post(env, calls, `/api/items/${id}/reader/summary`);
  assert.equal(summaryResponse.status, 200);
  const summary = (await summaryResponse.json()).article;
  assert.equal(summary.source_type, "selected_url");
  assert.equal(summary.summary.source_type, "selected_url");
  assert.equal(calls.ai, 1);
});

test("reader preserves source_type instead of source label and reflects configured translation language", async () => {
  const env = mkEnv(); env.AI_TARGET_LANGUAGE = "en";
  const now = new Date().toISOString(), id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO items(id,kind,status,title,url,source,source_type,raw_excerpt,created_at,updated_at) VALUES(?, 'daily','draft','Synthetic title','https://news.example.com/provenance','Publisher feed name','rss',?,?,?)")
    .bind(id, LONG.repeat(6), now, now).run();
  const calls = { ai: 0 }; let submittedPrompt = "";
  const fetchImpl = async (url, init) => {
    if (String(url).includes("generativelanguage")) {
      calls.ai++;
      submittedPrompt = JSON.parse(init.body).contents[0].parts[0].text;
      const result = submittedPrompt.startsWith("你是專業科技譯者")
        ? { paragraphs: JSON.parse(submittedPrompt.split("\n---\n")[1]).paragraphs.map(() => "Synthetic translated paragraph") }
        : { title_zh: "合成標題", tldr: "合成摘要", key_points: ["要點一", "要點二", "要點三"], why_ai_pm: "合成 AI PM 關聯", why_side_income: "合成業務關聯", actions: [] };
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }));
    }
    return mkFetch(calls)(url, init);
  };
  const getReader = async (suffix = "") => (await handle(req(`/api/items/${id}/reader${suffix}`), env, { authFetch, fetchImpl })).json();
  const loaded = (await getReader()).article;
  assert.equal(loaded.source_type, "rss");
  assert.equal(loaded.translation_language, "en");
  const translated = await handle(req(`/api/items/${id}/reader/translate`, { method: "POST" }), env, { authFetch, fetchImpl });
  assert.equal(translated.status, 200);
  const article = (await translated.json()).article;
  assert.equal(article.source_type, "rss");
  assert.equal(article.translation_language, "en");
  assert.match(submittedPrompt, /English/u);
  const summary = await handle(req(`/api/items/${id}/reader/summary`, { method: "POST" }), env, { authFetch, fetchImpl });
  assert.equal(summary.status, 200);
  const summarizedArticle = (await summary.json()).article;
  assert.equal(summarizedArticle.source_type, "rss");
  assert.equal(summarizedArticle.summary.source_type, "rss");
  assert.equal(summarizedArticle.summary.content_basis, "full_text");
  assert.equal(calls.ai, 3);

  const ui = readFileSync(new URL("../cloud/public/app.js", import.meta.url), "utf8");
  assert.ok(ui.includes('lang="${esc(a.translation_language || "zh-Hant")}"'));
  assert.match(ui, /targetLanguageName\(a\.translation_language\)/u);
});

test("failed URL capture retries only on explicit refresh and persists recovered body", async () => {
  const env = mkEnv(), calls = { ai: 0 };
  const { id } = await post(env, calls, "/api/capture", { url: "https://news.example.com/a" }).then((r) => r.json());
  let fetches = 0;
  const fetchImpl = async () => { fetches++; return fetches === 1
    ? new Response("denied", { status: 403, headers: { "content-type": "text/html" } })
    : new Response(HTML, { headers: { "content-type": "text/html" } }); };
  const read = async (suffix = "") => (await handle(req(`/api/items/${id}/reader${suffix}`), env, { authFetch, fetchImpl }).then((r) => r.json())).article;
  const failed = await read(); assert.equal(failed.error, "http_403"); assert.equal(failed.status, "paywall");
  assert.equal((await read()).error, "http_403"); assert.equal(fetches, 1, "cache hit must not fetch");
  const recovered = await read("?refresh=1"); assert.equal(recovered.status, "ok"); assert.equal(recovered.error, null);
  assert.ok(recovered.paragraphs.length > 0); assert.equal(recovered.source_type, "selected_url");
  assert.equal(recovered.original_url, "https://news.example.com/a"); assert.equal(fetches, 2); assert.equal(calls.ai, 0);
  assert.deepEqual((await read()).paragraphs, recovered.paragraphs); assert.equal(fetches, 2);
});

test("URL capture refresh failure replaces cached body and derived AI output with failure", async () => {
  const env = mkEnv(), calls = { ai: 0 };
  const { id } = await post(env, calls, "/api/capture", { url: "https://news.example.com/a" }).then((r) => r.json());
  let fetches = 0;
  const fetchImpl = async () => { fetches++; return fetches === 1
    ? new Response(HTML, { headers: { "content-type": "text/html" } })
    : new Response("denied", { status: 403, headers: { "content-type": "text/html" } }); };
  const read = async (suffix = "") => (await handle(req(`/api/items/${id}/reader${suffix}`), env, { authFetch, fetchImpl }).then((r) => r.json())).article;
  assert.equal((await read()).status, "ok");
  await env.DB.prepare("UPDATE articles SET summary=?,translation=?,translated_chunks=1,ai_provider='gemini' WHERE item_id=?")
    .bind(JSON.stringify({ tldr: "old body" }), JSON.stringify(["old translation"]), id).run();
  const failed = await read("?refresh=1"); assert.equal(failed.status, "paywall"); assert.equal(failed.error, "http_403");
  assert.deepEqual(failed.paragraphs, []); assert.equal(failed.summary, null); assert.deepEqual(failed.translation, []);
  assert.equal(failed.ai_provider, null); assert.equal(failed.fallback.excerpt, ""); assert.equal(fetches, 2);
  assert.equal((await read()).error, "http_403"); assert.equal(fetches, 2); assert.equal(calls.ai, 0);
  assert.equal((await post(env, calls, `/api/items/${id}/reader/summary`)).status, 422); assert.equal(calls.ai, 0);
});

test("successful URL refresh persists final URL and clears AI derived from the prior body", async () => {
  const env = mkEnv(), calls = { ai: 0 };
  const { id } = await post(env, calls, "/api/capture", { url: "https://news.example.com/a" }).then((r) => r.json());
  let fetches = 0;
  const fetchImpl = async (url) => { fetches++;
    if (fetches === 1) return new Response(HTML, { headers: { "content-type": "text/html" } });
    if (String(url) === "https://news.example.com/a") return new Response(null, { status: 302, headers: { location: "https://news.example.com/new" } });
    assert.equal(String(url), "https://news.example.com/new");
    return new Response(HTML.replace("Agents at work", "Updated agents at work").replace('lang="en"', 'lang="zh-Hant"'), { headers: { "content-type": "text/html" } });
  };
  const read = async (suffix = "") => (await handle(req(`/api/items/${id}/reader${suffix}`), env, { authFetch, fetchImpl }).then((r) => r.json())).article;
  assert.match((await read()).title, /Agents at work/u);
  await env.DB.prepare("UPDATE articles SET summary=?,translation=?,translated_chunks=1,ai_provider='gemini' WHERE item_id=?")
    .bind(JSON.stringify({ tldr: "old body" }), JSON.stringify(["old translation"]), id).run();
  const refreshed = await read("?refresh=1");
  assert.equal(refreshed.status, "ok"); assert.match(refreshed.title, /Updated agents at work/u);
  assert.equal(refreshed.url, "https://news.example.com/new"); assert.equal(refreshed.original_url, "https://news.example.com/a");
  assert.equal(refreshed.source_language, "zh-Hant"); assert.equal(refreshed.language_provenance, "html_lang");
  assert.equal(refreshed.summary, null); assert.deepEqual(refreshed.translation, []); assert.equal(refreshed.ai_provider, null);
  assert.equal(refreshed.translation_provider, null); assert.equal(fetches, 3); assert.equal(calls.ai, 0);
  assert.equal((await read()).url, refreshed.url); assert.equal(fetches, 3);
});

test("refreshed HTML without valid lang clears stale HTML provenance but preserves user declaration", async () => {
  for (const lang of [null, "invalid_lang!"]) {
    for (const declared of ["unknown", "zh-Hant"]) {
      const env = mkEnv(), calls = { ai: 0 };
      const { id } = await post(env, calls, "/api/capture", { url: "https://news.example.com/a", source_language: declared }).then((r) => r.json());
      let fetches = 0;
      const fetchImpl = async () => {
        fetches++;
        const body = fetches === 1 ? HTML : HTML.replace(' lang="en"', lang === null ? "" : ` lang="${lang}"`);
        return new Response(body, { headers: { "content-type": "text/html" } });
      };
      const read = async (suffix = "") => (await handle(req(`/api/items/${id}/reader${suffix}`), env, { authFetch, fetchImpl }).then((r) => r.json())).article;
      const first = await read(); assert.equal(first.status, "ok");
      assert.equal(first.source_language, declared === "unknown" ? "en" : "zh-Hant");
      const refreshed = await read("?refresh=1"); assert.equal(refreshed.status, "ok");
      assert.equal(refreshed.source_language, declared === "unknown" ? "unknown" : "zh-Hant");
      assert.equal(refreshed.language_provenance, declared === "unknown" ? "unknown" : "user_declared");
      assert.equal((await read()).source_language, refreshed.source_language);
      assert.equal(fetches, 2); assert.equal(calls.ai, 0);
    }
  }
});

test("manual pasted body with URL stays authoritative during reader refresh", async () => {
  const env = mkEnv(), calls = { ai: 0 }, text = LONG.repeat(6);
  const { id } = await post(env, calls, "/api/capture", { url: "https://news.example.com/a", text }).then((r) => r.json());
  const r = await handle(req(`/api/items/${id}/reader?refresh=1`), env, { authFetch, fetchImpl: async () => { throw Error("manual text must not fetch"); } });
  const article = (await r.json()).article;
  assert.equal(article.status, "ok"); assert.equal(article.source_type, "manual_text");
  assert.equal(article.paragraphs[0].text, text.trim()); assert.equal(calls.ai, 0);
});

test("reader fallback: paywall / unsafe url -> RSS excerpt + note, no AI translate", async () => {
  const env = mkEnv(), calls = { ai: 0 }; const id = await addItem(env, "https://paywall.example.com/x", "RSS excerpt text");
  let r = await call(env, calls, `/api/items/${id}/reader`); const a = (await r.json()).article;
  assert.equal(a.status, "paywall"); assert.equal(a.fallback.excerpt, "RSS excerpt text"); assert.match(a.fallback.note, /付費牆/u);
  r = await post(env, calls, `/api/items/${id}/reader/translate`); assert.equal(r.status, 422);
  r = await post(env, calls, `/api/items/${id}/reader/summary`); assert.equal(r.status, 422); assert.equal(calls.ai, 0);
  const id2 = await addItem(env, "http://127.0.0.1/admin"); r = await call(env, calls, `/api/items/${id2}/reader`); assert.equal((await r.json()).article.error, "unsafe_url");
});

test("reader rejects unsafe redirects and oversized HTML without spending AI quota", async () => {
  for (const [response, expected] of [
    [new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }), "unsafe_redirect"],
    [new Response(null, { status: 302, headers: { location: "https://[::1]/admin" } }), "unsafe_redirect"],
    [new Response(HTML, { headers: { "content-type": "text/html", "content-length": "1000001" } }), "response_too_large"],
    [new Response("x".repeat(1_000_001), { headers: { "content-type": "text/html" } }), "response_too_large"],
    [new Response("not html", { headers: { "content-type": "application/pdf" } }), "not_html"],
  ]) {
    const env = mkEnv(), id = await addItem(env, "https://news.example.com/a", "RSS excerpt ".repeat(30));
    const r = await handle(req(`/api/items/${id}/reader`), env, { authFetch, fetchImpl: async () => response });
    const article = (await r.json()).article;
    assert.equal(article.error, expected);
    assert.equal(article.status, "failed");
    const sum = await handle(req(`/api/items/${id}/reader/summary`, { method: "POST" }), env, { authFetch, fetchImpl: async () => { throw Error("AI must not be called"); } });
    assert.equal(sum.status, 422);
  }
});

test("parseSourceLines + bulk sources preview/commit with discovery and dedupe", async () => {
  const rows = parseSourceLines("# comment\nhttps://blog.example.com\n@sama\nhttps://x.com/karpathy\n@sama\nnot a url\n");
  assert.deepEqual(rows.map((r) => [r.type, r.status]), [["rss", "pending"], ["x", "pending"], ["x", "pending"], ["x", "duplicate_in_batch"], [null, "needs_map"]]);
  assert.equal(discoverFeed(`<link rel="alternate" type="application/atom+xml" href="/atom">`, "https://a.com/b"), "https://a.com/atom");
  const env = mkEnv(), calls = { ai: 0 }; const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO sources(id,type,value,label,enabled,created_at,updated_at) VALUES(?,?,?,?,1,?,?)").bind(crypto.randomUUID(), "x", "@sama", null, now, now).run();
  const base = (await env.DB.prepare("SELECT COUNT(*) n FROM sources").first()).n;
  const text = "https://openai.com\nhttps://dead.example.com/rss\n@sama\n@karpathy";
  let r = await post(env, calls, "/api/sources/bulk", { text }); let b = await r.json();
  assert.equal(b.preview[0].status, "new"); assert.equal(b.preview[0].value, "https://openai.com/feed.xml"); assert.equal(b.preview[1].status, "not_feed");
  assert.equal(b.preview.find((x) => x.value.toLowerCase() === "@sama").status, "exists");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM sources").first()).n, base, "dry run writes nothing");
  r = await post(env, calls, "/api/sources/bulk", { text, commit: true }); b = await r.json(); assert.equal(b.added, 2);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM sources").first()).n, base + 2); assert.equal(calls.ai, 0);
});

test("source preview blocks unlisted hosts and validates redirects before another request", async () => {
  const env = mkEnv(); let requested = [];
  const preview = (text) => handle(req("/api/sources/bulk", { method: "POST", headers: J, body: JSON.stringify({ text }) }), env, { authFetch, fetchImpl: async (url, init) => {
    requested.push(String(url)); assert.equal(init.redirect, "manual");
    return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
  } });
  const blockedHost = await preview("https://user-controlled.example/feed.xml").then((r) => r.json());
  assert.equal(blockedHost.preview[0].status, "not_feed"); assert.match(blockedHost.preview[0].error, /allowlist/u); assert.deepEqual(requested, []);
  const blockedRedirect = await preview("https://openai.com/feed.xml").then((r) => r.json());
  assert.equal(blockedRedirect.preview[0].status, "not_feed"); assert.match(blockedRedirect.preview[0].error, /redirect|重新導向/u);
  assert.deepEqual(requested, ["https://openai.com/feed.xml"]);
});

test("parseNotes + bulk KB import, search/tag, synthesize -> new synthesis note with export", async () => {
  const notes = parseNotes("# Note A\nhttps://a.com/1\n#agents 內容 A\n---\n# Note B\n內容 B #agents #pm");
  assert.equal(notes.length, 2); assert.equal(notes[0].url, "https://a.com/1"); assert.ok(notes[1].tags.includes("agents"));
  const env = mkEnv(), calls = { ai: 0 };
  let r = await post(env, calls, "/api/kb/import", { text: "# Note A\n內容 A #agents\n---\n# Note B\n內容 B #agents" }); assert.equal((await r.json()).preview.length, 2);
  r = await post(env, calls, "/api/kb/import", { text: "# Note A\n內容 A #agents\n---\n# Note B\n內容 B #agents\n---\n# Other\nzzz", commit: true }); const { ids, added } = await r.json(); assert.equal(added, 3);
  r = await call(env, calls, "/api/kb?q=" + encodeURIComponent("內容")); let b = await r.json(); assert.equal(b.entries.length, 2); assert.equal(b.tags.agents, 2);
  r = await call(env, calls, "/api/kb?tag=agents"); assert.equal((await r.json()).entries.length, 2);
  r = await post(env, calls, "/api/kb/synthesize", { ids: [ids[0]] }); assert.equal(r.status, 400);
  r = await post(env, calls, "/api/kb/synthesize", { ids: ids.slice(0, 2) }); b = await r.json(); assert.equal(r.status, 201); assert.equal(calls.ai, 1);
  assert.equal(b.entry.kb_type, "synthesis"); assert.deepEqual(b.entry.source_ids, ids.slice(0, 2)); assert.match(b.entry.note, /洞察 \[1\]/u);
  r = await call(env, calls, "/api/kb/export"); const md = await r.text(); assert.match(md, /type: "synthesis"/u); assert.match(md, /sources: \[/u);
  r = await call(env, calls, "/api/kb?type=synthesis"); assert.equal((await r.json()).entries.length, 1);
});
