import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const sourcesDir = path.join(rootDir, "data", "sources");
const dailyDir = path.join(rootDir, "data", "daily");
const defaultNotesPath = path.join(sourcesDir, "today-source-notes.json");

const requiredNoteFields = [
  "title",
  "source_url",
  "source_name",
  "short_notes",
  "category",
];

function printUsage() {
  console.log(`Usage:
  npm run prepare:daily
  npm run prepare:daily -- --date YYYY-MM-DD
  npm run prepare:daily -- --write-draft
  npm run prepare:daily -- --notes data/sources/today-source-notes.json
  npm run prepare:daily -- --write-draft --force

Behavior:
  - Reads a manually prepared source-notes file.
  - Does not call external AI APIs.
  - Prints a schema-aligned daily draft by default.
  - Writes data/daily/YYYY-MM-DD.draft.json only when --write-draft is provided.
  - Refuses to replace an existing published daily JSON unless --force is provided.`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    help: args.includes("--help") || args.includes("-h"),
    force: args.includes("--force"),
    writeDraft: args.includes("--write-draft"),
  };

  const dateIndex = args.indexOf("--date");
  const notesIndex = args.indexOf("--notes");

  return {
    ...flags,
    date: dateIndex >= 0 ? args[dateIndex + 1] : undefined,
    notes: notesIndex >= 0 ? args[notesIndex + 1] : undefined,
  };
}

function formatToday() {
  return new Date().toISOString().slice(0, 10);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fileExists(filePath) {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

function assertValidDate(date) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(date)) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Date is not a valid calendar date.");
  }
}

function assertValidUrl(value, label) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new Error(`${label} must be a valid http/https URL.`);
  }
}

function truncateTitle(title) {
  if (title.length <= 48) {
    return title;
  }

  return `${title.slice(0, 45).trimEnd()}...`;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return ["manual-review"];
  }

  const normalized = tags.filter((tag) => isNonEmptyString(tag)).map((tag) => tag.trim());
  return normalized.length > 0 ? normalized : ["manual-review"];
}

function normalizeScore(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeReviewScoring(scoring) {
  return {
    ai_pm_relevance: normalizeScore(scoring?.ai_pm_relevance, 3),
    hk_relevance: normalizeScore(scoring?.hk_relevance, 3),
    actionability: normalizeScore(scoring?.actionability, 3),
    technical_depth: normalizeScore(scoring?.technical_depth, 3),
    portfolio_value: normalizeScore(scoring?.portfolio_value, 3),
  };
}

function validateNotes(notes, relativeNotesPath) {
  if (!Array.isArray(notes)) {
    throw new Error(`${relativeNotesPath} must contain a top-level array.`);
  }

  notes.forEach((note, index) => {
    if (!isObject(note)) {
      throw new Error(`Note ${index} must be an object.`);
    }

    for (const field of requiredNoteFields) {
      if (!isNonEmptyString(note[field])) {
        throw new Error(`Note ${index} is missing required field: ${field}.`);
      }
    }

    assertValidUrl(note.source_url, `Note ${index} source_url`);
  });
}

function buildArticle(note, date, index) {
  // Later, an approved AI drafting step could expand these fields from the
  // manually prepared notes, but this helper stays local-only and review-first.
  return {
    question_title:
      note.question_title ||
      `What should operators learn from signal ${index + 1}: ${note.title}?`,
    short_title: note.short_title || truncateTitle(note.title),
    summary: note.summary || note.short_notes,
    why_it_matters:
      note.why_it_matters ||
      "Human review required to finalize why this matters before publication.",
    business_angle:
      note.business_angle ||
      "Add a practical business implication during manual review before publishing.",
    ai_pm_angle:
      note.ai_pm_angle ||
      "Add the AI PM interpretation during manual review before publishing.",
    risk_note:
      note.risk_note ||
      "Review required to add a concrete risk, limitation, or governance caution.",
    category: note.category,
    tags: normalizeTags(note.tags),
    source_name: note.source_name,
    source_url: note.source_url,
    published_at:
      isNonEmptyString(note.published_at) ? note.published_at : `${date}T00:00:00Z`,
    impact_score: normalizeScore(note.impact_score, 7),
    relevance_score: normalizeScore(note.relevance_score, 7),
    trust_score: normalizeScore(note.trust_score, 7),
    review: {
      status: "draft",
      human_review_required: true,
      review_notes:
        note.review?.review_notes ||
        "Generated from manually prepared source notes. Confirm wording, scoring, and risk framing before publish.",
      scoring: normalizeReviewScoring(note.review?.scoring),
    },
  };
}

async function main() {
  const { help, date = formatToday(), force, notes, writeDraft } = parseArgs(process.argv);

  if (help) {
    printUsage();
    return;
  }

  assertValidDate(date);

  const notesPath = notes ? path.resolve(rootDir, notes) : defaultNotesPath;
  const relativeNotesPath = path.relative(rootDir, notesPath) || path.basename(notesPath);
  const publishedPath = path.join(dailyDir, `${date}.json`);
  const draftPath = path.join(dailyDir, `${date}.draft.json`);
  const relativeDraftPath = path.join("data", "daily", `${date}.draft.json`);
  const relativePublishedPath = path.join("data", "daily", `${date}.json`);

  if (!(await fileExists(notesPath))) {
    console.log("Daily brief preparation skipped");
    console.log("==============================");
    console.log(`Missing notes file: ${relativeNotesPath}`);
    console.log("");
    console.log("Create a local notes file with entries like:");
    console.log(`[
  {
    "title": "Example signal",
    "source_name": "Example source",
    "source_url": "https://example.com",
    "short_notes": "Two or three source-aware notes.",
    "category": "AI PM Learning"
  }
]`);
    console.log("");
    console.log("This helper does not fetch or scrape sources on its own.");
    return;
  }

  const raw = await readFile(notesPath, "utf8");
  const notesData = JSON.parse(raw);
  validateNotes(notesData, relativeNotesPath);

  const draft = {
    date,
    articles: notesData.map((note, index) => buildArticle(note, date, index)),
  };

  if (writeDraft) {
    if ((await fileExists(publishedPath)) && !force) {
      throw new Error(
        `${relativePublishedPath} already exists. Use --force only when you intentionally want a fresh draft beside an existing published file.`,
      );
    }

    if ((await fileExists(draftPath)) && !force) {
      throw new Error(`${relativeDraftPath} already exists. Use --force to replace it.`);
    }

    await mkdir(dailyDir, { recursive: true });
    await writeFile(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");

    console.log("Daily draft written");
    console.log("==================");
    console.log(`Notes: ${relativeNotesPath}`);
    console.log(`Draft: ${relativeDraftPath}`);
    console.log("");
    console.log("Next steps:");
    console.log("- Review all placeholder fields.");
    console.log("- Publish only after human review.");
    console.log("- Run npm run validate:daily");
    console.log("- Run npm run validate:data");
    console.log("- Run npm run build");
    return;
  }

  console.log("Daily draft preview");
  console.log("===================");
  console.log(`Notes: ${relativeNotesPath}`);
  if (await fileExists(publishedPath)) {
    console.log(`Published file already exists: ${relativePublishedPath}`);
    console.log("Preview mode kept the published file unchanged.");
  }
  console.log("");
  console.log(JSON.stringify(draft, null, 2));
}

main().catch((error) => {
  console.error("Daily brief preparation failed:");
  console.error(`- ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
