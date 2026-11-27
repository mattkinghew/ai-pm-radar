import test from "node:test";
import assert from "node:assert/strict";
import worker, { handle, runScheduled } from "../cloud/src/worker.mjs";
import { formatDigestTelegramHtml, sendTelegramMessage, extractTelegramIngestPayload } from "../cloud/src/telegram.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";

const kit = accessKit();
const nowMs = Date.parse("2026-11-26T16:00:00Z");
const envFor = () => ({ DB: fakeD1(), CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash,
  TELEGRAM_BOT_TOKEN: "synthetic-bot-token", TELEGRAM_OWNER_CHAT_ID: "12345", TELEGRAM_WEBHOOK_SECRET: "synthetic-webhook-secret" });
const auth = () => ({ "Cf-Access-Jwt-Assertion": kit.token({ iat: nowMs / 1000 - 10, exp: nowMs / 1000 + 600 }) });
function dependencies() {
  const calls = [];
  return { calls, nowMs, authFetch: async () => new Response(kit.jwks), fetchImpl: async (url, init) => {
    assert.equal(url, "https://api.telegram.org/botsynthetic-bot-token/sendMessage");
    calls.push({ url, ...init, body: JSON.parse(init.body) });
    return Response.json({ ok: true, result: { message_id: 999 } });
  } };
}
const push = (body, method = "POST", headers = auth()) => new Request("https://radar.example/api/digest/push-telegram", { method, headers,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const message = (over = {}) => ({ message_id: 7, chat: { id: 12345, type: "private" }, from: { id: 12345 },
  text: "PRIVATE_TG_SENTINEL 私人轉寄資料 hidden link https://raw.example.test/a", entities: [{ type: "text_link", offset: 0, length: 19, url: "https://hidden.example.test/path?a=1&b=2" }],
  forward_origin: { type: "hidden_user", sender_user_name: "Synthetic author", date: 1795708800 }, ...over });
const webhook = (env, update, { method = "POST", secret = env.TELEGRAM_WEBHOOK_SECRET } = {}) => new Request("https://radar.example/api/webhooks/telegram", {
  method, headers: secret == null ? {} : { "X-Telegram-Bot-Api-Secret-Token": secret },
  ...(["GET", "HEAD"].includes(method) ? {} : { body: JSON.stringify(update) }),
});
const count = (env, table = "kb_entries") => env.DB.raw.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;
function addPublic(env) {
  const at = "2026-11-26T16:00:00Z";
  env.DB.raw.prepare(`INSERT INTO items(id,kind,status,title,url,source,lane,score,summary,key_points,published_at,created_at,updated_at,curation_status,injection_suspect)
    VALUES('public','daily','approved','Public signal','https://public.example.test','Synthetic','TECH_NEWS',9,'Public takeaway','[]',?,?,?,'main',0)`).run(at, at, at);
  env.DB.raw.prepare(`INSERT INTO kb_entries(id,item_id,title,origin,kb_type,created_at,updated_at) VALUES('kb-public','public','Public KB','approved','item',?,?)`).run(at, at);
}
const digest = (item = {}) => ({ window: "daily", date_label: "2026-11-27", total_items: 1,
  top_highlights: [{ title: "A < B & C > D", url: "https://example.test/?a=1&b=2", score: 9, summary: "One\nline <script>&", ...item }],
  lanes: [{ lane: "Research <&>", count: 1 }] });
function assertCompleteHtml(html) {
  const stack = [];
  for (const m of html.matchAll(/<(\/)?(b|i|a)(?: href="[^"]*")?>/gu)) {
    if (m[1]) assert.equal(stack.pop(), m[2]); else stack.push(m[2]);
  }
  assert.deepEqual(stack, []);
  assert.ok(!/[<>]/u.test(html.replace(/<\/?(?:b|i|a)(?: href="[^"]*")?>/gu, "")));
  assert.ok(!/&(?!(?:amp|lt|gt|quot);)/u.test(html));
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(html));
}

test("G6 Telegram HTML escapes all dynamic fields, validates links and keeps complete bounded blocks", () => {
  const html = formatDigestTelegramHtml(digest(), "https://console.example.test/?a=1&b=2");
  assert.match(html, /AI PM Radar 今日晨報 2026-11-27 HKT/u);
  for (const value of ["A &lt; B &amp; C &gt; D", "One line &lt;script&gt;&amp;", "Research &lt;&amp;&gt;", "共 1 則訊號", "評分 9", "Top 3 Highlights", "開啟 Radar 控制台"]) assert.ok(html.includes(value), value);
  assert.ok(html.includes('href="https://example.test/?a=1&amp;b=2"')); assertCompleteHtml(html);
  for (const url of ["javascript:alert(1)", "data:text/html,test", "https://user:password@example.test", "invalid"]) assert.ok(!formatDigestTelegramHtml(digest({ url })).includes(url));
  const huge = digest({ title: "<&>😀".repeat(10000), summary: "<&>😀".repeat(10000), url: `https://example.test/${"a".repeat(10000)}` });
  huge.top_highlights = Array(3).fill(huge.top_highlights[0]); huge.lanes = Array.from({ length: 1000 }, () => ({ lane: "<&>😀".repeat(100), count: 300 }));
  const bounded = formatDigestTelegramHtml(huge, `https://example.test/${"b".repeat(10000)}`);
  assert.ok(bounded.length <= 4096); assertCompleteHtml(bounded); assert.match(bounded, /3\. /u); assert.match(bounded, /Research Lane/u); assert.ok(bounded.endsWith("開啟 Radar 控制台"));
  for (const empty of [undefined, null, {}, { total_items: 0, top_highlights: [], lanes: [] }]) {
    const result = formatDigestTelegramHtml(empty); assert.match(result, /暫無已批准的可分享訊號/u); assert.ok(result.length < 300); assertCompleteHtml(result);
  }
});

test("G6 extractor handles text, captions, UTF-16 url entities, hidden links, forwarded metadata and edits", () => {
  const text = "😀 https://entity.example.test/path";
  const msg = message({ text, caption: "caption http://caption.example.test", entities: [
    { type: "url", offset: 3, length: text.length - 3 }, { type: "text_link", url: "https://hidden.example.test" },
    { type: "text_link", url: "javascript:alert(1)" }, { type: "url", offset: -1, length: 30 },
  ], caption_entities: [{ type: "text_link", url: "https://caption-hidden.example.test" }], forward_from_chat: { id: -1001, title: "Synthetic channel" }, forward_sender_name: "Legacy author" });
  const result = extractTelegramIngestPayload({ edited_message: msg });
  assert.deepEqual(result.urls, ["https://entity.example.test/path", "https://hidden.example.test", "http://caption.example.test", "https://caption-hidden.example.test"]);
  assert.equal(result.text, text); assert.equal(result.caption, msg.caption); assert.deepEqual(result.forward_origin, msg.forward_origin);
  assert.deepEqual(result.forward_from_chat, msg.forward_from_chat); assert.equal(result.forward_sender_name, "Legacy author");
  assert.equal(extractTelegramIngestPayload({ callback_query: {} }), null);
  assert.deepEqual(extractTelegramIngestPayload({ message: { text: "safe", entities: [null, {}] } }).urls, []);
});

test("G6 manual push requires valid owner Access JWT, rejects machine credentials and non-POST", async () => {
  const env = envFor(), deps = dependencies();
  env.DB = { prepare() { throw new Error("D1 must not be touched"); } };
  for (const headers of [{}, { "Cf-Access-Jwt-Assertion": "invalid.jwt.value" }, { authorization: "Bearer synthetic-machine" },
    { "Cf-Access-Jwt-Assertion": kit.token({ email: "other@example.test", iat: nowMs / 1000 - 10, exp: nowMs / 1000 + 600 }) }]) assert.equal((await handle(push(undefined, "POST", headers), env, deps)).status, 401);
  for (const method of ["GET", "PUT", "DELETE", "OPTIONS", "HEAD"]) {
    const r = await handle(push(undefined, method), env, deps); assert.equal(r.status, 405); assert.equal(r.headers.get("allow"), "POST");
  }
  for (const required of [undefined, "false"]) assert.equal((await handle(push(), { ...env, CLOUD_ACCESS_REQUIRED: required }, deps)).status, 401);
  assert.equal(deps.calls.length, 0);
});

test("G6 missing outbound secrets skips cleanly without fetching and reports no sent timestamp", async () => {
  for (const name of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_OWNER_CHAT_ID"]) {
    const env = envFor(), deps = dependencies(); delete env[name];
    const r = await handle(push(), env, deps); assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: false, skipped: true, reason: "telegram_not_configured", sent_at: null, total_items: 0 });
    assert.equal(deps.calls.length, 0);
    assert.deepEqual(await sendTelegramMessage(env, "safe", deps), { ok: false, skipped: true, reason: "telegram_not_configured" });
  }
});

test("G6 manual push sends expected Telegram HTML payload and validates optional daily/weekly/date body", async () => {
  const env = envFor(), deps = dependencies(); addPublic(env);
  for (const body of [undefined, { window: "daily", date: "2026-11-27" }, { window: "weekly", date: "2026-11-27" }]) {
    const r = await handle(push(body), env, deps); assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, sent_at: new Date(nowMs).toISOString(), total_items: 1 });
  }
  const sent = deps.calls[0]; assert.equal(sent.method, "POST"); assert.equal(sent.redirect, "error"); assert.ok(sent.signal);
  assert.deepEqual(Object.keys(sent.body).sort(), ["chat_id", "disable_web_page_preview", "parse_mode", "text"]);
  assert.equal(sent.body.chat_id, "12345"); assert.equal(sent.body.parse_mode, "HTML"); assert.equal(sent.body.disable_web_page_preview, true);
  assert.match(sent.body.text, /Public signal/u); assert.match(sent.body.text, /Public takeaway/u);
  assert.match(deps.calls[2].body.text, /每週精選週報 2026-11-21 ~ 2026-11-27 HKT/u);
  for (const body of [null, [], { window: "yearly" }, { date: 1 }, { date: "2026-02-30" }, { date: "" }]) assert.equal((await handle(push(body), env, deps)).status, 400);
  const malformed = new Request(push(), { body: "{" }); assert.equal((await handle(malformed, env, deps)).status, 400);
  assert.equal(deps.calls.length, 3);
});

test("G6 webhook fails closed on missing config/header, wrong secrets and wrong methods before any D1 access", async () => {
  const env = envFor(), deps = dependencies();
  env.DB = { prepare() { throw new Error("D1 must not be touched"); } };
  for (const name of ["TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_OWNER_CHAT_ID"]) {
    const missing = { ...env }; delete missing[name]; assert.equal((await handle(webhook(env, { message: message() }), missing, deps)).status, 503);
  }
  for (const secret of [null, "", "wrong", `${env.TELEGRAM_WEBHOOK_SECRET}x`]) assert.equal((await handle(webhook(env, { message: message() }, { secret }), env, deps)).status, 401);
  for (const method of ["GET", "PUT", "DELETE", "HEAD", "OPTIONS"]) {
    const r = await handle(webhook(env, {}, { method, secret: null }), env, deps); assert.equal(r.status, 405); assert.equal(r.headers.get("allow"), "POST");
  }
  assert.equal(deps.calls.length, 0);
});

test("G6 both owner IDs are mandatory; non-owner messages and commands produce zero D1 writes or replies", async () => {
  const env = envFor(), deps = dependencies();
  env.DB = { prepare() { throw new Error("D1 must not be touched"); } };
  for (const over of [{ chat: { id: -1001 } }, { from: { id: 999 } }, { chat: null }, { from: null }]) {
    for (const text of ["PRIVATE_TG_SENTINEL", "/digest"]) {
      const r = await handle(webhook(env, { message: message({ ...over, text }) }), env, deps);
      assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, ignored: "unauthorized_sender" });
    }
  }
  assert.equal(deps.calls.length, 0);
});

