import assert from "node:assert/strict";
import test from "node:test";

import { normaliseSourceInput } from "../lib/source-inbox.ts";
import { getReusableSourceBlockers } from "../lib/source-library.ts";
import {
  MAX_INTAKE_TEXT_BYTES,
  MAX_VISIBLE_EVIDENCE_CHUNKS,
  importedEvidenceCandidates,
  validateUploadedTextMaterial,
} from "../lib/intake-evidence-preview.ts";

const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
一段逐字引用

00:00:05.000 --> 00:00:07.000
<font color="red">A source-backed point</font>
`;
const srt = `1
00:00:01,000 --> 00:00:04,000
A timestamped evidence quote.

2
00:00:05,000 --> 00:00:07,000
Second exact claim.
`;

test("uploaded subtitle: exact transcript evidence and neutral time locators, manual review gate unchanged", () => {
  const file = validateUploadedTextMaterial(vtt, "lesson.vtt");
  assert.equal(file.kind, "vtt");
  const chunks = importedEvidenceCandidates(file.body, file.kind, file.fileName);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.locator, "Subtitle 00:01-00:07");
  const record = normaliseSourceInput({ value: file.body, kind: file.kind, title: file.title }, { now: "2026-10-15T00:00:00Z" }).record;
  assert.equal(record.approval_status, "not_approved");
  assert.equal(record.review_status, "needs_review");
  assert.equal(record.transcript_origin, "uploaded_subtitle");
  assert.ok(record.transcript?.includes(chunks[0]!.exactQuote));
  assert.equal(chunks[0]?.evidenceSource, "lesson.vtt");
  assert.equal(chunks[0]?.evidenceTimestamp, "Subtitle 00:01-00:07");
  const reviewed = {
    ...record,
    evidence: [{ source: file.fileName, timestamp: chunks[0]!.evidenceTimestamp, text_reference: chunks[0]!.exactQuote }],
    key_claims: [{
      claim: "One sample claim requiring actual reviewer verification.",
      evidence: [{ source: file.fileName, timestamp: chunks[0]!.evidenceTimestamp, text_reference: chunks[0]!.exactQuote }],
    }],
    review_status: "reviewed" as const, approval_status: "approved" as const,
  };
  assert.deepEqual(getReusableSourceBlockers(reviewed), []);
});

test("SRT and Markdown import retain locators and source bytes; TXT has manual paragraph fallback", () => {
  const subtitle = validateUploadedTextMaterial(srt, "clip.srt");
  assert.equal(subtitle.body, srt);
  assert.equal(importedEvidenceCandidates(subtitle.body, subtitle.kind, subtitle.fileName)[0]?.locator, "Subtitle 00:01-00:07");
  const markdown = validateUploadedTextMaterial("# Chapter\nAn exact sentence.\n\n[page: 9]\n## Evidence\nAnother finding.", "ch1.md");
  assert.equal(markdown.kind, "markdown");
  assert.equal(markdown.title, "Chapter");
  const chunks = importedEvidenceCandidates(markdown.body, markdown.kind, markdown.fileName);
  assert.deepEqual(chunks.map((item) => item.locator), ["Chapter", "Evidence, p.9"]);
  assert.ok(chunks.every((item) => markdown.body.includes(item.exactQuote)));
  assert.equal(chunks[1]?.evidenceSource, "ch1.md · Evidence, p.9");
  const plain = validateUploadedTextMaterial("Some plain UTF-8 notes.\nWith evidence.", "notes.txt");
  assert.equal(plain.kind, "txt");
  assert.deepEqual(importedEvidenceCandidates(plain.body, plain.kind, plain.fileName), []);
});

test("invalid, oversized, malformed or binary text files fail closed without an approval path", () => {
  assert.throws(() => validateUploadedTextMaterial("", "empty.md"), /empty/i);
  assert.throws(() => validateUploadedTextMaterial("hello", "danger.pdf"), /upload/i);
  assert.throws(() => validateUploadedTextMaterial("bad\u0000binary", "bad.txt"), /binary/i);
  assert.throws(() => validateUploadedTextMaterial("bad\uFFFDtext", "bad.txt"), /invalid UTF-8/i);
  assert.throws(() => validateUploadedTextMaterial("a".repeat(MAX_INTAKE_TEXT_BYTES + 1), "large.txt"), /1 MiB/i);
  assert.throws(() => validateUploadedTextMaterial("WEBVTT\nNo cues", "bad.vtt"), /valid subtitle cues/i);
  assert.throws(() => validateUploadedTextMaterial("1\n00:99:01,000 --> 00:99:02,000\nbad", "bad.srt"), /timestamps/i);
  assert.deepEqual(importedEvidenceCandidates("", "vtt", "invalid.vtt"), []);
});

test("long chapter or many cues cannot flood the evidence picker; existing input remains reviewable", () => {
  const long = "# Long\n" + "repeat ".repeat(4_000);
  const preview = importedEvidenceCandidates(long, "markdown", "sample.md");
  assert.ok(preview.length <= MAX_VISIBLE_EVIDENCE_CHUNKS);
});
