import assert from "node:assert/strict";
import test from "node:test";

import {
  MANUAL_FALLBACK_OPTIONS,
  bilibiliAdapter,
  detectInputKind,
  detectSourceEntryMode,
  detectPlatformFromUrl,
  getAdapterForInput,
  mergeEditableKeyClaims,
  normaliseSourceInput,
  parseSubtitle,
  validateSourceInput,
  validateSourceRecord,
  xAdapter,
} from "../lib/source-inbox.ts";
import {
  applyAIAnalysisDraft,
  canonicaliseAIAnalysisEvidence,
  createAnalysisSourceSnapshot,
  isAnalysisSourceSnapshotCurrent,
  summariseAnalysisEvidenceIssueLocations,
  validateAIAnalysisDraft,
} from "../lib/ai-analysis.ts";
import { parseSourceDrafts, serializeSourceDrafts } from "../lib/source-draft-storage.ts";
import { decideResearchImport, researchFormFingerprint } from "../lib/research-handoff.ts";

const capturedAt = "2026-09-19T00:00:00.000Z";

test("reports exact evidence failures without exposing model text or arbitrary paths", () => {
  assert.deepEqual(summariseAnalysisEvidenceIssueLocations([
    { path: "$.key_claims[1].evidence[0].text_reference", actual: "private model excerpt" },
    { path: "$.method_or_teaching_points[2]", actual: "private model excerpt" },
    { path: "untrusted <script>alert(1)</script>" },
  ]), [
    { kind: "claim", index: 2, evidenceIndex: 1 },
    { kind: "method", index: 3 },
  ]);
  assert.deepEqual(summariseAnalysisEvidenceIssueLocations(null), []);
});

test("detects supported URL platforms and file input kinds", () => {
  assert.equal(detectPlatformFromUrl("https://x.com/example/status/1"), "x");
  assert.equal(detectPlatformFromUrl("https://youtu.be/example"), "youtube");
  assert.equal(detectPlatformFromUrl("https://www.bilibili.com/video/BV1"), "bilibili");
  assert.equal(detectPlatformFromUrl("https://t.me/example"), "telegram");
  assert.equal(detectInputKind("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello"), "vtt");
  assert.equal(detectInputKind("1\n00:00:00,000 --> 00:00:01,000\nHello", "clip.srt"), "srt");
  assert.equal(detectInputKind("# Notes\nSome text", "notes.md"), "markdown");
});

test("detects URL entry without discarding mixed text input", () => {
  assert.equal(detectSourceEntryMode("https://example.com/article"), "url");
  assert.equal(detectSourceEntryMode("https://example.com/a\nhttps://example.com/b"), "url");
  assert.equal(detectSourceEntryMode("https://example.com/article\nA note to review"), "text");
  assert.equal(detectSourceEntryMode("A pasted source note."), "text");
});

test("normalises manual URL and pasted text into the same SourceRecord contract", () => {
  const urlResult = normaliseSourceInput(
    {
      value: "https://example.com/research",
      kind: "manual_url",
      title: "Research source",
      creator: "Example Research",
    },
    { now: capturedAt },
  );
  const textResult = normaliseSourceInput(
    { value: "A pasted source note.", kind: "paste_text" },
    { now: capturedAt },
  );

  assert.equal(urlResult.record.source_url, "https://example.com/research");
  assert.equal(urlResult.record.source_url_original, "https://example.com/research");
  assert.equal(urlResult.record.source_url_final, "https://example.com/research");
  assert.equal(urlResult.record.source_type, "url");
  assert.equal(textResult.record.raw_text, "A pasted source note.");
  assert.equal(textResult.record.source_type, "text");
  assert.equal(urlResult.record.review_status, "needs_review");
  assert.deepEqual(validateSourceRecord(urlResult.record), []);
  assert.deepEqual(validateSourceRecord(textResult.record), []);
});

