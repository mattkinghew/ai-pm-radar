import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../cloud/src/worker.mjs";
import { safeFetchUrl, extractArticle, chunkParagraphs, parseSourceLines, parseNotes, discoverFeed } from "../cloud/src/reader.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";
const kit = accessKit();
const authFetch = async () => new Response(kit.jwks, { headers: { "content-type": "application/json" } });
const mkEnv = (cap = "10") => ({ DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash, GEMINI_API_KEY: "k", AI_DAILY_CAP: cap, INGEST_TOKEN: "t".repeat(40), AI_ANALYSIS_ENABLED: "false" });
const J = { "content-type": "application/json" };
const req = (p, o = {}) => new Request("https://r.x" + p, { ...o, headers: { "Cf-Access-Jwt-Assertion": kit.token(), ...(o.headers || {}) } });
const LONG = "Large language models are changing how product teams ship software, and this paragraph is long enough to count. ";
const HTML = `<html><head><title>Agents at work | Site</title><meta property="og:site_name" content="TechSite"></head><body><nav>menu links</nav>
<article><h1>Agents at work</h1>${Array.from({ length: 12 }, (_, i) => `<p>${LONG.repeat(3)} #${i}</p>`).join("")}</article><footer>cookie</footer></body></html>`;
const gemText = (body) => {
  const t = JSON.parse(body).contents[0].parts[0].text;
  if (t.startsWith("你是專業科技譯者")) { const n = JSON.parse(t.split("\n---\n")[1]).paragraphs.length; return { paragraphs: Array.from({ length: n }, (_, i) => `中文段落 ${i}`) }; }
  if (t.startsWith("你是 AI PM Radar 的知識編輯")) return { title_zh: "代理上班", tldr: "AI 代理改變產品團隊", key_points: ["一", "二", "三", "四"], why_ai_pm: "幫 PM 規劃", why_side_income: "可做顧問", actions: ["試用"] };
  return { title: "綜合", summary: "總結", themes: [{ name: "主題", points: ["p"] }], insights: ["洞察 [1]", "洞察 [2]", "洞察 [1][2]"], actions: ["做 A", "做 B"], open_questions: [] };
};
const mkFetch = (calls) => async (u, o) => {
  u = String(u);
  if (u.includes("generativelanguage")) { calls.ai++; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(gemText(o.body)) }] } }] })); }
  if (u.includes("blog.example.com/feed")) return new Response(`<?xml version="1.0"?><rss><channel><item><title>a</title></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } });
  if (u.includes("blog.example.com")) return new Response(`<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>`, { headers: { "content-type": "text/html" } });
  if (u.includes("paywall.example.com")) return new Response("no", { status: 403, headers: { "content-type": "text/html" } });
  if (u.includes("news.example.com")) return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
  return new Response("nf", { status: 404 });
};
const call = (env, calls, p, o) => handle(req(p, o), env, { authFetch, fetchImpl: mkFetch(calls) });
const post = (env, calls, p, b) => call(env, calls, p, { method: "POST", headers: J, body: JSON.stringify(b ?? {}) });
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

test("reader fallback: paywall / unsafe url -> RSS excerpt + note, no AI translate", async () => {
  const env = mkEnv(), calls = { ai: 0 }; const id = await addItem(env, "https://paywall.example.com/x", "RSS excerpt text");
  let r = await call(env, calls, `/api/items/${id}/reader`); const a = (await r.json()).article;
  assert.equal(a.status, "paywall"); assert.equal(a.fallback.excerpt, "RSS excerpt text"); assert.match(a.fallback.note, /付費牆/u);
  r = await post(env, calls, `/api/items/${id}/reader/translate`); assert.equal(r.status, 422);
  r = await post(env, calls, `/api/items/${id}/reader/summary`); assert.equal(r.status, 422); assert.equal(calls.ai, 0);
  const id2 = await addItem(env, "http://127.0.0.1/admin"); r = await call(env, calls, `/api/items/${id2}/reader`); assert.equal((await r.json()).article.error, "unsafe_url");
});

test("parseSourceLines + bulk sources preview/commit with discovery and dedupe", async () => {
  const rows = parseSourceLines("# comment\nhttps://blog.example.com\n@sama\nhttps://x.com/karpathy\n@sama\nnot a url\n");
  assert.deepEqual(rows.map((r) => [r.type, r.status]), [["rss", "pending"], ["x", "pending"], ["x", "pending"], ["x", "duplicate_in_batch"], [null, "invalid"]].map(([t, s]) => [t ?? rows[4].type, s]));
  assert.equal(discoverFeed(`<link rel="alternate" type="application/atom+xml" href="/atom">`, "https://a.com/b"), "https://a.com/atom");
  const env = mkEnv(), calls = { ai: 0 }; const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO sources(id,type,value,label,enabled,created_at,updated_at) VALUES(?,?,?,?,1,?,?)").bind(crypto.randomUUID(), "x", "@sama", null, now, now).run();
  const base = (await env.DB.prepare("SELECT COUNT(*) n FROM sources").first()).n;
  const text = "https://blog.example.com\nhttps://dead.example.com/rss\n@sama\n@karpathy";
  let r = await post(env, calls, "/api/sources/bulk", { text }); let b = await r.json();
  assert.equal(b.preview[0].status, "new"); assert.equal(b.preview[0].value, "https://blog.example.com/feed.xml"); assert.equal(b.preview[1].status, "not_feed");
  assert.equal(b.preview.find((x) => x.value.toLowerCase() === "@sama").status, "exists");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM sources").first()).n, base, "dry run writes nothing");
  r = await post(env, calls, "/api/sources/bulk", { text, commit: true }); b = await r.json(); assert.equal(b.added, 2);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM sources").first()).n, base + 2); assert.equal(calls.ai, 0);
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
