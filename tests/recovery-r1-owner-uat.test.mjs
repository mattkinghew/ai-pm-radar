import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getReusableSourceBlockers } from "../lib/source-library.ts";
import { buildDailyCandidate } from "../lib/daily-candidate.ts";
import { validateSourceRecord } from "../lib/source-inbox.ts";
import { parseSourceLibraryBackup } from "../lib/source-library-backup.ts";

const fixtureUrl = new URL("../docs/qa/recovery-r1-owner-uat/aihelp-source-record-needs-review.json", import.meta.url);
const draftUrl = new URL("../docs/qa/recovery-r1-owner-uat/content-candidate-draft-backup.json", import.meta.url);
const record = JSON.parse(await readFile(fixtureUrl, "utf8"));

test("Owner UAT public-source fixture is valid and preserves exact excerpt provenance", () => {
  assert.deepEqual(validateSourceRecord(record), []);
  assert.equal(record.source_url, "https://cloud.google.com/customers/aihelp");
  assert.equal(record.published_at, null);
  assert.equal(record.evidence.length, 3);
  for (const evidence of record.evidence) {
    assert.equal(evidence.source, record.source_url);
    assert.ok(record.raw_text.includes(evidence.text_reference));
  }
});

test("Owner-reviewed UAT source is approved for scoped reuse without claiming AI analysis", () => {
  assert.equal(record.analysis.status, "not_requested");
  assert.equal(record.review_status, "reviewed");
  assert.equal(record.approval_status, "approved");
  assert.equal(record.evidence_grade, "B");
  assert.deepEqual(getReusableSourceBlockers(record), []);
});

test("Content Ops candidate draft preserves source evidence and remains unreviewed and undispatchable", async () => {
  const backup = parseSourceLibraryBackup(await readFile(draftUrl, "utf8"));
  assert.equal(backup.entries.length, 1);
  const entry = backup.entries[0];
  assert.ok(entry);
  assert.equal(entry.source_record.id, record.id);
  assert.equal(entry.source_record.approval_status, "approved");
  assert.equal(entry.source_record.analysis.status, "not_requested");
  assert.equal(entry.downstream_handoffs.length, 1);

  const handoff = entry.downstream_handoffs[0];
  assert.ok(handoff);
  assert.equal(handoff.type, "content_candidate");
  assert.equal(handoff.target_product, "content_ops");
  assert.equal(handoff.status, "draft");
  assert.equal(handoff.reviewed_at, null);
  assert.equal(handoff.approved_at, null);
  assert.equal(entry.delivery_packages.length, 0);
  assert.equal(handoff.source_facts.length, 3);
  for (const fact of handoff.source_facts) {
    assert.ok(fact.evidence_reference_ids.length > 0);
    for (const id of fact.evidence_reference_ids) {
      assert.ok(handoff.evidence_references.some((reference) => reference.id === id));
    }
  }
  assert.ok(handoff.evidence_references.every((reference) => record.raw_text.includes(reference.text_reference)));

  const daily = buildDailyCandidate([{ record: entry.source_record }], "2026-10-30");
  assert.equal(daily.candidate.articles.length, 0);
  assert.ok(daily.blocked[0]?.reasons.includes("Daily candidate metadata is missing."));
});