test("preserves per-claim provenance until the editable claim or shared evidence changes", () => {
  const preserved = [
    { claim: "Claim one", evidence: [{ source: "https://example.com/a", timestamp: null, text_reference: "Evidence one." }] },
    { claim: "Claim two", evidence: [{ source: "https://example.com/a", timestamp: "00:02", text_reference: "Evidence two." }] },
    { claim: "Claim three", evidence: [{ source: "https://example.com/a", timestamp: null, text_reference: "Evidence three." }] },
  ];
  const shared = [preserved[0].evidence[0]];
  assert.deepEqual(mergeEditableKeyClaims(preserved.map((item) => item.claim), preserved, shared), preserved);

  const edited = mergeEditableKeyClaims(["Claim one", "Edited claim", "Claim three"], preserved, shared);
  assert.deepEqual(edited[0].evidence, preserved[0].evidence);
  assert.deepEqual(edited[1].evidence, shared);
  assert.deepEqual(edited[2].evidence, preserved[2].evidence);

  const changedShared = [{ source: "https://example.com/a", timestamp: null, text_reference: "New shared evidence." }];
  assert.ok(mergeEditableKeyClaims(preserved.map((item) => item.claim), preserved, changedShared).every((item) => item.evidence[0].text_reference === "New shared evidence."));
});

test("keeps feed discovery provenance on the existing SourceRecord contract", () => {
  const result = normaliseSourceInput({
    value: "",
    kind: "manual_url",
    sourceUrl: "https://example.com/article",
    title: "Feed item",
    collection: {
      version: 1,
      feed_url: "https://example.com/feed.xml",
      source_id: "feed_source_1",
      item_id: "entry-1",
      content_kind: "summary",
      discovered_at: "2026-09-19T00:00:00.000Z",
      feed_updated_at: null,
    },
  });
  assert.equal(result.record.collection?.item_id, "entry-1");
  assert.equal(validateSourceRecord(result.record).some((issue) => issue.includes("collection")), false);
});

test("keeps original and final public URLs separate after a safe fetch", () => {
  const result = normaliseSourceInput({
    value: "Fetched article body.",
    kind: "paste_text",
    sourceUrl: "https://example.com/final",
    originalSourceUrl: "https://example.com/redirect",
    finalSourceUrl: "https://example.com/final",
  }, { now: capturedAt });

  assert.equal(result.record.source_url, "https://example.com/final");
  assert.equal(result.record.source_url_original, "https://example.com/redirect");
  assert.equal(result.record.source_url_final, "https://example.com/final");
});

test("preserves pasted transcripts and parses SRT/VTT cues with evidence timestamps", () => {
  const srt = "1\n00:00:01,000 --> 00:00:03,000\nFirst point.\n\n2\n00:00:04,000 --> 00:00:05,500\nSecond point.";
  const vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:01.250\nHello <b>world</b>.";
  const parsedSrt = parseSubtitle(srt, "srt");
  const parsedVtt = parseSubtitle(vtt, "vtt");
  const result = normaliseSourceInput({ value: srt, kind: "srt" }, { now: capturedAt });

  assert.equal(parsedSrt.cues.length, 2);
  assert.equal(parsedVtt.text, "Hello world.");
  assert.equal(result.record.transcript, "First point. Second point.");
  assert.equal(result.record.transcript_origin, "uploaded_subtitle");
  assert.equal(result.record.timestamps[0]?.start_seconds, 1);
  assert.equal(result.record.timestamps[1]?.end_seconds, 5.5);
});

test("uses manual fallback when X credentials are unavailable and exposes recovery UX", () => {
  const result = normaliseSourceInput(
    {
      value: "https://x.com/example/status/1",
      kind: "manual_url",
    },
    { now: capturedAt, env: {} },
  );

  assert.equal(xAdapter.availability({ env: {} }).status, "disabled");
  assert.equal(result.record.platform, "x");
  assert.equal(result.record.access_method, "manual_fallback");
  assert.equal(result.fallback_used, true);
  assert.deepEqual(result.fallback_options, [...MANUAL_FALLBACK_OPTIONS]);
  assert.match(result.warnings.join(" "), /manual fallback/i);
});

