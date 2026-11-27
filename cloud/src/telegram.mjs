import { dailyDigest } from "./digest.mjs";
import { hktDay } from "./ai.mjs";

const APP_URL = "https://radar-cloud.lamlab.cc/";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: {
  "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
} });
const postOnly = () => { const r = json({ error: "method_not_allowed" }, 405); r.headers.set("allow", "POST"); return r; };
const escaped = (s) => s.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
function text(value, max) {
  const source = String(value ?? "").replace(/\s+/gu, " ").trim();
  let result = "";
  for (const char of source) {
    const next = escaped(char);
    if (result.length + next.length > max - 1) return result + "…";
    result += next;
  }
  return result;
}
function link(title, value) {
  try {
    const u = new URL(value);
    const href = escaped(u.href);
    if (["https:", "http:"].includes(u.protocol) && !u.username && !u.password && href.length <= 360) return `<a href="${href}">${title}</a>`;
  } catch { /* Invalid links remain plain text. */ }
  return title;
}

export function formatDigestTelegramHtml(digestPayload, appUrl = APP_URL) {
  const d = digestPayload || {};
  const footer = `\n\n${link("開啟 Radar 控制台", appUrl)}`;
  let output = `<b>AI PM Radar ${d.window === "weekly" ? "每週精選週報" : "今日晨報"} ${text(d.date_label, 80)} HKT</b>\n共 ${text(d.total_items || 0, 16)} 則訊號`;
  // Bound escaped fields and append only complete HTML blocks, reserving the footer.
  const append = (block) => { if (output.length + block.length + footer.length <= 4096) { output += block; return true; } return false; };
  if (!d.total_items) append("\n\n<i>暫無已批准的可分享訊號。</i>");
  else {
    append("\n\n<b>Top 3 Highlights</b>");
    for (const [i, item] of (d.top_highlights || []).slice(0, 3).entries()) {
      append(`\n${i + 1}. ${link(text(item.title, 180), item.url)}｜評分 ${text(item.score ?? "—", 24)}\n${text(item.summary || item.key_points?.[0] || "暫無摘要", 280)}`);
    }
    append("\n\n<b>Research Lane</b>");
    for (const lane of d.lanes || []) {
      if (!append(`\n${text(lane.lane, 64)}：${text(lane.count ?? lane.items?.length ?? 0, 16)}`)) break;
    }
  }
  return output + footer;
}

export async function sendTelegramMessage(env, text, options = {}) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_OWNER_CHAT_ID) return { ok: false, skipped: true, reason: "telegram_not_configured" };
  try {
    const response = await (options.fetchImpl ?? fetch)(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" }, redirect: "error", signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ chat_id: String(env.TELEGRAM_OWNER_CHAT_ID), text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!response.ok || (await readJson(response)).ok !== true) throw new Error("telegram_send_failed");
    return { ok: true };
  } catch { throw new Error("telegram_send_failed"); }
}

