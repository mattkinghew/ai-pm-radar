// P0 curation helpers: URL normalization, title SimHash dedup, mutes, per-category quotas, KB Markdown export.
const TRACK = /^(utm_[a-z]+|fbclid|gclid|mc_[a-z]+|ref|ref_src|ref_url|s|t|si|igshid|cmpid|source|via)$/iu;

// One editable vocabulary table drives lane assignment and deterministic preference scoring.
export const LANE_RULES = [
  { id: "paid_pilot", lane: "MONETIZATION_GAP", weight: 25, terms: ["paid pilot", "real customer pain", "willingness to pay", "pricing", "productized service", "side hustle", "side income", "b2b gtm", "client interview", "付費試點", "付費 pilot", "副業變現", "副業收入", "真實客戶痛點", "願意付費", "定價", "產品化服務", "香港 SME", "付費意願"] },
  { id: "agent_governance", lane: "AGENT_GOVERNANCE", weight: 20, terms: ["agent evaluation", "agent eval", "evals", "harness", "permission boundary", "prompt injection", "release quality", "代理評測", "代理評估", "執行環境治理", "權限邊界", "提示注入", "發布品質", "安全審核"] },
  { id: "content_workflow", lane: "CONTENT_WORKFLOW", weight: 15, terms: ["content workflow", "original content qa", "video production cost", "repeatable template", "shorts generator", "影片工作流", "影片製作成本", "原創內容質素", "文案質素", "可重用模板", "短片生成"] },
  { id: "free_resource", lane: "FREE_RESOURCE", weight: 10, terms: ["official free credits", "verified model release", "low-cost compute", "官方免費額度", "官方 credits", "已核實模型發布", "低成本算力"] },
  { id: "free_resource_lane", lane: "FREE_RESOURCE", weight: 0, terms: ["free gpu", "free course", "free certification", "免費 gpu", "免費課程", "免費證照", "免費 credits"] },
  { id: "learning_path", lane: "AI_LEARNING_PATH", weight: 0, terms: ["learning path", "course", "certification", "學習路徑", "課程", "證照", "學習"] },
  { id: "github_project", lane: "GITHUB_PROJECT", weight: 0, terms: ["github", "open source", "repository", "開源專案", "開源工具", "github 專案"] },
  { id: "tech_news", lane: "TECH_NEWS", weight: 0, terms: ["model release", "launches", "announces", "推出新模型", "官方發布", "模型更新", "技術新聞"] },
  { id: "apply_now", lane: "APPLY_NOW", weight: 0, terms: ["apply now", "workflow", "implementation", "practical", "solopreneur", "one-person business", "一人公司", "一人企業", "即時應用", "實作", "落地", "工作流程"] },
  { id: "hype_only", lane: null, weight: -20, terms: ["viral", "game changer", "爆紅", "顛覆一切", "史上最強", "未經證實", "無行動"] },
  { id: "copyright_reupload", lane: null, weight: -30, terms: ["re-upload", "copyright reupload", "unauthorized scraping", "未經授權搬運", "未授權批量抓取", "無署名搬運"] },
  { id: "unverified_incident", lane: null, weight: -30, terms: ["unattributed security incident", "unverified attack attribution", "未核實網安事件歸因", "未經證實攻擊歸因"] },
];
export const LANES = ["AI_LEARNING_PATH", "MONETIZATION_GAP", "TECH_NEWS", "GITHUB_PROJECT", "APPLY_NOW", "FREE_RESOURCE", "AGENT_GOVERNANCE", "CONTENT_WORKFLOW", "OTHER"];
const foldText = (s) => String(s ?? "").normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, " ");
export const normalizeTrainTerm = (s) => foldText(s).trim();
// Preserve the first copy of each run of identical paragraphs; this is presentation cleanup, not semantic dedupe.
export function collapseRepeatedParagraphs(value) {
  const paragraphs = String(value ?? "").split(/\n(?:[ \t]*\n)+/u).map((part) => part.trim()).filter(Boolean);
  const out = []; let previous = null;
  for (const paragraph of paragraphs) {
    const key = paragraph.replace(/[\t ]+/gu, " ").replace(/\s*\n\s*/gu, "\n").trim();
    if (key !== previous) out.push(paragraph);
    previous = key;
  }
  return out.join("\n\n");
}
export function feedbackOverlay(item, weights) {
  const text = foldText([item.title, item.title_zh, item.summary, ...(Array.isArray(item.tags) ? item.tags : [])].filter(Boolean).join(" "));
  const keys = new Set([item.source, item.category ? `cat:${item.category}` : null].filter(Boolean));
  const matched = weights.filter(({ key, weight }) => {
    if (!Number(weight)) return false;
    if (keys.has(key)) return true;
    const term = key.startsWith("kw:") ? key.slice(3) : key.startsWith("tag:") ? key.slice(4) : null;
    return !!term && text.includes(term);
  }).sort((a, b) => a.key.localeCompare(b.key));
  const sum = matched.reduce((n, row) => n + Number(row.weight), 0);
  return { feedback_adj: Math.max(-2, Math.min(3, sum)), train_reasons: matched.map(({ key, weight }) => ({ key, weight: Number(weight) })) };
}
export function injectionSuspect(text) {
  const value = String(text ?? "");
  if (/(ignore (?:all )?(?:previous|prior) instructions|disregard (?:the )?system prompt|忽略(?:之前|以上|所有).{0,8}(?:指令|提示)|請(?:立即)?(?:寄送|轉寄|執行)|send (?:this|the) email|(?:e-?mail|郵件|電郵).{0,80}(?:please|action|send|transfer|reply|click|open|download|請|立即|轉寄|點擊|下載)|https?:\/\/[^\s]*(?:\.zip|\.exe|\.ru\b))/iu.test(value)) return true;
  for (const raw of value.match(/https?:\/\/[^\s<>"']+/giu) || []) {
    try { const u = new URL(raw.replace(/[),.;!?]+$/u, "")); if (u.username || u.password || /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(u.hostname) || /(^|\.)localhost$|\.xn--|\.(zip|click|top|ru)$/iu.test(u.hostname)) return true; } catch { return true; }
  }
  return false;
}
export function scoreLane(item, { sourceWeight = 0, nowMs = Date.now() } = {}) {
  const text = foldText([item.title, item.title_zh, item.summary, item.raw_excerpt, item.description].filter(Boolean).join(" "));
  const matched = LANE_RULES.filter((r) => r.terms.some((term) => text.includes(foldText(term))));
  const laneCandidates = matched.filter((r) => r.lane);
  const legacyLane = { AI_TECH_NEWS: "TECH_NEWS", FREEBIE_CERT_DEAL: "FREE_RESOURCE", AI_PRACTICE: "APPLY_NOW", CAPTURE: "OTHER" }[item.category];
  const lane = laneCandidates.length ? laneCandidates.sort((a, b) => (b.terms.filter((t) => text.includes(foldText(t))).length - a.terms.filter((t) => text.includes(foldText(t))).length) || b.weight - a.weight || LANES.indexOf(a.lane) - LANES.indexOf(b.lane))[0].lane : item.lane || legacyLane || "OTHER";
  let score = matched.reduce((sum, r) => sum + r.weight, 0) + Math.max(-2, Math.min(2, Number(sourceWeight) || 0)) * 5;
  const reasons = matched.map((r) => r.id);
  const published = item.published_at ? Date.parse(item.published_at) : NaN;
  if (Number.isFinite(published)) {
    const ageDays = Math.max(0, (nowMs - published) / 86400000);
    const freshness = Math.round(Math.max(-10, 10 - ageDays)); score += freshness; reasons.push("freshness_published_at");
  } else reasons.push("freshness_unknown");
  if (Number(sourceWeight)) reasons.push("source_weight");
  return { lane, pref_score: Math.max(-100, Math.min(100, score)), pref_reasons: reasons, injection_suspect: injectionSuspect(text) };
}

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