test("marks Bilibili as experimental without requiring cookies or private sessions", () => {
  const adapter = getAdapterForInput({ value: "https://www.bilibili.com/video/BV1" });
  const result = normaliseSourceInput(
    {
      value: "https://www.bilibili.com/video/BV1",
      title: "Uploaded subtitle source",
    },
    { now: capturedAt },
  );

  assert.equal(adapter, bilibiliAdapter);
  assert.equal(bilibiliAdapter.stability, "experimental");
  assert.equal(bilibiliAdapter.capabilities.auth_required, false);
  assert.equal(result.record.platform, "bilibili");
});

test("invalid sources remain recoverable but are reported before normalisation", () => {
  const input = { value: "ftp://example.com/file", kind: "manual_url" as const };
  const result = normaliseSourceInput(input, { now: capturedAt });

  assert.deepEqual(validateSourceInput(input), ["Source URL must be a valid http or https URL."]);
  assert.equal(result.record.source_url, null);
  assert.equal(result.record.review_status, "needs_review");
  assert.ok(result.fallback_options.includes("Add notes"));
});

test("AI enrichment fields start empty and cannot be marked verified by the validator", () => {
  const result = normaliseSourceInput({ value: "A source note", kind: "paste_text" }, { now: capturedAt });

  assert.equal(result.record.summary, null);
  assert.deepEqual(result.record.key_claims, []);
  assert.equal(result.record.evidence_grade, "ungraded");
  assert.equal(result.record.review_status, "needs_review");
  const invalid = { ...result.record, review_status: "verified" as never };
  assert.ok(validateSourceRecord(invalid).some((issue) => issue.includes("cannot be verified")));
});

test("validates AI evidence against the actual source text before applying a draft", () => {
  const record = normaliseSourceInput({
    value: "The rollout reduced review time from five days to two days.",
    kind: "paste_text",
    sourceUrl: "https://example.com/rollout",
  }, { now: capturedAt }).record;
  const draft = {
    summary: "A rollout reduced review time.",
    why_it_matters: "Cycle time is a directly measurable operating outcome.",
    source_facts: ["Review time changed."],
    key_points: ["The rollout reduced review time."],
    method_or_teaching_points: [],
    key_claims: [{ claim: "Review time fell from five days to two days.", evidence: [{ source: record.source_url!, timestamp: "", text_reference: "The rollout reduced review time from five days to two days." }] }],
    business_implication: "Shorter review cycles may improve throughput.",
    ai_pm_implication: "The PM should define a measurable rollout outcome.",
    use_cases: ["Workflow review operations"],
    content_ideas: ["How to measure rollout impact"],
    uncertainties: ["The source does not explain the sample size."],
    suggested_title: "A faster review rollout",
    question_title: "Can review automation shorten cycle time?",
    short_title: "Faster review rollout",
    category: "AI operations",
    daily_tags: ["AI PM"],
    tags: ["workflow"],
    confidence: 0.8,
    impact_score: { value: 7, rationale: "The stated cycle-time change is material." },
    relevance_score: { value: 8, rationale: "This maps to AI PM delivery measurement." },
    trust_score: { value: 6, rationale: "The source gives a claim but no methodology." },
  };
  assert.deepEqual(validateAIAnalysisDraft(draft, record.raw_text), { valid: true });
  const analyzed = applyAIAnalysisDraft(record, draft, {
    provider: "openai_responses",
    model: "gpt-4.1-mini",
    analyzedAt: capturedAt,
    usage: { input_tokens: 100, output_tokens: 80, total_tokens: 180 },
  });
  assert.equal(analyzed.analysis.status, "draft");
  assert.equal(analyzed.review_status, "needs_review");
  assert.equal(analyzed.approval_status, "not_approved");
  assert.deepEqual(validateAIAnalysisDraft({ ...draft, key_claims: [{ ...draft.key_claims[0], evidence: [{ ...draft.key_claims[0].evidence[0], text_reference: "Not in source" }] }] }, record.raw_text).valid, false);
  assert.equal(validateAIAnalysisDraft({ summary: "malformed model output" }, record.raw_text).valid, false);
  assert.equal(validateAIAnalysisDraft({ ...draft, unexpected: true }, record.raw_text).valid, false);
  assert.equal(validateAIAnalysisDraft({ ...draft, key_claims: [{ ...draft.key_claims[0], evidence: [{ ...draft.key_claims[0].evidence[0], timestamp: null }] }] }, record.raw_text).valid, false);
});