export function extractTelegramIngestPayload(update) {
  const message = update?.message ?? update?.edited_message;
  if (!message || typeof message !== "object") return null;
  const text = typeof message.text === "string" ? message.text : "";
  const caption = typeof message.caption === "string" ? message.caption : "";
  const urls = new Set();
  const add = (value) => { if (typeof value === "string" && /^https?:\/\//iu.test(value)) { try { new URL(value); urls.add(value); } catch { /* Ignore malformed URLs. */ } } };
  for (const [content, entities] of [[text, message.entities], [caption, message.caption_entities]]) {
    for (const match of content.matchAll(/https?:\/\/[^\s<>"']+/giu)) add(match[0].replace(/[.,;!?]+$/u, ""));
    for (const entity of Array.isArray(entities) ? entities : []) {
      if (entity?.type === "text_link") add(entity.url);
      if (entity?.type === "url" && Number.isInteger(entity.offset) && Number.isInteger(entity.length) && entity.offset >= 0 && entity.length > 0 && entity.offset + entity.length <= content.length) add(content.slice(entity.offset, entity.offset + entity.length));
    }
  }
  return { message, text, caption, urls: [...urls], forward_origin: message.forward_origin ?? null,
    forward_from_chat: message.forward_from_chat ?? null, forward_sender_name: message.forward_sender_name ?? null };
}

async function readJson(request) {
  const reader = request.body?.getReader();
  if (!reader) return {};
  let bytes = 0; const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 64000) { await reader.cancel(); throw new Error("payload_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return bytes ? JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)) : {};
}

export async function pushTelegramDigest(env, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const url = new URL("/api/digest", APP_URL);
  url.searchParams.set("window", options.window ?? "daily");
  url.searchParams.set("date", options.date ?? hktDay(nowMs));
  const digest = await dailyDigest(env.DB, url, nowMs);
  if (digest.error) return digest;
  const result = await sendTelegramMessage(env, formatDigestTelegramHtml(digest), options);
  return { ...result, sent_at: result.ok ? new Date(nowMs).toISOString() : null, total_items: digest.total_items };
}

export async function handleTelegramPush(request, env, deps = {}) {
  if (request.method !== "POST") return postOnly();
  let body;
  try { body = await readJson(request); } catch { return json({ error: "invalid_payload" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || (body.window !== undefined && !["daily", "weekly"].includes(body.window)) || (body.date !== undefined && typeof body.date !== "string")) return json({ error: "invalid_payload" }, 400);
  try {
    const result = await pushTelegramDigest(env, { window: body.window, date: body.date, fetchImpl: deps.fetchImpl, nowMs: deps.nowMs });
    return json(result, result.error ? 400 : 200);
  } catch { return json({ error: "telegram_push_failed" }, 502); }
}

async function secretMatches(actual, expected) {
  const encode = (s) => new TextEncoder().encode(s);
  // Native HMAC verification provides timing-safe equality on both Workers and Node.
  const key = await crypto.subtle.importKey("raw", encode(expected), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const signature = await crypto.subtle.sign("HMAC", key, encode(expected));
  return crypto.subtle.verify("HMAC", key, signature, encode(actual));
}

export async function handleTelegramWebhook(request, env, deps = {}) {
  if (request.method !== "POST") return postOnly();
  if (!env.TELEGRAM_WEBHOOK_SECRET || !env.TELEGRAM_OWNER_CHAT_ID) return json({ error: "telegram_not_configured" }, 503);
  if (!(await secretMatches(request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "", env.TELEGRAM_WEBHOOK_SECRET))) return json({ error: "unauthorized" }, 401);
  let update;
  try { update = await readJson(request); } catch { return json({ error: "invalid_payload" }, 400); }
  const payload = extractTelegramIngestPayload(update);
  if (!payload) return json({ ok: true, ignored: "unsupported_update" });
  const msg = payload.message;
  if (String(msg.chat?.id) !== String(env.TELEGRAM_OWNER_CHAT_ID) || String(msg.from?.id) !== String(env.TELEGRAM_OWNER_CHAT_ID)) return json({ ok: true, ignored: "unauthorized_sender" });
  try {
    if (payload.text.startsWith("/digest")) {
      const result = await pushTelegramDigest(env, deps);
      return json(result, result.error ? 400 : 200);
    }
    const content = [payload.text, payload.caption].filter(Boolean).join("\n");
    if (!content.trim()) return json({ ok: true, ignored: "unsupported_message" });
    if (!Number.isSafeInteger(msg.message_id) || msg.message_id < 1) return json({ error: "invalid_message_id" }, 400);
    const id = `telegram:${msg.chat.id}:${msg.message_id}`;
    const now = new Date(deps.nowMs ?? Date.now()).toISOString();
    const note = JSON.stringify({ text: payload.text, caption: payload.caption, urls: payload.urls, forward_origin: payload.forward_origin,
      forward_from_chat: payload.forward_from_chat, forward_sender_name: payload.forward_sender_name, chat_id: msg.chat.id, message_id: msg.message_id });
    const result = await env.DB.prepare(`INSERT INTO kb_entries(id,item_id,title,url,source,category,summary,key_points,tags,note,score,origin,kb_type,created_at,updated_at)
      VALUES(?,NULL,?,?,'telegram','NOTE',NULL,'[]','[]',?,NULL,'manual','note',?,?) ON CONFLICT(id) DO NOTHING`)
      .bind(id, content.replace(/\s+/gu, " ").slice(0, 140), payload.urls[0] || null, note, now, now).run();
    const reply = await sendTelegramMessage(env, `✅ 已收錄至私有知識庫（偵測到 ${payload.urls.length} 個連結）`, deps);
    return json({ ok: true, duplicate: !result.meta?.changes, reply_ok: reply.ok });
  } catch { return json({ error: "telegram_webhook_failed" }, 503); }
}
