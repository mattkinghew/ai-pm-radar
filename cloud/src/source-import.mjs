import { normalizeUrl } from "./curation.mjs";
import { safeFetchUrl, parseSourceLines } from "./reader.mjs";

const TYPES = new Set(["rss", "x", "github_search", "github_releases", "youtube_channel"]);
const MAX_BYTES = 1_000_000;
const MAX_ROWS = 100;

const xmlText = (value) => String(value || "").replace(/&#(\d+);/gu, (_, n) => String.fromCodePoint(Math.min(0x10ffff, Number(n))))
  .replace(/&#x([\da-f]+);/giu, (_, n) => String.fromCodePoint(Math.min(0x10ffff, Number.parseInt(n, 16))))
  .replace(/&(amp|quot|apos|lt|gt);/giu, (_, name) => ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" })[name.toLowerCase()]);

function parseCsv(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === ",") { row.push(cell.trim()); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) return { error: "import_too_many_rows", rows: [] };
    } else cell += c;
  }
  if (quoted) return { error: "csv_unclosed_quote", rows: [] };
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return { rows: rows.slice(0, MAX_ROWS + 1) };
}

function opmlRows(text) {
  if (!/<opml\b/iu.test(text)) return { error: "opml_invalid", rows: [] };
  if (/<!DOCTYPE|<!ENTITY/iu.test(text)) return { error: "opml_unsafe_declaration", rows: [] };
  const rows = [];
  for (const match of text.matchAll(/<outline\b([^>]*)\/?\s*>/giu)) {
    const attrs = {};
    for (const a of match[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) attrs[a[1].toLowerCase()] = xmlText(a[2] ?? a[3]);
    const url = attrs.xmlurl || attrs.url;
    if (url) {
      const source = parseSourceLines(url)[0] || { type: null, value: url, status: "needs_map", error: "needs_map" };
      rows.push({ type: source.type, value: source.value || url, status: source.status, error: source.error, label: (attrs.title || attrs.text || "").slice(0, 160), category: (attrs.category || "").slice(0, 160), line: rows.length + 1 });
    }
    if (rows.length > MAX_ROWS) return { error: "import_too_many_rows", rows: [] };
  }
  return { rows };
}

function suggestedMapping(headers) {
  const find = (re) => headers.find((h) => re.test(h.trim().toLowerCase())) || "";
  return { url: find(/^(url|feed[ _-]?url|xml[ _-]?url|website|link|query|search[ _-]?query)$/u), title: find(/^(title|name|label)$/u), handle: find(/^(handle|username|account)$/u), adapter_type: find(/^(adapter[ _-]?type|source[ _-]?type|type|adapter)$/u), category: find(/^(category|folder|group)$/u) };
}

function csvRows(text, mapping) {
  const parsed = parseCsv(text);
  if (parsed.error) return { error: parsed.error, headers: [], rows: [] };
  if (!parsed.rows.length) return { error: "csv_empty", headers: [], rows: [] };
  const headers = parsed.rows[0].map((h) => h.replace(/^\uFEFF/u, "").trim());
  const suggested = suggestedMapping(headers);
  if (!mapping || typeof mapping !== "object") return { mapping_required: true, headers, suggested, rows: [] };
  const index = Object.fromEntries(["url", "title", "handle", "adapter_type", "category"].map((k) => { const header = String(mapping[k] || ""); return [k, header ? headers.indexOf(header) : -1]; }));
  if (index.url < 0 && index.handle < 0) return { error: "csv_mapping_missing_source", headers, suggested, rows: [] };
  const rows = parsed.rows.slice(1, MAX_ROWS + 1).map((values, i) => {
    const get = (key) => index[key] >= 0 ? String(values[index[key]] || "").trim() : "";
    const url = get("url"), handle = get("handle");
    let type = get("adapter_type").toLowerCase();
    type = ({ atom: "rss", feed: "rss", twitter: "x", x_post: "x", github: "github_search", youtube: "youtube_channel" })[type] || type;
    let value = type === "x" ? (handle ? (handle.startsWith("@") ? handle : `@${handle}`) : url) : url || handle;
    let inferred = null;
    if (!type) {
      inferred = handle ? { type: "x", value: handle.startsWith("@") ? handle : `@${handle}`, status: "pending" } : parseSourceLines(value)[0];
      type = inferred?.type || "";
      value = inferred?.value || value;
    }
    return { type, value, label: get("title").slice(0, 160), category: get("category").slice(0, 160), line: i + 2,
      ...(inferred?.status === "needs_map" || inferred?.status === "invalid" ? { status: inferred.status, error: inferred.error } : {}) };
  });
  return { headers, suggested, rows };
}

export function canonicalSourceValue(type, value) {
  const raw = String(value || "").trim();
  if (type === "rss") return normalizeUrl(raw) || raw.toLowerCase();
  if (type === "x") return raw.replace(/^@/u, "").toLowerCase();
  if (type === "github_releases") return raw.replace(/^https?:\/\/(?:www\.)?github\.com\//iu, "").replace(/\/releases\/?$/iu, "").replace(/\/$/u, "").replace(/\.git$/iu, "").toLowerCase();
  return raw.toLocaleLowerCase().replace(/\s+/gu, " ");
}

export function validateSourceImportRow(row) {
  const type = String(row?.type || row?.adapter_type || "").toLowerCase();
  let value = String(row?.value || "").trim();
  const label = String(row?.label || "").trim().slice(0, 160) || null;
  const category = String(row?.category || "").trim().slice(0, 160) || null;
  let error = null;
  if (!TYPES.has(type)) error = "unsupported_adapter_type";
  else if (!value || value.length > 2048) error = "source_value_required_or_too_long";
  else if (type === "rss" && (!/^https:\/\//iu.test(value) || !safeFetchUrl(value))) error = "unsafe_or_invalid_url";
  else if (type === "x") {
    const fromUrl = value.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/?$/iu)?.[1];
    value = `@${fromUrl || value.replace(/^@/u, "")}`;
    if (!/^@[A-Za-z0-9_]{1,15}$/u.test(value)) error = "invalid_x_handle";
  } else if (type === "github_releases") {
    value = value.replace(/^https?:\/\/(?:www\.)?github\.com\//iu, "").replace(/\/releases\/?$/iu, "").replace(/\/$/u, "").replace(/\.git$/iu, "");
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value)) error = "invalid_github_repository";
  } else if (type === "youtube_channel") {
    if (/^https:\/\//iu.test(value)) {
      try { const url = new URL(value); if (url.hostname.toLowerCase().replace(/^www\./u, "") === "youtube.com" && url.pathname === "/feeds/videos.xml") value = url.searchParams.get("channel_id") || ""; }
      catch { /* validation below returns the stable invalid-channel code */ }
    }
    if (!/^UC[A-Za-z0-9_-]{20,}$/u.test(value)) error = "invalid_youtube_channel";
  } else if (type === "github_search") {
    if (/^https:\/\//iu.test(value)) {
      try { const url = new URL(value); if (url.hostname.toLowerCase().replace(/^www\./u, "") === "github.com" && url.pathname === "/search") value = url.searchParams.get("q") || ""; }
      catch { /* validation below returns the stable invalid-query code */ }
    }
    if (!value || value.length > 160) error = "invalid_github_search_query";
  }
  return { type, value, label, category, canonical_value: canonicalSourceValue(type, value), status: error ? "invalid" : "new", error };
}

export function parseSourceImport({ format, content, mapping } = {}) {
  const text = String(content || "").replace(/^\uFEFF/u, "");
  if (new TextEncoder().encode(text).length > MAX_BYTES) return { error: "import_too_large", rows: [] };
  let parsed;
  if (format === "csv") parsed = csvRows(text, mapping);
  else if (format === "opml") parsed = opmlRows(text);
  else if (format === "text") {
    const inputRows = text.split(/\r?\n/u).filter((line) => line.trim() && !line.trim().startsWith("#"));
    if (inputRows.length > MAX_ROWS) return { error: "import_too_many_rows", rows: [] };
    parsed = { rows: parseSourceLines(text).map((r) => ({ type: r.type, value: r.value, label: "", category: "", line: r.line, error: r.error, status: r.status })) };
  }
  else return { error: "unsupported_import_format", rows: [] };
  if (parsed.error || parsed.mapping_required) return { ...parsed, rows: parsed.rows || [] };
  if ((parsed.rows || []).length > MAX_ROWS) return { error: "import_too_many_rows", rows: [] };
  const seen = new Set();
  const rows = (parsed.rows || []).slice(0, MAX_ROWS).map((row) => {
    if (row.status === "needs_map" || row.status === "invalid") return { ...row, canonical_value: null, status: row.status, error: row.error || row.status };
    const valid = validateSourceImportRow(row);
    if (valid.error || row.status === "invalid") return { ...valid, line: row.line, status: "invalid", error: valid.error || row.error || "invalid_source" };
    const key = `${valid.type}:${valid.canonical_value}`;
    if (seen.has(key)) return { ...valid, line: row.line, status: "duplicate_in_batch" };
    seen.add(key);
    return { ...valid, line: row.line, status: "new" };
  });
  return { headers: parsed.headers || [], suggested: parsed.suggested || null, rows };
}