test("keeps English evidence verbatim when the analysis language is Chinese", () => {
  const sourceText = "The pilot reduced review time from five days to two days.";
  const record = normaliseSourceInput({ value: sourceText, kind: "paste_text" }, { now: capturedAt }).record;
  const draft = {
    summary: "試點縮短了審核時間。",
    why_it_matters: "這是可量度的工作流程結果。",
    source_facts: ["The pilot reduced review time."],
    key_points: ["審核時間由五天減至兩天。"],
    method_or_teaching_points: [],
    key_claims: [{ claim: "試點縮短了審核時間。", evidence: [{ source: "synthetic", timestamp: "", text_reference: sourceText }] }],
    business_implication: "團隊可能減少人工審核時間。",
    ai_pm_implication: "AI PM 應先定義可量度的流程指標。",
    use_cases: ["審核流程實驗"],
    content_ideas: ["如何量度流程改善"],
    uncertainties: ["來源沒有說明樣本量。"],
    suggested_title: "審核流程試點",
    question_title: "試點如何改變審核時間？",
    short_title: "審核時間試點",
    category: "AI PM",
    daily_tags: ["workflow"],
    tags: ["evaluation"],
    confidence: 0.7,
    impact_score: { value: 5, rationale: "只有合成試點結果。" },
    relevance_score: { value: 6, rationale: "與流程量度有關。" },
    trust_score: { value: 4, rationale: "需要人工核對來源。" },
  };

  assert.equal(validateAIAnalysisDraft(draft, sourceText).valid, true);
  const canonical = canonicaliseAIAnalysisEvidence(draft, sourceText);
  assert.equal(canonical.key_claims[0].evidence[0].text_reference, sourceText);
  const analysed = applyAIAnalysisDraft(record, canonical, {
    provider: "gemini",
    model: "gemini-test",
    analyzedAt: capturedAt,
    usage: null,
  });
  assert.equal(analysed.key_claims[0].evidence[0].text_reference, sourceText);
  assert.equal(analysed.review_status, "needs_review");
  assert.equal(analysed.approval_status, "not_approved");
});

