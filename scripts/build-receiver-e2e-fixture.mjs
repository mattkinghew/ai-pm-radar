import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { approveHandoff, createHandoffDraft, markHandoffReviewed, updateHandoff } from "../lib/downstream-handoff.ts";
import { createDeliveryPackage, deliveryPackageStatus, toContentOpsIntakePackage, validateDeliveryPackage } from "../lib/delivery-package.ts";
import { createSourceLibraryEntry } from "../lib/source-library.ts";
import { normaliseSourceInput } from "../lib/source-inbox.ts";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const outputDirectory = join(root, "fixtures/receiver-e2e");
const capturedAt = "2026-10-10T09:00:00.000Z";
const sourceUrl = "https://example.org/radar-receiver-e2e";
const sourceText = "Synthetic pilot: a human reviewer caught two mislabeled items in a ten-item classification exercise. The pilot measured no time, satisfaction, or revenue outcomes.";
const excerpt = "a human reviewer caught two mislabeled items in a ten-item classification exercise";
const evidence = { source: sourceUrl, timestamp: null, text_reference: excerpt };

const record = {
  ...normaliseSourceInput({
    value: sourceText,
    kind: "paste_text",
    sourceUrl,
    title: "Synthetic classification review pilot",
    creator: "Synthetic Research Group",
    capturedAt,
    language: "en",
  }, { now: capturedAt }).record,
  summary: "A synthetic ten-item exercise reports two mislabeled items caught by human review; outcome impact was not measured.",
  key_points: ["Human review caught two mislabeled items in the exercise."],
  key_claims: [{ claim: "Human review caught two mislabeled items in the exercise.", evidence: [evidence] }],
  evidence: [evidence],
  rights_note: "Synthetic fixture; no third-party content.",
  review_status: "reviewed",
  approval_status: "approved",
};
const entry = createSourceLibraryEntry(record, "2026-10-10T09:02:00.000Z");

const reviewedAndApproved = (draft, reviewedAt, approvedAt) => approveHandoff(
  markHandoffReviewed(draft, reviewedAt),
  entry,
  approvedAt,
);

const draftA = createHandoffDraft(entry, "content_candidate", "2026-10-10T09:03:00.000Z");
const handoffA = reviewedAndApproved(updateHandoff(draftA, {
  derived_analysis: {
    ...draftA.derived_analysis,
    target_audience: "Product teams evaluating human review steps.",
    content_angles: ["What the ten-item synthetic exercise can and cannot show"],
    key_source_backed_claims: ["Human review caught two mislabeled items."],
    unknowns_and_risks: ["No time, satisfaction, or revenue outcomes were measured."],
  },
  human_notes: "Synthetic acceptance fixture revision A.",
}, "2026-10-10T09:04:00.000Z"), "2026-10-10T09:05:00.000Z", "2026-10-10T09:06:00.000Z");
const packageA = createDeliveryPackage(entry, handoffA, "2026-10-10T09:07:00.000Z");

const editedHandoff = updateHandoff(handoffA, {
  derived_analysis: {
    ...handoffA.derived_analysis,
    content_angles: ["Why a small exercise is not evidence of business impact"],
  },
  human_notes: "Synthetic acceptance fixture revision B; A remains an immutable older package.",
}, "2026-10-10T09:08:00.000Z");
const handoffB = reviewedAndApproved(editedHandoff, "2026-10-10T09:09:00.000Z", "2026-10-10T09:10:00.000Z");
const packageB = createDeliveryPackage(entry, handoffB, "2026-10-10T09:11:00.000Z");
const currentEntry = { ...entry, downstream_handoffs: [handoffB] };
const packageAState = deliveryPackageStatus({ package: packageA, state: "exported", exported_at: "2026-10-10T09:07:00.000Z", import_confirmed_at: null }, currentEntry);
const packageBState = deliveryPackageStatus({ package: packageB, state: "exported", exported_at: "2026-10-10T09:11:00.000Z", import_confirmed_at: null }, currentEntry);

for (const item of [packageA, packageB]) {
  if (!validateDeliveryPackage(item)) throw new Error(`Generated package failed validation: ${item.package_id}`);
}
if (packageA.package_id === packageB.package_id || packageA.package_fingerprint === packageB.package_fingerprint) {
  throw new Error("A and B must be distinct immutable revisions.");
}
if (packageAState !== "outdated" || packageBState !== "exported") {
  throw new Error(`Unexpected revision states: A=${packageAState}, B=${packageBState}`);
}

await mkdir(outputDirectory, { recursive: true });
const artifacts = {
  "source-record.json": record,
  "handoff-a.json": handoffA,
  "delivery-package-a.json": packageA,
  "content-ops-intake-a.json": toContentOpsIntakePackage(packageA),
  "handoff-b.json": handoffB,
  "delivery-package-b.json": packageB,
  "content-ops-intake-b.json": toContentOpsIntakePackage(packageB),
  "revision-check.json": {
    source_record_id: record.id,
    package_a_id: packageA.package_id,
    package_a_fingerprint: packageA.package_fingerprint,
    package_a_status_after_revision_b: packageAState,
    package_b_id: packageB.package_id,
    package_b_fingerprint: packageB.package_fingerprint,
    package_b_status: packageBState,
    receiver_revision_rule: "Both package identities must remain distinct; receiver stores them as separate source records under the same source_record_id metadata.",
  },
};

for (const [name, value] of Object.entries(artifacts)) {
  await writeFile(join(outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

process.stdout.write(`${JSON.stringify({
  fixture_directory: "fixtures/receiver-e2e",
  source_record_id: record.id,
  handoff_a_id: handoffA.id,
  handoff_b_id: handoffB.id,
  package_a_id: packageA.package_id,
  package_b_id: packageB.package_id,
  package_a_fingerprint: packageA.package_fingerprint,
  package_b_fingerprint: packageB.package_fingerprint,
  package_a_status_after_revision_b: packageAState,
  package_b_status: packageBState,
  artifacts: Object.keys(artifacts),
}, null, 2)}\n`);
