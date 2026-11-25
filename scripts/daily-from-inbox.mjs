import { mkdir, open, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeUrl } from "../cloud/src/curation.mjs";

const SOURCE_IDS = new Set(["openai", "anthropic", "techcrunch-ai", "coursera-ai", "huggingface", "hackernews"]);
const GENERATED_BY = "scripts/daily-from-inbox.mjs";

export function hktDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function validTime(value) {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}

function canonicalUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return normalizeUrl(value);
  } catch { return null; }
}

function rank(a, b) {
  return b.pref_score - a.pref_score
    || (validTime(b.publishedAt) ?? validTime(b.discoveredAt) ?? 0) - (validTime(a.publishedAt) ?? validTime(a.discoveredAt) ?? 0)
    || a.url.localeCompare(b.url);
}

export function selectDailyCandidates(items, now = new Date(), limit = 10) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Limit must be a positive integer.");
  const date = hktDate(now);
  const eligible = [];
  const held = [];
  for (const item of items) {
    if (!item || item.local_fixture === true || item.synthetic === true || !SOURCE_IDS.has(item.sourceId)) continue;
    if (item.reviewStatus !== "needs_review" || !canonicalUrl(item.url) || typeof item.title !== "string" || !item.title.trim()) continue;
    if (!validTime(item.discoveredAt) || hktDate(new Date(item.discoveredAt)) !== date) continue;
    if (item.injection_suspect === true || item.curation_status === "quarantine") { held.push({ sourceId: item.sourceId, url: item.url, reason: item.curation_reason || (item.injection_suspect ? "injection_suspect" : "curation_quarantine") }); continue; }
    if (item.pref_breakdown?.dimensions?.relevance?.status !== "observed") { held.push({ sourceId: item.sourceId, url: item.url, reason: "relevance_unknown" }); continue; }
    if (!Number.isFinite(item.pref_score)) { held.push({ sourceId: item.sourceId, url: item.url, reason: "preference_score_unknown" }); continue; }
    eligible.push(item);
  }

  const byUrl = new Map();
  for (const item of eligible.sort(rank)) {
    const key = canonicalUrl(item.url);
    if (!byUrl.has(key)) byUrl.set(key, item);
  }
  const selected = [...byUrl.values()].slice(0, limit);
  return { selected, held, eligibleCount: byUrl.size };
}

export async function buildDailyFromInbox({ inboxPath = ".runtime/daily-radar-inbox.json", outputDir = "data/daily", now = new Date(), limit = 10 } = {}) {
  const date = hktDate(now);
  const inbox = JSON.parse(await readFile(inboxPath, "utf8"));
  if (!inbox || !Array.isArray(inbox.items)) throw new Error("Inbox must contain an items array.");
  const { selected, held } = selectDailyCandidates(inbox.items, now, limit);
  if (selected.length < 3) throw new Error(`Only ${selected.length} real, same-day, unique candidates; need at least 3. Held ${held.length} injection-suspect items. No daily file written.`);

  const articles = selected.map((item) => {
    const published = validTime(item.publishedAt);
    const sourceName = item.sourceId === "hackernews" ? "Hacker News" : item.sourceId;
    return {
      question_title: item.title.trim(), short_title: item.title.trim(),
      summary: typeof item.summary === "string" && item.summary.trim() ? item.summary.trim() : `Source headline: ${item.title.trim()}`,
      why_it_matters: "Candidate for human review; significance has not been assessed.",
      business_angle: "Pending human assessment of business relevance.",
      ai_pm_angle: "Pending human assessment of AI product relevance.",
      risk_note: "Source content, publication date, and claims require human verification before any publication.",
      category: item.category || "OTHER", tags: [item.lane || "OTHER"],
      source_name: sourceName, source_url: item.url,
      published_at: published ? new Date(published).toISOString() : new Date(item.discoveredAt).toISOString(),
      published_at_basis: published ? "source" : "discovered_at_fallback",
      impact_score: 1, relevance_score: 1, trust_score: 1,
      lane: item.lane, pref_score: item.pref_score, pref_reasons: item.pref_reasons,
      needs_review: true, generated_by: GENERATED_BY,
      review: { status: "draft", human_review_required: true, review_notes: "Automatically collected draft. Scores are placeholders; verify source and write editorial analysis before publication." },
    };
  });
  const payload = { date, generated_by: GENERATED_BY, review: { status: "draft" }, needs_review: true, held, articles };
  await mkdir(outputDir, { recursive: true });
  const target = resolve(outputDir, `${date}.json`);
  const file = await open(target, "wx", 0o600);
  try { await file.writeFile(`${JSON.stringify(payload, null, 2)}\n`); }
  finally { await file.close(); }
  return { target, selected: selected.length, held: held.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  try {
    const limitValue = option("--limit");
    const result = await buildDailyFromInbox({
      inboxPath: option("--inbox") || undefined,
      outputDir: option("--output-dir") || undefined,
      limit: limitValue === undefined ? 10 : Number(limitValue),
    });
    console.log(`Wrote review-gated daily draft: ${result.target} (${result.selected} articles; ${result.held} held).`);
  } catch (error) {
    console.error(error?.code === "EEXIST" ? "Refusing to overwrite an existing daily JSON file." : `Daily draft failed: ${error.message}`);
    process.exitCode = /need at least 3/u.test(error.message) ? 3 : 1;
  }
}