test("G6 forwarded hidden-link message is stored exactly once across concurrent retries; metadata and content survive", async () => {
  const env = envFor(), deps = dependencies(); const msg = message();
  const replies = await Promise.all(Array.from({ length: 3 }, () => handle(webhook(env, { message: msg }), env, deps)));
  const results = await Promise.all(replies.map((r) => { assert.equal(r.status, 200); return r.json(); }));
  assert.equal(results.filter((r) => !r.duplicate).length, 1); assert.equal(count(env), 1); assert.equal(count(env, "items"), 0);
  const row = env.DB.raw.prepare("SELECT * FROM kb_entries").get();
  assert.equal(row.id, "telegram:12345:7"); assert.equal(row.item_id, null); assert.equal(row.origin, "manual"); assert.equal(row.kb_type, "note");
  const note = JSON.parse(row.note); assert.equal(note.text, msg.text); assert.deepEqual(note.forward_origin, msg.forward_origin);
  assert.deepEqual(note.urls, ["https://raw.example.test/a", "https://hidden.example.test/path?a=1&b=2"]);
  assert.equal(deps.calls.length, 3); assert.match(deps.calls[0].body.text, /✅ 已收錄至私有知識庫（偵測到 2 個連結）/u);
  const edited = await handle(webhook(env, { edited_message: { ...msg, text: "changed retry" } }), env, deps);
  assert.equal((await edited.json()).duplicate, true); assert.equal(count(env), 1); assert.equal(JSON.parse(env.DB.raw.prepare("SELECT note FROM kb_entries").get().note).text, msg.text);
});

