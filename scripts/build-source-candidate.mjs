import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyManualEnrichment,
  applyManualReview,
  buildDailyCandidate,
} from "../lib/daily-candidate.ts";
import { normaliseSourceInput } from "../lib/source-inbox.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoDir = path.join(__dirname, "..");
const fixtureDir = path.join(repoDir, "fixtures", "source-inbox");
const defaultOutput = path.join(repoDir, "fixtures", "candidates", "2026-09-19.json");
const defaultRecordsOutput = path.join(repoDir, "fixtures", "source-records", "2026-09-19.json");
const fixedCapturedAt = "2026-09-19T00:00:00.000Z";

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? path.resolve(process.cwd(), process.argv[index + 1]) : fallback;
}

async function loadFixtures() {
  const entries = (await readdir(fixtureDir)).filter((entry) => entry.endsWith(".json")).sort();
  return Promise.all(
    entries.map(async (entry) => JSON.parse(await readFile(path.join(fixtureDir, entry), "utf8"))),
  );
}

const fixtures = await loadFixtures();
const sources = fixtures.map((fixture) => {
  const normalised = normaliseSourceInput(fixture.input, { now: fixedCapturedAt });
  let record = normalised.record;

  if (fixture.manual_enrichment) {
    record = applyManualEnrichment(record, fixture.manual_enrichment);
  }

  if (fixture.review) {
    record = applyManualReview(record, fixture.review);
  }

  return { record, daily: fixture.daily };
});

const result = buildDailyCandidate(sources, "2026-09-19");
const outputPath = argumentValue("--out", defaultOutput);
const recordsOutputPath = argumentValue("--records-out", defaultRecordsOutput);

await mkdir(path.dirname(outputPath), { recursive: true });
await mkdir(path.dirname(recordsOutputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result.candidate, null, 2)}\n`, "utf8");
await writeFile(recordsOutputPath, `${JSON.stringify(sources.map(({ record }) => record), null, 2)}\n`, "utf8");

console.log(`Candidate written: ${path.relative(process.cwd(), outputPath)}`);
console.log(`SourceRecords written: ${path.relative(process.cwd(), recordsOutputPath)}`);
console.log(`Included: ${result.included.length}`);
console.log(`Blocked: ${result.blocked.length}`);

for (const blocked of result.blocked) {
  console.log(`- ${blocked.source_record_id}: ${blocked.reasons.join(" | ")}`);
}
