#!/usr/bin/env node
// One-time: export local data/daily/*.json (+ optional library export JSON) into a D1 SQL file.
// Writes SQL only. Apply manually: local `wrangler d1 execute ai-pm-radar --local --file ...`; remote only after owner approval.
// Usage: node cloud/scripts/export-local-to-d1.mjs [--library path/to/library-export.json] [--out cloud/.import/import.sql]
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

const args = process.argv.slice(2); const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const root = new URL("../..", import.meta.url).pathname;
const out = arg("--out") ?? join(root, "cloud/.import/import.sql");
const q = (v) => v == null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const idFor = (s) => { const h = createHash("sha256").update(s).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const rows = [];
export function toRow(a, { date, kind = "library", status = "approved" }) {
  const title = a.question_title || a.title || a.short_title; if (!title) return null;
  const url = a.url || a.source_url || a.link || null; const now = new Date().toISOString();
  const kp = a.key_points || a.takeaways || [a.why_it_matters, a.business_angle].filter(Boolean);
  return [idFor(`${kind}|${url || title}`), kind, status, title, url, a.source || "local-import", a.category || null,
    a.summary || null, JSON.stringify(kp), typeof a.score === "number" ? a.score : null, null, "local-import", date || null, a.created_at || now, now];
}
const dailyDir = join(root, "data/daily");
for (const f of readdirSync(dailyDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))) {
  const j = JSON.parse(readFileSync(join(dailyDir, f), "utf8"));
  for (const a of j.articles ?? []) { const r = toRow(a, { date: j.date }); if (r) rows.push(r); }
}
const lib = arg("--library");
if (lib) { const j = JSON.parse(readFileSync(lib, "utf8")); for (const a of (Array.isArray(j) ? j : j.items ?? j.library ?? [])) { const r = toRow(a, { status: a.approved ? "approved" : "reviewed" }); if (r) rows.push(r); } }
const cols = "id,kind,status,title,url,source,category,summary,key_points,score,raw_excerpt,ai_provider,run_date,created_at,updated_at";
const sql = rows.map((r) => `INSERT OR IGNORE INTO items(${cols}) VALUES(${r.map(q).join(",")});`).join("\n") + "\n";
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, sql);
console.log(`wrote ${rows.length} rows -> ${out}`);