test("G6 privacy: ingested Telegram notes never appear in showcase, daily, weekly or legacy digest", async () => {
  const env = envFor(), deps = dependencies(); addPublic(env);
  assert.equal((await handle(webhook(env, { message: message() }), env, deps)).status, 200);
  for (const path of ["/api/public/showcase", "/api/digest", "/api/digest?window=weekly", "/api/digest?days=7"]) {
    const r = await handle(new Request(`https://radar.example${path}`, { headers: auth() }), env, deps);
    assert.equal(r.status, 200); const body = await r.text(); assert.ok(body.includes("Public signal"));
    for (const value of ["PRIVATE_TG_SENTINEL", "telegram:12345:7", "hidden.example.test", "raw.example.test", "Synthetic author"]) assert.ok(!body.includes(value), `${path}: ${value}`);
  }
  // Even a linked approved item cannot promote a manual note through the shared SQL gates.
  env.DB.raw.prepare("DELETE FROM kb_entries WHERE id='kb-public'").run();
  env.DB.raw.prepare("UPDATE kb_entries SET item_id='public' WHERE id='telegram:12345:7'").run();
  for (const path of ["/api/public/showcase", "/api/digest"]) {
    const r = await handle(new Request(`https://radar.example${path}`, { headers: auth() }), env, deps);
    assert.equal(r.status, 200); assert.ok(!(await r.text()).includes("Public signal"));
  }
});

