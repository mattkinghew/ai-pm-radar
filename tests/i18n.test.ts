import assert from "node:assert/strict";
import test from "node:test";

import { formatIntelligenceSignal, formatSourceInboxBlocker, messages, parseLocale } from "../lib/i18n.ts";
import { calendarDayAge, dateInTimeZone } from "../lib/format.ts";
import { parseQuickCapture, serializeQuickCapture } from "../lib/quick-capture.ts";
import { renderSourceInboxDraftSummary, summarizeStoredWorkbench } from "../lib/source-inbox-draft-summary.ts";

test("locale messages have visibly different interface modes", () => {
  assert.notEqual(messages["zh-Hant"].nav.home, messages["zh-en"].nav.home);
  assert.equal(messages["zh-Hant"].sourceInbox.pasteUrl, "貼連結");
  assert.equal(messages["zh-en"].sourceInbox.pasteUrl, "貼連結 / Paste URL");
  assert.equal(messages["zh-Hant"].sourceInbox.cloudSyncSummary, "跨裝置同步（尚未啟用）");
  assert.equal(messages["zh-en"].sourceInbox.cloudSyncSummary, "跨裝置同步（尚未啟用） / Cross-device sync (not enabled)");
  assert.match(messages["zh-Hant"].sourceInbox.readingRuleDraft, /規則整理預覽，尚未 AI 分析/);
  assert.doesNotMatch(messages["zh-Hant"].sourceInbox.readingRuleDraft, /AI 草稿/);
  assert.match(messages["zh-en"].sourceInbox.readingRuleDraft, /Rule-organized preview/);
  assert.equal(messages["zh-Hant"].language.contentHint, "介面語言不會翻譯文章原文或使用者輸入內容。");
  assert.match(messages["zh-Hant"].research.intelligence.scoreNote, /可觀察 signals 的維度比例/);
  assert.match(messages["zh-en"].research.intelligence.scoreNote, /observable signals/);
  assert.match(messages["zh-Hant"].footer.securityBody, /草稿保存在目前瀏覽器/);
  assert.match(messages["zh-Hant"].footer.securityBody, /只有按下「AI 整理」/);
  assert.match(messages["zh-en"].footer.securityBody, /Drafts stay in this browser/);
  for (const locale of ["zh-Hant", "zh-en"] as const) {
    const userFacingCopy = [
      messages[locale].sourceInbox.localOnly,
      messages[locale].sourceInbox.contentHint,
      messages[locale].sourceInbox.analysisBoundary,
      messages[locale].home.quickCapturePrivacy,
      messages[locale].footer.securityBody,
    ].join(" ");
    assert.match(userFacingCopy, /目前瀏覽器|this browser/);
    assert.match(userFacingCopy, /AI 整理|Analyze with AI/);
    assert.doesNotMatch(userFacingCopy, /server-side|database|runner|JSON keys|enum values/iu);
  }
});

test("stored locale accepts only the two supported preferences", () => {
  assert.equal(parseLocale("zh-Hant"), "zh-Hant");
  assert.equal(parseLocale("zh-en"), "zh-en");
  assert.equal(parseLocale(null), null);
  assert.equal(parseLocale("en"), null);
});

