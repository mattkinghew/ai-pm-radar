import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { approveHandoff, createHandoffDraft, markHandoffReviewed } from "../lib/downstream-handoff.ts";
import { createDeliveryPackage, toContentOpsIntakePackage } from "../lib/delivery-package.ts";
import { createSourceLibraryEntry } from "../lib/source-library.ts";
import { normaliseSourceInput } from "../lib/source-inbox.ts";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const outputDirectory = join(root, "fixtures/delivery-packages");
const capturedAt = "2026-10-01T00:00:00.000Z";
const approvedAt = "2026-10-01T00:03:00.000Z";
const sourceUrl = "https://example.org/synthetic-delivery-study";
const sourceText = "Synthetic study: human review caught two classification errors in a ten-item test. No time or revenue impact was measured.";

const base = normaliseSourceInput({
  value: sourceText,
  kind: "paste_text",
  sourceUrl,
  title: "Synthetic review workflow study",
  creator: "Synthetic Research Group",
  capturedAt,
  language: "en",
}, { now: capturedAt }).record;
const excerpt = "human review caught two classification errors in a ten-item test";
const evidence = { source: sourceUrl, timestamp: null, text_reference: excerpt };
const sourceRecord = {
  ...base,
  summary: "A synthetic ten-item test reports two errors caught by human review.",
  key_points: ["Human review caught two classification errors in the test."],
  key_claims: [{ claim: "Human review caught two classification errors in the test.", evidence: [evidence] }],
  evidence: [evidence],
  review_status: "reviewed",
  approval_status: "approved",
};
const entry = createSourceLibraryEntry(sourceRecord, approvedAt);

await mkdir(outputDirectory, { recursive: true });
for (const type of ["content_candidate", "learning_pack", "creative_reference", "case_reference"]) {
  const draft = createHandoffDraft(entry, type, "2026-10-01T00:01:00.000Z");
  const reviewed = markHandoffReviewed(draft, "2026-10-01T00:02:00.000Z");
  const approved = approveHandoff(reviewed, entry, approvedAt);
  const item = createDeliveryPackage(entry, approved, "2026-10-01T00:04:00.000Z");
  await writeFile(join(outputDirectory, `${type}.json`), `${JSON.stringify(item, null, 2)}\n`, "utf8");
  if (type === "content_candidate") {
    await writeFile(join(root, "fixtures/content_ops_compatibility_fixture.json"), `${JSON.stringify(toContentOpsIntakePackage(item), null, 2)}\n`, "utf8");
  }
}
