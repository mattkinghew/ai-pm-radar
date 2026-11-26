import { LANES } from "./curation.mjs";
import { hktDay } from "./ai.mjs";

// Approval and quarantine are independent gates; private KB content is never selected.
export const PUBLISHABLE_ITEMS = `FROM items i JOIN kb_entries k ON k.item_id=i.id
  WHERE i.kind='daily' AND i.status='approved' AND i.curation_status IN ('main','released')
  AND i.injection_suspect=0 AND i.dismissed_reason IS NULL AND k.origin='approved' AND k.kb_type='item'`;
const ITEM_DAY = "date(COALESCE(i.published_at, i.run_date || 'T00:00:00+08:00', i.created_at), '+8 hours')";
const strings = (value) => { try { const a = JSON.parse(value); return Array.isArray(a) ? a.filter((v) => typeof v === "string") : []; } catch { return []; } };

export async function dailyDigest(db, url, nowMs = Date.now()) {
  const window = url.searchParams.get("window") ?? "daily";
  const requested = url.searchParams.get("date") ?? hktDay(nowMs);
  const lane = url.searchParams.get("lane");
  const rawLimit = url.searchParams.get("limit") ?? "30";
  if (!["daily", "weekly"].includes(window)) return { error: "bad_window" };
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(requested) || !Number.isFinite(Date.parse(requested)) || new Date(requested).toISOString().slice(0, 10) !== requested) return { error: "bad_date" };
  if (lane !== null && !LANES.includes(lane)) return { error: "bad_lane" };
  if (!/^\d+$/u.test(rawLimit) || !Number.isSafeInteger(Number(rawLimit)) || Number(rawLimit) < 1) return { error: "bad_limit" };
  const limit = Math.min(Number(rawLimit), 60);
  const base = `${PUBLISHABLE_ITEMS}${lane ? " AND i.lane=?" : ""}`;
  const params = lane ? [lane] : [];
  let end = requested, fallbackUsed = false;
  if (window === "daily" && !url.searchParams.has("date")) {
    const latest = await db.prepare(`SELECT MAX(${ITEM_DAY}) AS day ${base} AND ${ITEM_DAY}<=?`).bind(...params, requested).first();
    if (latest?.day !== requested) { fallbackUsed = true; end = latest?.day || requested; }
  }
  const start = window === "weekly" ? new Date(Date.parse(end) - 6 * 86400000).toISOString().slice(0, 10) : end;
  const rows = (await db.prepare(`SELECT COALESCE(i.title_zh,i.title) AS title,i.url,i.source,i.lane,i.score,i.summary,i.key_points,k.tags,i.published_at
    ${base} AND ${ITEM_DAY} BETWEEN ? AND ? ORDER BY i.score DESC,i.published_at DESC,i.id LIMIT ?`).bind(...params, start, end, limit).all()).results;
  const items = rows.map((r) => ({ title: r.title, url: r.url, source: r.source, lane: r.lane, score: r.score,
    summary: r.summary, key_points: strings(r.key_points), tags: strings(r.tags), published_at: r.published_at }));
  const lanes = [...new Set(items.map((i) => i.lane))].map((lane) => {
    const grouped = items.filter((i) => i.lane === lane);
    return { lane, count: grouped.length, items: grouped };
  }).sort((a, b) => b.count - a.count || (b.items[0].score ?? -Infinity) - (a.items[0].score ?? -Infinity) || a.lane.localeCompare(b.lane));
  return { window, timezone: "Asia/Hong_Kong", date_label: window === "weekly" ? `${start} ~ ${end}` : end,
    generated_at: new Date(nowMs).toISOString(), total_items: items.length, fallback_used: fallbackUsed, ai_calls: 0,
    top_highlights: items.slice(0, 3), lanes };
}