test("G6 owner /digest replies for HKT today without ingesting, while caption-only notes are retained privately", async () => {
  const env = envFor(), deps = dependencies(); addPublic(env);
  const r = await handle(webhook(env, { message: message({ text: "/digest", entities: [] }) }), env, deps);
  assert.equal(r.status, 200); assert.equal((await r.json()).ok, true); assert.equal(count(env), 1);
  assert.match(deps.calls[0].body.text, /今日晨報 2026-11-27 HKT/u); assert.match(deps.calls[0].body.text, /Public signal/u);
  const caption = message({ message_id: 8, text: undefined, caption: "PRIVATE_CAPTION", caption_entities: [{ type: "text_link", url: "https://caption.example.test" }] });
  assert.equal((await handle(webhook(env, { message: caption }), env, deps)).status, 200);
  assert.equal(count(env), 2); assert.equal(JSON.parse(env.DB.raw.prepare("SELECT note FROM kb_entries WHERE id='telegram:12345:8'").get().note).caption, "PRIVATE_CAPTION");
});

test("G6 malformed, oversized and unsupported webhook updates cannot write; failed DB writes do not confirm", async () => {
  const env = envFor(), deps = dependencies();
  for (const body of ["{", JSON.stringify({ message: message({ text: "a".repeat(64001) }) })]) {
    const r = await handle(new Request(webhook(env, {}), { body }), env, deps); assert.equal(r.status, 400);
  }
  assert.equal((await handle(webhook(env, { message: message({ message_id: undefined }) }), env, deps)).status, 400);
  for (const update of [{}, { message: message({ text: "", entities: [] }) }]) assert.equal((await handle(webhook(env, update), env, deps)).status, 200);
  assert.equal(count(env), 0); assert.equal(deps.calls.length, 0);
  env.DB = { prepare() { throw new Error("PRIVATE_DATABASE_ERROR"); } };
  const failed = await handle(webhook(env, { message: message() }), env, deps); assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: "telegram_webhook_failed" }); assert.equal(deps.calls.length, 0);
});

