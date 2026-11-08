// P1 reader view, bulk sources, bulk notes, KB synthesis helpers. Pure functions (unit-tested) + prompts.
import { decodeEntities } from "./collector.mjs";

// ---- SSRF guard: only public https/http hosts, no IP literals / localhost / internal names ----
export function safeFetchUrl(raw) {
  let u; try { u = new URL(String(raw)); } catch { return null; }
  if (!["https:", "http:"].includes(u.protocol) || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return null;
  if (/^[\d.]+$/u.test(h) || h.includes(":") || h.startsWith("[")) return null; // IPv4/IPv6 literals
  if (u.port && !["80", "443"].includes(u.port)) return null;
  return u.toString();
}

// ---- Readability-lite extraction ----
const DROP = /<(script|style|noscript|svg|nav|header|footer|aside|form|iframe|button|figure|template)\b[\s\S]*?<\/\1>/giu;
const txt = (s) => decodeEntities(decodeEntities(String(s ?? "").replace(/<br\s*\/?>/giu, " ").replace(/<[^>]+>/gu, " "))).replace(/\s+/gu, " ").trim();
const meta = (html, re) => { const m = html.match(re); return m ? txt(m[1]) : ""; };
const PAYWALL = /(subscribe to (continue|read)|already a subscriber|sign in to (continue|read)|this (article|content) is for (subscribers|members)|create a free account to continue|paywall)/iu;

export function extractArticle(html, url = "") {
  const src = String(html || "").slice(0, 2_000_000);
  const title = meta(src, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/iu) || meta(src, /<title[^>]*>([\s\S]*?)<\/title>/iu);
  const byline = meta(src, /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)/iu);
  const site = meta(src, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/iu) || (() => { try { return new URL(url).hostname; } catch { return ""; } })();
  const body = src.replace(/<!--[\s\S]*?-->/gu, " ").replace(DROP, " ");
  // Candidate containers: <article>, <main>, [itemprop=articleBody], or whole body.
  const cands = [...body.matchAll(/<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/giu)].map((m) => m[2]);
  const ib = body.match(/<[a-z]+[^>]+itemprop=["']articleBody["'][^>]*>([\s\S]*)/iu); if (ib) cands.push(ib[1]);
  cands.push(body);
  const paras = (h) => [...h.matchAll(/<(p|h2|h3|li|blockquote|pre)\b[^>]*>([\s\S]*?)<\/\1>/giu)]
    .map((m) => ({ tag: m[1].toLowerCase(), text: txt(m[2]) })).filter((p) => p.text.length >= (p.tag === "p" ? 25 : 3) && !/^(share|advertisement|related|read more)/iu.test(p.text));
  let best = []; for (const c of cands) { const p = paras(c); if (p.reduce((n, x) => n + x.text.length, 0) > best.reduce((n, x) => n + x.text.length, 0) * 1.15) best = p; }
  // de-dup repeated paragraphs, cap size
  const seen = new Set(); const out = []; let n = 0;
  const STOP = /^(most popular|newsletters?|latest in\b|related (articles|stories|posts)|more from|recommended|you (may|might) also like|trending|popular (now|stories)|comments?)\b/iu;
  const JUNK = /(we may earn a (small )?commission|affiliate (links?|commission)|subscribe (for|to) (the|our)|sign up for (our|the) newsletter|all rights reserved|cookie (policy|settings)|^senior (writer|editor|reporter)\b|^staff writer\b|^(buy one pass|book before))/iu;
  const real = best.filter((p) => p.tag === "p").length; let started = false;
  for (const p of best) {
    if (STOP.test(p.text) && (p.tag === "h2" || p.tag === "h3") && started) break;
    if (JUNK.test(p.text)) continue;
    if (p.tag === "li" && !started && real > 3) continue; // byline/nav lists before the body
    if (p.tag === "p" || p.tag === "blockquote" || p.tag === "pre") started = true;
    if (seen.has(p.text)) continue; seen.add(p.text); out.push(p); n += p.text.length; if (n > 60000) break; }
  const chars = out.reduce((s, p) => s + p.text.length, 0);
  const status = chars < 400 ? (PAYWALL.test(src) ? "paywall" : "failed") : (PAYWALL.test(src) && chars < 1500 ? "paywall" : "ok");
  // trailing related-link lists (li runs at the end) are rarely body text
  while (out.length > 3 && out[out.length - 1].tag === "li") out.pop();
  const cleanTitle = site && title ? title.replace(new RegExp(`\\s*[|\\-–—]\\s*${site.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*$`, "iu"), "") : title;
  return { title: cleanTitle, byline, site, paragraphs: out, chars: out.reduce((s, p) => s + p.text.length, 0), status };
}

// Chunk paragraphs to <= maxChars per chunk (keeps paragraph boundaries; splits giant paragraphs).
export function chunkParagraphs(paragraphs, maxChars = 2500) {
  const chunks = []; let cur = [], len = 0;
  const push = () => { if (cur.length) chunks.push(cur); cur = []; len = 0; };
  for (const p of paragraphs) {
    const parts = p.text.length > maxChars ? p.text.match(new RegExp(`[\\s\\S]{1,${maxChars}}`, "gu")) : [p.text];
    for (const t of parts) { if (len + t.length > maxChars) push(); cur.push({ tag: p.tag, text: t }); len += t.length; }
  }
  push(); return chunks;
}

export const TRANSLATE_PROMPT = `你是專業科技譯者。將輸入嘅英文（或其他外語）段落逐段翻譯成自然、易讀嘅繁體中文（香港讀者，可帶少量廣東話語氣，但專有名詞、產品名、人名保留英文）。輸入係 JSON {"paragraphs":[...]}。只輸出 JSON：{"paragraphs":[...]}，數量同次序必須同輸入一致，唔好加解釋。`;
export const parseTranslation = (expected) => (j) => {
  const p = Array.isArray(j.paragraphs) ? j.paragraphs.map((x) => String(x ?? "").slice(0, 6000)) : null;
  if (!p || !p.length) throw new Error("ai_bad_output");
  while (p.length < expected) p.push(""); return { paragraphs: p.slice(0, expected) };
};
export const READER_SUMMARY_PROMPT = `你是 AI PM Radar 的知識編輯。研究主題：一人公司、低成本變現、訊息差、AI 資訊、前端科技學習（React/CSS/workflow），並服務 AI PM 與顧問研究。閱讀全文後只輸出 JSON：{"title_zh":string,"tldr":string(繁體中文,<=80字),"key_points":string[4-7](繁體中文,具體),"why_ai_pm":string(繁體中文,<=100字,對 AI PM/顧問工作有咩用),"why_side_income":string(繁體中文,<=100字,對副業/個人 IP 有咩用；冇就寫「暫無」),"actions":string[1-3](繁體中文,可即做嘅下一步)}。社交短帖請用一句話說明「點解值得收藏」並加精簡標籤，不要改寫成新聞文章。唔好加解釋。內容不足時輸出 {"error":"insufficient_content"}。`;
const sa = (v, n) => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 400)).filter(Boolean).slice(0, n) : []);
export const parseReaderSummary = (j) => {
  const key_points = sa(j.key_points, 8); if (!key_points.length || typeof j.tldr !== "string") throw new Error("ai_bad_output");
  return { title_zh: String(j.title_zh || "").slice(0, 200), tldr: j.tldr.slice(0, 500), key_points, why_ai_pm: String(j.why_ai_pm || "").slice(0, 500), why_side_income: String(j.why_side_income || "").slice(0, 500), actions: sa(j.actions, 3) };
};
export const SYNTH_PROMPT = `你是 AI PM Radar 的研究整理員。輸入係多篇知識庫筆記（JSON 陣列，每篇有 n 編號、title、url、內容）。將佢哋整合成一份結構化綜合筆記，只輸出 JSON：{"title":string(繁體中文),"summary":string(繁體中文,<=150字),"themes":[{"name":string,"points":string[]}](2-5 個主題；優先歸入一人公司、低成本變現、訊息差、AI 資訊、前端科技學習，亦保留 AI PM/顧問研究),"insights":string[3-7](跨筆記嘅關鍵洞察；每點尾用 [n] 標明出處編號),"actions":string[2-5](可執行下一步),"open_questions":string[0-3]}。只用輸入內容，唔好虛構。`;
export const parseSynthesis = (j) => {
  const themes = Array.isArray(j.themes) ? j.themes.slice(0, 6).map((t) => ({ name: String(t?.name || "").slice(0, 80), points: sa(t?.points, 6) })).filter((t) => t.name) : [];
  const insights = sa(j.insights, 8); if (!j.title || !insights.length) throw new Error("ai_bad_output");
  return { title: String(j.title).slice(0, 200), summary: String(j.summary || "").slice(0, 800), themes, insights, actions: sa(j.actions, 5), open_questions: sa(j.open_questions, 3) };
};
export function synthesisMarkdown(s, sources) {
  return [`## 摘要`, s.summary, "", "## 主題", ...s.themes.flatMap((t) => [`### ${t.name}`, ...t.points.map((p) => `- ${p}`), ""]),
    "## 關鍵洞察", ...s.insights.map((p) => `- ${p}`), "", "## 行動", ...s.actions.map((p) => `- [ ] ${p}`), "",
    ...(s.open_questions.length ? ["## 未解問題", ...s.open_questions.map((p) => `- ${p}`), ""] : []),
    "## 來源", ...sources.map((x, i) => `${i + 1}. ${x.url ? `[${x.title}](${x.url})` : x.title}`)].join("\n");
}