test("research and source-inbox actions remain covered in both interface languages", () => {
  const keyPaths = (value: unknown, prefix = ""): string[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
    return Object.keys(value).sort().flatMap((key) => keyPaths((value as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key));
  };
  for (const section of ["research", "sourceInbox"] as const) {
    assert.deepEqual(keyPaths(messages["zh-Hant"][section]), keyPaths(messages["zh-en"][section]), `${section} translations must have matching keys`);
  }
});

test("candidate blockers use human-readable localized field names, never schema keys", () => {
  const cases = [
    ["Daily candidate metadata is missing question_title.", "每日候選資料缺少「研究問題標題」。", "每日候選資料缺少 / Daily candidate metadata is missing「研究問題標題 / Research question title」。"],
    ["Manual enrichment is missing ai_pm_implication.", "人工分析缺少「AI PM 關聯說明」。", "人工分析缺少 / Manual enrichment is missing「AI PM 關聯說明 / AI PM implication」。"],
    ["Daily candidate metadata trust_score must be between 1 and 10.", "「來源可信度評分」請填寫 1 至 10 分。", "「來源可信度評分 / Source trust score」請填寫 1 至 10 分。 / Enter a score from 1 to 10 for “來源可信度評分 / Source trust score”."],
  ] as const;
  for (const [reason, traditionalExpected, bilingualExpected] of cases) {
    const traditional = formatSourceInboxBlocker(reason, messages["zh-Hant"].sourceInbox.validation, messages["zh-Hant"].sourceInbox.invalidDate);
    const bilingual = formatSourceInboxBlocker(reason, messages["zh-en"].sourceInbox.validation, messages["zh-en"].sourceInbox.invalidDate);
    assert.equal(traditional, traditionalExpected);
    assert.equal(bilingual, bilingualExpected);
    assert.doesNotMatch(traditional + bilingual, /question_title|ai_pm_implication|trust_score/u);
  }
  const unknown = formatSourceInboxBlocker("Internal validator field_x failure", messages["zh-en"].sourceInbox.validation, messages["zh-en"].sourceInbox.invalidDate);
  assert.equal(unknown, messages["zh-en"].sourceInbox.validation.generic);
  assert.doesNotMatch(unknown, /field_x|validator/u);
});

test("home quick-capture copy is complete and the temporary handoff validates its version", () => {
  const keyPaths = (value: unknown, prefix = ""): string[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
    return Object.keys(value).sort().flatMap((key) => keyPaths((value as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key));
  };
  assert.deepEqual(keyPaths(messages["zh-Hant"].home), keyPaths(messages["zh-en"].home));
  assert.equal(messages["zh-Hant"].home.todaysFocus, "最新資料焦點");
  assert.equal(messages["zh-Hant"].home.topFive, "最新資料 Top 5");
  assert.match(messages["zh-Hant"].home.dataAge, /\{days\}/u);
  assert.match(messages["zh-en"].home.staleEdition, /7 days/iu);
  assert.doesNotMatch(messages["zh-Hant"].home.copy, /不需要後端|API key/);
  assert.match(messages["zh-en"].home.copy, /latest available edition/);
  assert.match(messages["zh-Hant"].home.quickCapturePrivacy, /目前瀏覽器/);
  assert.match(messages["zh-Hant"].home.quickCaptureSavedSummary, /今日待審核 {todayNeedsReview}/);
  assert.match(messages["zh-Hant"].home.quickCaptureSavedSummary, /{needsReview}/);
  assert.match(messages["zh-en"].home.quickCaptureSavedSummary, /{reviewedNotApproved}/);
  const summary = { total: 8, withBody: 6, needsBody: 2, todayNeedsReview: 3, needsReview: 4, reviewedNotApproved: 1, approved: 2, rejected: 1 };
  for (const locale of ["zh-Hant", "zh-en"] as const) {
    const rendered = renderSourceInboxDraftSummary(messages[locale].home.quickCaptureSavedSummary, summary);
    assert.doesNotMatch(rendered, /\{(?:total|withBody|needsBody|todayNeedsReview|needsReview|reviewedNotApproved|approved|rejected)\}/u);
    assert.equal((rendered.match(/\b8\b/gu) ?? []).length, locale === "zh-en" ? 2 : 1);
    assert.equal((rendered.match(/\b3\b/gu) ?? []).length, locale === "zh-en" ? 2 : 1);
  }
  const date = "2026-10-29";
  const approvedForm = { body: "approved body" };
  const reviewedForm = { body: "reviewed body" };
  const editedForm = { body: "edited after review" };
  const rejectedForm = { body: "rejected body" };
  const fingerprint = (form: object) => JSON.stringify({ form, date });
  assert.deepEqual(summarizeStoredWorkbench({
    candidateDate: date,
    activeMaterialId: "approved",
    reviewedFingerprint: fingerprint(approvedForm),
    approvedFingerprint: fingerprint(approvedForm),
    materials: [
      { id: "approved", form: approvedForm },
      { id: "reviewed", form: reviewedForm, reviewedFingerprint: fingerprint(reviewedForm) },
      { id: "edited", form: editedForm, reviewedFingerprint: fingerprint({ body: "old body" }) },
      { id: "rejected", form: rejectedForm, rejectedFingerprint: fingerprint(rejectedForm) },
      { id: "missing", form: { body: "  " } },
      null,
    ],
  }), { total: 6, withBody: 4, needsBody: 2, todayNeedsReview: 0, needsReview: 1, reviewedNotApproved: 1, approved: 1, rejected: 1 });
  assert.deepEqual(summarizeStoredWorkbench({
    candidateDate: date,
    activeMaterialId: "active",
    reviewedFingerprint: null,
    approvedFingerprint: null,
    materials: [{
      id: "active",
      form: approvedForm,
      reviewedFingerprint: fingerprint(approvedForm),
      approvedFingerprint: fingerprint(approvedForm),
    }],
  }), { total: 1, withBody: 1, needsBody: 0, todayNeedsReview: 0, needsReview: 1, reviewedNotApproved: 0, approved: 0, rejected: 0 });
  assert.deepEqual(summarizeStoredWorkbench(null), {
    total: 0, withBody: 0, needsBody: 0, todayNeedsReview: 0, needsReview: 0, reviewedNotApproved: 0, approved: 0, rejected: 0,
  });
  assert.equal(summarizeStoredWorkbench({ materials: [
    { id: "today-hkt", form: { body: "today", capturedAt: "2026-10-29T17:00:00.000Z" } },
    { id: "yesterday-hkt", form: { body: "old", capturedAt: "2026-10-29T15:59:59.000Z" } },
  ] }, new Date("2026-10-29T18:00:00.000Z")).todayNeedsReview, 1);
  assert.deepEqual(parseQuickCapture(serializeQuickCapture("synthetic text", "example.txt")), {
    version: 1,
    value: "synthetic text",
    fileName: "example.txt",
  });
  assert.throws(() => parseQuickCapture(JSON.stringify({ version: 2, value: "x", fileName: null })), /Unsupported/);
});

test("home freshness age uses Hong Kong calendar dates and rejects invalid or future dates", () => {
  assert.equal(dateInTimeZone(new Date("2026-10-29T16:30:00.000Z"), "Asia/Hong_Kong"), "2026-10-30");
  assert.equal(calendarDayAge("2026-07-02", "2026-10-30"), 120);
  assert.equal(calendarDayAge("2026-10-31", "2026-10-30"), null);
  assert.equal(calendarDayAge("2026-02-30", "2026-03-01"), null);
});

test("intelligence assessment explanations and signals follow the selected interface language", () => {
  assert.match(messages["zh-Hant"].research.intelligence.dimensionExplanations.relevance, /固定基線/);
  assert.match(messages["zh-en"].research.intelligence.dimensionExplanations.relevance, /fixed baseline/);
  assert.match(formatIntelligenceSignal("matches Radar focus", "zh-Hant"), /符合 Radar 焦點主題/);
  assert.match(formatIntelligenceSignal("ai", "zh-Hant", true), /命中焦點詞: ai/);
  assert.match(formatIntelligenceSignal("1/1 claims have locatable evidence", "zh-Hant"), /1\/1/);
  assert.match(formatIntelligenceSignal("future signal", "zh-Hant"), /future signal/);
  assert.match(formatIntelligenceSignal("matches Radar focus", "zh-en"), /Matches Radar focus/);
});

test("source inbox persistence hints match the IndexedDB recovery behavior", () => {
  assert.match(messages["zh-Hant"].sourceInbox.resetHint, /重新整理會載入最近一次已保存的版本/);
  assert.match(messages["zh-Hant"].sourceInbox.resetHint, /清除會刪除目前瀏覽器中保存/);
  assert.match(messages["zh-en"].sourceInbox.resetHint, /Refresh restores the most recently saved version/);
  assert.match(messages["zh-Hant"].sourceInbox.notSaved, /保存在目前瀏覽器/);
});