test("G6 API/network failures are sanitized; persisted ingest remains idempotent when confirmation is retried", async () => {
  const env = envFor(), deps = dependencies();
  for (const fetchImpl of [async () => { throw new Error("PRIVATE_TOKEN_OR_URL"); }, async () => Response.json({ ok: false, description: "PRIVATE_RESPONSE" }), async () => new Response("PRIVATE_RESPONSE", { status: 500 })]) {
    const r = await handle(push(), env, { ...deps, fetchImpl }); assert.equal(r.status, 502); assert.deepEqual(await r.json(), { error: "telegram_push_failed" });
    await assert.rejects(sendTelegramMessage(env, "safe", { fetchImpl }), { message: "telegram_send_failed" });
  }
  const failed = await handle(webhook(env, { message: message() }), env, { ...deps, fetchImpl: async () => { throw new Error("PRIVATE_NETWORK_ERROR"); } });
  assert.equal(failed.status, 503); assert.equal(count(env), 1);
  const retry = await handle(webhook(env, { message: message() }), env, deps); assert.equal(retry.status, 200); assert.equal((await retry.json()).duplicate, true); assert.equal(count(env), 1);
});

test("G6 scheduled collection finishes before Telegram push; Telegram failure cannot fail the daily run", async () => {
  const env = envFor(); env.AI_ANALYSIS_ENABLED = "false"; addPublic(env);
  let sends = 0;
  const fetchImpl = async (url) => {
    if (url.startsWith("https://api.telegram.org/")) {
      assert.equal(count(env, "runs"), 1); sends++; throw new Error("PRIVATE_TELEGRAM_FAILURE");
    }
    if (url.includes("hn.algolia.com")) return Response.json({ hits: [] });
    return new Response("<rss><channel></channel></rss>", { headers: { "content-type": "application/xml" } });
  };
  const originalLog = console.log; const logs = []; console.log = (s) => logs.push(s);
  try {
    const result = await runScheduled(env, { nowMs, fetchImpl }); assert.equal(result.collected, 0); assert.equal(sends, 1);
  } finally { console.log = originalLog; }
  assert.deepEqual(logs, ['{"telegram_error":"telegram_push_failed"}']);
  const unconfigured = envFor(); unconfigured.AI_ANALYSIS_ENABLED = "false"; delete unconfigured.TELEGRAM_BOT_TOKEN;
  let pending;
  const originalFetch = globalThis.fetch; globalThis.fetch = fetchImpl;
  try {
    worker.scheduled({}, unconfigured, { waitUntil(promise) { pending = promise; } }); await pending;
  } finally { globalThis.fetch = originalFetch; }
  assert.equal(count(unconfigured, "runs"), 1); assert.equal(sends, 1);
});

test("G6 configured scheduled push sends today's approved digest only after collection has been recorded", async () => {
  const env = envFor(); env.AI_ANALYSIS_ENABLED = "false"; addPublic(env);
  const deps = dependencies(); const telegramFetch = deps.fetchImpl;
  deps.fetchImpl = async (url, init) => {
    if (url.startsWith("https://api.telegram.org/")) { assert.equal(count(env, "runs"), 1); return telegramFetch(url, init); }
    if (url.includes("hn.algolia.com")) return Response.json({ hits: [] });
    return new Response("<rss><channel></channel></rss>", { headers: { "content-type": "application/xml" } });
  };
  const result = await runScheduled(env, deps); assert.equal(result.collected, 0); assert.equal(deps.calls.length, 1);
  assert.match(deps.calls[0].body.text, /今日晨報 2026-11-27 HKT/u); assert.match(deps.calls[0].body.text, /Public signal/u);
});