test("accepts only whitespace differences and stores the original source span", () => {
  const sourceText = "The pilot reduced review time\nfrom five days to two days.";
  const record = normaliseSourceInput({ value: sourceText, kind: "paste_text" }, { now: capturedAt }).record;
  const draft = {
    summary: "A pilot reduced review time.",
    why_it_matters: "The result is measurable.",
    source_facts: ["The pilot reduced review time."],
    key_points: ["Review time decreased."],
    method_or_teaching_points: [],
    key_claims: [{ claim: "Review time decreased.", evidence: [{ source: "synthetic", timestamp: "00:01", text_reference: "The pilot reduced review time from five days to two days." }] }],
    business_implication: "Review throughput may improve.",
    ai_pm_implication: "Define the workflow outcome before scaling.",
    use_cases: ["Review operations"],
    content_ideas: ["Measuring workflow outcomes"],
    uncertainties: ["The source does not report satisfaction."],
    suggested_title: "Review pilot",
    question_title: "What changed?",
    short_title: "Review pilot",
    category: "AI PM",
    daily_tags: ["workflow"],
    tags: ["evaluation"],
    confidence: 0.6,
    impact_score: { value: 5, rationale: "Limited synthetic evidence." },
    relevance_score: { value: 6, rationale: "Relevant to workflow measurement." },
    trust_score: { value: 4, rationale: "Needs human review." },
  };
  assert.equal(validateAIAnalysisDraft(draft, sourceText).valid, true);
  const canonical = canonicaliseAIAnalysisEvidence(draft, sourceText);
  assert.equal(canonical.key_claims[0].evidence[0].text_reference, sourceText);
  const analysed = applyAIAnalysisDraft(record, canonical, {
    provider: "gemini",
    model: "gemini-test",
    analyzedAt: capturedAt,
    usage: null,
  });
  assert.equal(analysed.key_claims[0].evidence[0].timestamp, "00:01");

  const translated = { ...draft, key_claims: [{ ...draft.key_claims[0], evidence: [{ ...draft.key_claims[0].evidence[0], text_reference: "試點把審核時間由五天減至兩天。" }] }] };
  assert.equal(validateAIAnalysisDraft(translated, sourceText).valid, false);
  const caseChanged = { ...draft, key_claims: [{ ...draft.key_claims[0], evidence: [{ ...draft.key_claims[0].evidence[0], text_reference: "the pilot reduced review time from five days to two days." }] }] };
  assert.equal(validateAIAnalysisDraft(caseChanged, sourceText).valid, false);
  assert.equal(validateAIAnalysisDraft({ ...draft, method_or_teaching_points: ["Paraphrased method not present."] }, sourceText).valid, false);
});

test("does not apply an analysis response to a changed source snapshot", () => {
  const original = normaliseSourceInput({ value: "Original source sentence.", kind: "paste_text" }, { now: capturedAt }).record;
  const changed = normaliseSourceInput({ value: "Changed source sentence.", kind: "paste_text" }, { now: capturedAt }).record;
  const snapshot = createAnalysisSourceSnapshot(original);
  assert.equal(isAnalysisSourceSnapshotCurrent(original, snapshot), true);
  assert.equal(isAnalysisSourceSnapshotCurrent(changed, snapshot), false);
});

test("accepts only the current local draft backup version", () => {
  const backup = serializeSourceDrafts([{ id: "source-1", body: "synthetic" }], capturedAt);
  assert.deepEqual(parseSourceDrafts<{ id: string; body: string }>(backup).items, [{ id: "source-1", body: "synthetic" }]);
  assert.throws(() => parseSourceDrafts('{"version":99,"saved_at":"2026-09-19T00:00:00.000Z","items":[]}'), /Unsupported draft backup version/);
});

test("merges background research only when the imported draft was not edited", () => {
  const imported = { title: "Imported", body: "Version one" };
  const updated = { title: "Imported", body: "Version two" };
  const metadata = {
    source_version: "source-v1",
    result_version: 1,
    imported_fingerprint: researchFormFingerprint(imported),
  };
  assert.equal(decideResearchImport({
    hasExisting: false, metadata: null, currentFingerprint: null,
    incomingFingerprint: researchFormFingerprint(imported), incomingSourceVersion: "source-v1", incomingResultVersion: 1,
  }), "new");
  assert.equal(decideResearchImport({
    hasExisting: true, metadata, currentFingerprint: researchFormFingerprint(imported),
    incomingFingerprint: researchFormFingerprint(updated), incomingSourceVersion: "source-v2", incomingResultVersion: 2,
  }), "auto_update");
  assert.equal(decideResearchImport({
    hasExisting: true, metadata, currentFingerprint: researchFormFingerprint({ ...imported, title: "Manual edit" }),
    incomingFingerprint: researchFormFingerprint(updated), incomingSourceVersion: "source-v2", incomingResultVersion: 2,
  }), "conflict");
  assert.equal(decideResearchImport({
    hasExisting: true, metadata, currentFingerprint: researchFormFingerprint(imported),
    incomingFingerprint: researchFormFingerprint(imported), incomingSourceVersion: "source-v1", incomingResultVersion: 0,
  }), "stale");
});