// ---- Bulk sources: one per line ----
const HANDLE = /^@?([A-Za-z0-9_]{1,15})$/u;
export function parseSourceLines(text) {
  const rows = []; const seen = new Set();
  for (const raw of String(text || "").split(/\r?\n/u).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).slice(0, 100)) {
    let type = null, value = null, error = null;
    const xm = raw.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/?(?:\?.*)?$/iu);
    if (xm && !["home", "search", "i", "explore"].includes(xm[1].toLowerCase())) { type = "x"; value = "@" + xm[1]; }
    else if (HANDLE.test(raw) && raw.startsWith("@")) { type = "x"; value = "@" + raw.match(HANDLE)[1]; }
    else if (/^https:\/\/\S+$/u.test(raw)) { type = "rss"; value = raw; }
    else if (/^http:\/\//u.test(raw)) error = "需要 https";
    else error = "唔識別（要 https:// 網址或 @handle）";
    const key = type === "x" ? `x:${value.toLowerCase()}` : `rss:${value}`;
    if (type && seen.has(key)) { rows.push({ line: raw, type, value, status: "duplicate_in_batch" }); continue; }
    if (type) seen.add(key);
    rows.push({ line: raw, type, value, status: error ? "invalid" : "pending", error });
  }
  return rows;
}
export const looksLikeFeed = (body) => /<(rss|feed|rdf:RDF)\b/iu.test(String(body).slice(0, 4000));
export function discoverFeed(html, base) {
  const m = String(html).match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/iu); if (!m) return null;
  const h = m[0].match(/href=["']([^"']+)/iu); if (!h) return null; try { const u = new URL(decodeEntities(h[1]), base); return u.protocol === "https:" ? u.toString() : null; } catch { return null; }
}

// ---- Bulk notes import: Markdown/text blocks separated by '---' lines, or '# ' headings, or one URL per line ----
export function parseNotes(text) {
  const t = String(text || "").replace(/\r\n/gu, "\n").trim(); if (!t) return [];
  let blocks;
  if (/^\s*-{3,}\s*$/mu.test(t)) blocks = t.split(/^\s*-{3,}\s*$/mu);
  else if ((t.match(/^#\s+/gmu) || []).length > 1) blocks = t.split(/^(?=#\s+)/mu);
  else if (t.split("\n").every((l) => !l.trim() || /^https?:\/\/\S+$/u.test(l.trim()))) blocks = t.split("\n");
  else blocks = t.split(/\n{3,}/u);
  return blocks.map((b) => b.trim()).filter(Boolean).slice(0, 50).map((b) => {
    const lines = b.split("\n"); const first = lines[0].replace(/^#+\s*/u, "").trim();
    const url = (b.match(/https?:\/\/[^\s)>\]]+/u) || [])[0] || null;
    const tags = [...new Set([...b.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,30})/gu)].map((m) => m[1]))].slice(0, 10);
    const title = (/^https?:\/\//u.test(first) ? (url ? new URL(url).hostname + new URL(url).pathname.slice(0, 40) : first) : first).slice(0, 200) || "未命名筆記";
    const body = lines.slice(/^#/u.test(lines[0]) ? 1 : 0).join("\n").trim();
    return { title, url, tags, note: (body || b).slice(0, 8000) };
  });
}
