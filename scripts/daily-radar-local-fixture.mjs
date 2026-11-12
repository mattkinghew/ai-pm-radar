import { mkdir, open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { scoreLane } from "../cloud/src/curation.mjs";

export async function writeLocalDailyFixture(date, outputDir = resolve("data/daily")) {
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date || "")
    && !Number.isNaN(parsedDate.getTime())
    && parsedDate.toISOString().slice(0, 10) === date;
  if (!validDate) throw new Error("Date must be a real YYYY-MM-DD calendar date.");

  const target = resolve(outputDir, `${date}.json`);
  const payload = {
    date,
    articles: [{
      question_title: "Fixture check: can a local daily JSON pass the existing validators?",
      short_title: "Local resilience fixture (synthetic)",
      summary: "Synthetic fixture only. It contains no news claim and must not be published as a real Radar update.",
      why_it_matters: "It verifies the local file path and daily JSON schema without depending on Grok Bot or external feeds.",
      business_angle: "No business event is represented; this entry exists only to exercise the file and validation workflow.",
      ai_pm_angle: "Treat local collection and editorial approval as separate steps; this fixture is not source evidence.",
      risk_note: "Synthetic QA data only. Remove it from data/daily before any release or public build.",
      category: "LOCAL_QA_FIXTURE",
      tags: ["synthetic", "local-qa"],
      source_name: "Local fixture (not a publication source)",
      source_url: "https://example.com/local-radar-fixture",
      published_at: `${date}T00:00:00.000Z`,
      impact_score: 1,
      relevance_score: 1,
      trust_score: 1,
      review: {
        status: "draft",
        human_review_required: true,
        review_notes: "Synthetic validator fixture. Not approved for publication.",
      },
      local_fixture: true,
      ...scoreLane({ title: "Local resilience fixture (synthetic)", category: "LOCAL_QA_FIXTURE", published_at: `${date}T00:00:00.000Z` }, { nowMs: parsedDate.getTime() }),
  }],
  };

  await mkdir(outputDir, { recursive: true });
  const file = await open(target, "wx", 0o600);
  try {
    await file.writeFile(`${JSON.stringify(payload, null, 2)}\n`);
  } finally {
    await file.close();
  }
  return target;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const target = await writeLocalDailyFixture(process.argv[2], resolve(process.argv[3] || "data/daily"));
    console.log(`Wrote synthetic local QA fixture: ${target}`);
  } catch (error) {
    console.error(error?.code === "EEXIST" ? `Refusing to overwrite existing file: ${resolve(process.argv[3] || "data/daily", `${process.argv[2]}.json`)}` : `Could not write fixture: ${error.message}`);
    process.exitCode = 1;
  }
}
