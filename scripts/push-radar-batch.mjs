#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SOURCES = ["threads_saved", "video_watch", "generic"];
const DEFAULT_URL = "https://radar-cloud.lamlab.cc/api/ingest/batch";
const COUNTERS = ["received", "inserted", "skipped_duplicates", "rejected"];

export function chunkItems(items) {
  const batches = [];
  for (let i = 0; i < items.length; i += 50) batches.push(items.slice(i, i + 50));
  return batches;
}

export async function pushBatches(items, { source, dryRun = false, env = process.env, fetchImpl = fetch }) {
  if (!SOURCES.includes(source) || !Array.isArray(items) || !items.length || typeof dryRun !== "boolean") throw new Error("invalid_input");
  const token = env.INGEST_API_TOKEN;
  if (typeof token !== "string" || !token.trim() || /\s/u.test(token)) throw new Error("INGEST_API_TOKEN is required and must not contain whitespace");
  let url;
  try {
    url = new URL(env.RADAR_INGEST_URL || DEFAULT_URL);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/api/ingest/batch") throw new Error();
  } catch { throw new Error("RADAR_INGEST_URL must be an HTTPS /api/ingest/batch URL without credentials, query or fragment"); }
  const total = { source_type: source, dry_run: dryRun, batches: 0, received: 0, inserted: 0, skipped_duplicates: 0, rejected: 0 };
  for (const batch of chunkItems(items)) {
    let response;
    try {
      response = await fetchImpl(url.href, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ source_type: source, items: batch, dry_run: dryRun }), redirect: "error", signal: AbortSignal.timeout(30000) });
    } catch { throw new Error(`batch ${total.batches + 1}: request_failed; prior batches may already be saved, retry is idempotent`); }
    if (!response.ok) throw new Error(`batch ${total.batches + 1}: HTTP ${response.status}; prior batches may already be saved, retry is idempotent`);
    let result;
    try { result = await response.json(); } catch { throw new Error(`batch ${total.batches + 1}: invalid_response`); }
    if (!result || result.ok !== true || result.source_type !== source || result.dry_run !== dryRun || result.received !== batch.length
      || COUNTERS.some((key) => !Number.isSafeInteger(result[key]) || result[key] < 0 || result[key] > batch.length)
      || result.inserted + result.skipped_duplicates + result.rejected > batch.length
      || (dryRun ? result.inserted !== 0 : result.inserted + result.skipped_duplicates + result.rejected !== batch.length)) throw new Error(`batch ${total.batches + 1}: invalid_response`);
    for (const key of COUNTERS) total[key] += result[key];
    total.batches++;
  }
  return total;
}

async function main() {
  const args = process.argv.slice(2); let source, file, dryRun = false;
  const usage = "Usage: node scripts/push-radar-batch.mjs --source threads_saved|video_watch|generic --file <path.json> [--dry-run]";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && !source) source = args[++i];
    else if (args[i] === "--file" && !file) file = args[++i];
    else if (args[i] === "--dry-run" && !dryRun) dryRun = true;
    else throw new Error(usage);
  }
  if (!SOURCES.includes(source) || !file) throw new Error(usage);
  let parsed;
  try { parsed = JSON.parse(await readFile(file, "utf8")); } catch { throw new Error("Unable to read a valid JSON input file"); }
  const items = Array.isArray(parsed) ? parsed : parsed?.items;
  const total = await pushBatches(items, { source, dryRun });
  console.log(JSON.stringify(total));
  if (total.rejected) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
