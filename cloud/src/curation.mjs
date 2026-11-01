// P0 curation helpers: URL normalization, title SimHash dedup, mutes, per-category quotas, KB Markdown export.
const TRACK = /^(utm_[a-z]+|fbclid|gclid|mc_[a-z]+|ref|ref_src|ref_url|s|t|si|igshid|cmpid|source|via)$/iu;

export function normalizeUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    u.hash = ""; u.hostname = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./u, "");
    if (u.hostname === "twitter.com") u.hostname = "x.com";
    for (const k of [...u.searchParams.keys()]) if (TRACK.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    let p = u.pathname.replace(/\/{2,}/gu, "/"); if (p.length > 1) p = p.replace(/\/$/u, "");
    return `${u.hostname}${p}${u.searchParams.toString() ? "?" + u.searchParams : ""}`;
  } catch { return null; }
}

const normTitle = (s) => String(s ?? "").toLowerCase().normalize("NFKC").replace(/https?:\/\/\S+/gu, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function fnv64(s) { let h = 0xcbf29ce484222325n; for (const c of new TextEncoder().encode(s)) { h ^= BigInt(c); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; } return h; }
// Tokens: words for latin text, char bigrams for CJK runs (works for 繁/簡中).
function tokens(t) {
  const out = [];
  for (const w of t.split(" ").filter(Boolean)) {
    if (/\p{Script=Han}/u.test(w)) { const ch = [...w]; if (ch.length === 1) out.push(w); for (let i = 0; i < ch.length - 1; i++) out.push(ch[i] + ch[i + 1]); }
    else out.push(w);
  }
  return out;
}
export function simhash(title) {
  const ts = tokens(normTitle(title)); if (!ts.length) return null;
  const v = new Array(64).fill(0);
  for (const t of ts) { const h = fnv64(t); for (let i = 0; i < 64; i++) v[i] += (h >> BigInt(i)) & 1n ? 1 : -1; }
  let r = 0n; for (let i = 0; i < 64; i++) if (v[i] > 0) r |= 1n << BigInt(i); return r;
}
export function hamming(a, b) { let x = a ^ b, n = 0; while (x) { x &= x - 1n; n++; } return n; }

export const isX = (it) => String(it.source || "").startsWith("x:@") || it.category === "X_POST";
export const handleOf = (it) => (String(it.source || "").match(/^x:@(.+)$/u) || [])[1]?.toLowerCase() ?? null;

export function isMuted(it, mutes) {
  const text = `${it.title || ""} ${it.title_zh || ""} ${it.summary || ""}`.toLowerCase();
  return mutes.some((m) => m.kind === "handle" ? handleOf(it) === m.value.replace(/^@/u, "").toLowerCase()
    : m.kind === "topic" ? String(it.category || "").toLowerCase() === m.value.toLowerCase()
    : text.includes(m.value.toLowerCase()));
}

// Collapse near-duplicates (same normalized URL or title SimHash distance <= maxDist). Input must be ranked best-first.
export function dedup(items, maxDist = 3) {
  const kept = []; const seenUrl = new Map();
  for (const it of items) {
    const u = it.url_norm || normalizeUrl(it.url); const h = simhash(it.title_original || it.title);
    let dupOf = u ? seenUrl.get(u) : undefined;
    if (!dupOf && h != null) dupOf = kept.find((k) => k._h != null && hamming(k._h, h) <= maxDist && normTitle(k.title_original || k.title).length >= 12);
    if (dupOf) { dupOf.dup_count = (dupOf.dup_count || 0) + 1; (dupOf.dup_sources ||= []).push({ source: it.source, url: it.url || null, title: it.title_zh || it.title || "" }); continue; }
    const k = { ...it, _h: h }; kept.push(k); if (u) seenUrl.set(u, k);
  }
  return kept.map(({ _h, ...k }) => k);
}

// Home feed quotas: X share <= xShare of final list, <= perHandle per X account, <= perCategory per non-X category.
export function applyQuotas(items, { xShare = 0.3, perHandle = 2, perCategory = 12, minX = 3 } = {}) {
  const nonX = []; const catN = {};
  for (const it of items) if (!isX(it)) { const c = it.category || "_"; if ((catN[c] = (catN[c] || 0) + 1) <= perCategory) nonX.push(it); }
  const xCap = Math.max(minX, Math.floor((nonX.length * xShare) / (1 - xShare)));
  const xs = []; const hN = {};
  for (const it of items) if (isX(it) && xs.length < xCap) { const h = handleOf(it) || "_"; if ((hN[h] = (hN[h] || 0) + 1) <= perHandle) xs.push(it); }
  const keep = new Set([...nonX, ...xs]);
  return { items: items.filter((i) => keep.has(i)), held: items.length - keep.size, xCap };
}

// ---- KB Markdown + YAML frontmatter (Obsidian-friendly) ----
const y = (v) => JSON.stringify(v ?? null); // JSON scalars are valid YAML
export function slug(s) { return String(s || "note").normalize("NFKC").replace(/[\\/:*?"<>|#^[\]\n\r]+/gu, " ").replace(/\s+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 60) || "note"; }
export function kbMarkdown(e) {
  const kp = Array.isArray(e.key_points) ? e.key_points : []; const tags = Array.isArray(e.tags) ? e.tags : []; const hl = Array.isArray(e.highlights) ? e.highlights : [];
  const type = e.kb_type || "item";
  const fm = ["---", `radar_id: ${y(e.id)}`, `title: ${y(e.title)}`, `type: ${y(type)}`, `url: ${y(e.url)}`, `source: ${y(e.source)}`, `category: ${y(e.category)}`,
    `score: ${e.score ?? "null"}`, `origin: ${y(e.origin)}`, `tags: [${["radar", ...tags].map(y).join(", ")}]`, ...(Array.isArray(e.source_ids) && e.source_ids.length ? [`sources: [${e.source_ids.map(y).join(", ")}]`] : []),
    `created: ${y(e.created_at)}`, `updated: ${y(e.updated_at)}`, "---"];
  const body = type === "synthesis" ? [e.note || ""] : [e.summary || "", "", ...(kp.length ? ["## 重點", ...kp.map((k) => `- ${k}`), ""] : []),
    ...(hl.length ? ["## 標記重點", ...hl.map((h) => `> ${h.text}${h.note ? `\n\n${h.note}` : ""}\n`), ""] : []), ...(e.note ? ["## 筆記", e.note, ""] : [])];
  return [...fm, "", `# ${e.title}`, "", ...body, ...(e.url ? ["", `[原文](${e.url})`, ""] : [])].join("\n");
}
export const kbPath = (e) => `${String(e.created_at || "").slice(0, 10)}-${slug(e.title)}-${String(e.id).slice(0, 8)}.md`;
