import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chunkBookChapter, chunkTranscript } from "../lib/universal-ingestor.ts";
import { createOmniResourceBundle } from "../lib/omni-resource-bundle.ts";
import { assertApprovalIntegrity } from "../lib/approval-integrity.ts";

test("transcript chunks preserve timestamp locators", () => {
  const chunks = chunkTranscript("WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nFirst point\n\n00:00:10.000 --> 00:00:20.000\nSecond point");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].locator, "YouTube 00:00-00:20");
  assert.match(chunks[0].exactQuote, /First point.*Second point/);
});

test("book chapter chunks retain heading and page locator", () => {
  const chunks = chunkBookChapter("# Chapter 3\nFirst paragraph.\n\n[page: 42]\n## 3.1 Evidence\nA sourced claim.", "sample.md");
  assert.deepEqual(chunks.map((chunk) => chunk.locator), ["Chapter 3", "3.1 Evidence, p.42"]);
});

test("Omni bundle export requires approval and includes source digest plus both consumer payloads", async () => {
  const input = {
    sourceCategory: "BOOK_CHAPTER_EXTRACT" as const, sourceUrlOrFileName: "sample.md", sourcePayload: "source bytes",
    approved: true, dailyDigestCard: { headline: "Evidence", threeBulletTakeaways: ["a", "b", "c"] as [string, string, string], actionUrgency: "DEEP_STUDY" as const },
    evidenceChunks: [{ chunkId: "book-1", exactQuote: "A quote", locator: "Chapter 3, p.42" }],
    contentOpsPayload: { targetBusinessLine: "PERSONAL_AI_BRAND" as const, coreHookAngle: "Hook", platformAngles: { linkedinConsultingPost: "LinkedIn", threadsIgViralCarousel: "Threads" }, suggestedVisualEvidenceDesc: "Source excerpt" },
    cyberKumaPayload: { domainTag: "AI_ARCHITECTURE", tacticalEncounters: [] }, createdAtIso: "2026-10-15T00:00:00.000Z",
  };
  const bundle = await createOmniResourceBundle(input);
  assert.match(bundle.canonicalSha256, /^[a-f0-9]{64}$/);
  assert.equal(bundle.humanApproved, true);
  assert.ok(bundle.contentOpsPayload && bundle.cyberKumaPayload);
  await assert.rejects(createOmniResourceBundle({ ...input, approved: false }), /Human approval/);
});

test("real-source Omni sample digest matches the captured input; sample remains unapproved", async () => {
  const sample = JSON.parse(await readFile(resolve("fixtures/OmniResourceBundle.openai-gpt6-intelligent-ui.json"), "utf8"));
  await assertApprovalIntegrity(sample.sourcePayloadDigestInput, sample.canonicalSha256);
  assert.equal(sample.humanApproved, false);
  assert.equal(sample.reviewStatus, "needs_review");
});
