import { cleanThreadsExport } from "../public/threads-import.mjs";
import { normalizeUrl } from "./curation.mjs";

const SOURCES = ["threads_saved", "video_watch", "generic"];
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const encoder = new TextEncoder();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: {
  "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
} });

async function bearerMatches(actual, expected) {
  // As in G6, native HMAC verification supplies timing-safe equality on Workers and Node.
  const key = await crypto.subtle.importKey("raw", encoder.encode(expected), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(expected));
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(actual));
}

async function readJson(request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new Error("payload_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_payload");
  let size = 0; const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("payload_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function text(value, max) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max) throw new Error("invalid_item");
  return value.replace(/\r\n?/gu, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "").trim();
}
function strings(value, maxLength) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 30 || value.some((v) => typeof v !== "string")) throw new Error("invalid_item");
  return [...new Set(value.map((v) => text(v, maxLength)).filter(Boolean))];
}
function httpUrl(value) {
  try {
    const u = new URL(value);
    return value.length <= 2048 && ["http:", "https:"].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}
const extractUrls = (value) => [...new Set((value.match(/https?:\/\/[^\s<>"'）】\]，。！？]+/gu) || [])
  .map((u) => httpUrl(u.replace(/[.,;:!?)]+$/u, ""))).filter(Boolean))];

function structuredItem(raw, extractedUrls) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid_item");
  const title = text(raw.title, 300).replace(/\s+/gu, " ");
  if (!title) throw new Error("invalid_item");
  const external_id = text(raw.external_id, 256);
  const summary = text(raw.summary, 8000), content = text(raw.content, 20000);
  const key_points = strings(raw.key_points, 1000), tags = strings(raw.tags, 80);
  const suppliedUrl = text(raw.url, 2048), url = suppliedUrl ? httpUrl(suppliedUrl) : null;
  if (suppliedUrl && !url) throw new Error("invalid_item");
  const urls = [...new Set([url, ...(extractedUrls ? extractedUrls.map(httpUrl).filter(Boolean) : extractUrls([title, summary, content, ...key_points].join("\n")))].filter(Boolean))];
  const captured = text(raw.captured_at, 80);
  if (captured && (!/^\d{4}-\d\d-\d\dT/u.test(captured) || !Number.isFinite(Date.parse(captured)))) throw new Error("invalid_item");
  return { title, external_id, url: url || urls[0] || null, summary, content, key_points, tags, urls,
    captured_at: captured ? new Date(captured).toISOString() : null };
}

async function dedupId(source, item) {
  const identity = item.external_id ? ["external_id", item.external_id] : item.url ? ["url", normalizeUrl(item.url)]
    : ["content", item.title, item.summary, item.content, item.key_points];
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(["batch-ingest-v1", source, ...identity])));
  // Match the existing KB ID contract, including edit/delete/synthesis callers.
  return Array.from(new Uint8Array(hash).slice(0, 16), (v) => v.toString(16).padStart(2, "0")).join("");
}

export async function handleIngestBatch(request, env) {
  if (request.method !== "POST") { const r = json({ error: "method_not_allowed" }, 405); r.headers.set("allow", "POST"); return r; }
  if (typeof env.INGEST_API_TOKEN !== "string" || !env.INGEST_API_TOKEN.trim()) return json({ error: "ingest_not_configured" }, 503);
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/iu);
  if (!bearer || !(await bearerMatches(bearer[1], env.INGEST_API_TOKEN))) return json({ error: "unauthorized" }, 401);
  let body;
  try { body = await readJson(request); }
  catch (error) { const large = error?.message === "payload_too_large"; return json({ error: large ? "payload_too_large" : "invalid_payload" }, large ? 413 : 400); }
  if (!body || Array.isArray(body) || !SOURCES.includes(body.source_type) || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50
    || (body.dry_run !== undefined && typeof body.dry_run !== "boolean")) return json({ error: "invalid_payload" }, 400);
  const result = { ok: true, dry_run: body.dry_run ?? false, source_type: body.source_type, received: body.items.length, inserted: 0, skipped_duplicates: 0, rejected: 0, errors: [] };
  const reject = (code) => { result.rejected++; result.errors.push({ code }); };
  let candidates = body.items;
  if (body.source_type === "threads_saved") {
    candidates = body.items.filter((item) => item && typeof item === "object" && !Array.isArray(item));
    for (let i = candidates.length; i < body.items.length; i++) reject("invalid_item");
    if (candidates.length) {
      let cleaned;
      try { cleaned = cleanThreadsExport(candidates); }
      catch { return json({ error: "invalid_items" }, 400); }
      result.skipped_duplicates += candidates.length - cleaned.uniqueCount;
      candidates = cleaned.items.filter((item) => { if (item.quarantined) { reject("threads_quarantined"); return false; } return true; })
        .map((item) => ({ title: item.title, external_id: item.external_id, url: item.canonical_url, content: item.raw_text,
          tags: ["threads_saved", item.lane], urls: item.urls }));
    }
  }
  const seen = new Set(); const now = new Date().toISOString();
  try {
    for (const raw of candidates) {
      let item;
      try { item = structuredItem(raw, body.source_type === "threads_saved" ? raw.urls : undefined); } catch { reject("invalid_item"); continue; }
      const id = await dedupId(body.source_type, item);
      if (seen.has(id)) { result.skipped_duplicates++; continue; }
      seen.add(id);
      if (result.dry_run) {
        if (await env.DB.prepare("SELECT id FROM kb_entries WHERE id=?").bind(id).first()) result.skipped_duplicates++;
        continue;
      }
      const note = JSON.stringify({ content: item.content, urls: item.urls, captured_at: item.captured_at, external_id: item.external_id || null });
      // Never create an editorial item or accept caller-supplied approval/privacy markers.
      const stored = await env.DB.prepare(`INSERT INTO kb_entries(id,item_id,title,url,source,category,summary,key_points,tags,note,score,origin,kb_type,created_at,updated_at)
        VALUES(?,NULL,?,?,?,'NOTE',?,?,?,?,NULL,'manual','note',?,?) ON CONFLICT(id) DO NOTHING`)
        .bind(id, item.title, item.url, body.source_type, item.summary || null, JSON.stringify(item.key_points), JSON.stringify(item.tags), note, now, now).run();
      if (stored.meta?.changes) result.inserted++; else result.skipped_duplicates++;
    }
    return json(result);
  } catch { return json({ error: "ingest_unavailable" }, 503); }
}
