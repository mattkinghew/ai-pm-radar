import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  applyManualEnrichment,
  applyManualReview,
  buildDailyCandidate,
  getReviewGateState,
  getDailyCandidateBlockers,
} from "../lib/daily-candidate.ts";
import { normaliseSourceInput } from "../lib/source-inbox.ts";
import type { ManualEnrichment, ManualReviewDecision, DailyCandidateMetadata } from "../lib/daily-candidate.ts";
import type { SourceInput } from "../lib/source-inbox.ts";

const __filename = fileURLToPath(import.meta.url);
const fixtureDir = path.join(path.dirname(__filename), "..", "fixtures", "source-inbox");
const capturedAt = "2026-09-19T00:00:00.000Z";

type Fixture = {
  name: string;
  input: SourceInput;
  manual_enrichment?: ManualEnrichment;
  review?: ManualReviewDecision;
  daily?: DailyCandidateMetadata;
  recovery_expected?: string[];
};

async function readFixture(name: string): Promise<Fixture> {
  const raw = await readFile(path.join(fixtureDir, name), "utf8");
  return JSON.parse(raw) as Fixture;
}

function prepare(fixture: Fixture) {
  let record = normaliseSourceInput(fixture.input, { now: capturedAt }).record;
  if (fixture.manual_enrichment) {
    record = applyManualEnrichment(record, fixture.manual_enrichment);
  }
  if (fixture.review) {
    record = applyManualReview(record, fixture.review);
  }
  return { record, daily: fixture.daily };
}

test("processes all three fixtures and excludes URL-only input from candidate output", async () => {
  const fixtures = await Promise.all([
    readFixture("paste-text.json"),
    readFixture("srt.json"),
    readFixture("url-only.json"),
  ]);
  const result = buildDailyCandidate(fixtures.map(prepare), "2026-09-19");

  assert.equal(result.included.length, 2);
  assert.equal(result.candidate.articles.length, 2);
  assert.equal(result.blocked.length, 1);
  assert.ok(result.blocked[0]?.reasons.some((reason) => reason.includes("source body")));
  assert.ok(result.blocked[0]?.reasons.some((reason) => reason.includes("evidence")));
});

test("keeps URL-only recovery options available instead of dropping the source", async () => {
  const fixture = await readFixture("url-only.json");
  const result = normaliseSourceInput(fixture.input, { now: capturedAt });

  assert.equal(result.record.raw_text, "");
  assert.deepEqual(result.fallback_options, fixture.recovery_expected);
  assert.equal(result.record.review_status, "needs_review");
  assert.equal(result.record.approval_status, "not_approved");
});

test("blocks a complete-looking record until it is explicitly approved", async () => {
  const fixture = await readFixture("paste-text.json");
  const prepared = prepare({ ...fixture, review: undefined });
  const blockers = getDailyCandidateBlockers(prepared.record, prepared.daily);

  assert.ok(blockers.some((reason) => reason.includes("not human reviewed")));
  assert.ok(blockers.some((reason) => reason.includes("not explicitly approved")));

  const rejected = prepare({
    ...fixture,
    review: { review_status: "rejected", approval_status: "approved" },
  });
  assert.ok(
    getDailyCandidateBlockers(rejected.record, rejected.daily).some((reason) =>
      reason.includes("was rejected"),
    ),
  );
});

test("blocks approved records when provenance evidence is missing", async () => {
  const fixture = await readFixture("paste-text.json");
  const prepared = prepare(fixture);
  const recordWithoutEvidence = { ...prepared.record, evidence: [] };
  const result = buildDailyCandidate(
    [{ record: recordWithoutEvidence, daily: prepared.daily }],
    "2026-09-19",
  );

  assert.equal(result.included.length, 0);
  assert.ok(result.blocked[0]?.reasons.some((reason) => reason.includes("no evidence items")));
});

test("blocks incomplete evidence references even when a record is approved", async () => {
  const fixture = await readFixture("paste-text.json");
  const prepared = prepare(fixture);
  const incompleteEvidence = {
    ...prepared.record,
    evidence: [{ source: "", timestamp: null, text_reference: "" }],
  };
  const result = buildDailyCandidate(
    [{ record: incompleteEvidence, daily: prepared.daily }],
    "2026-09-19",
  );

  assert.equal(result.included.length, 0);
  assert.ok(result.blocked[0]?.reasons.some((reason) => reason.includes("SourceRecord invalid")));
});

test("invalidates an old approval fingerprint after content changes", () => {
  const approved = getReviewGateState("v1", "v1", "v1", null);
  const edited = getReviewGateState("v2", "v1", "v1", null);

  assert.deepEqual(approved, {
    review_status: "reviewed",
    approval_status: "approved",
  });
  assert.deepEqual(edited, {
    review_status: "needs_review",
    approval_status: "not_approved",
  });
});

test("converts an approved complete record without adding fields to the daily schema", async () => {
  const fixture = await readFixture("srt.json");
  const prepared = prepare(fixture);
  const result = buildDailyCandidate([prepared], "2026-09-19");
  const article = result.candidate.articles[0];

  assert.equal(result.blocked.length, 0);
  assert.equal(article?.source_url, "https://example.com/video/source-aware-review");
  assert.equal(article?.source_name, "Example Video Lab");
  assert.equal(article?.published_at, "2026-09-17T14:30:00.000Z");
  assert.equal(article?.review.status, "reviewed");
  assert.equal(article?.review.human_review_required, false);
  assert.ok(article?.review.review_notes.includes("不代表來源事實"));
  assert.deepEqual(Object.keys(article ?? {}).sort(), [
    "ai_pm_angle",
    "business_angle",
    "category",
    "impact_score",
    "published_at",
    "question_title",
    "relevance_score",
    "review",
    "risk_note",
    "short_title",
    "source_name",
    "source_url",
    "summary",
    "tags",
    "trust_score",
    "why_it_matters",
  ]);
});
