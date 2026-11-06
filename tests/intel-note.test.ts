import assert from "node:assert/strict";
import test from "node:test";

import { buildIntelNoteDraft, INTEL_NOTE_MAX_CHARS, INTEL_NOTE_SOURCES } from "../lib/intel-note.ts";
import { messages } from "../lib/i18n.ts";

test("intel note presets are the five agreed T0 sources, with bookmarks only for official pages", () => {
  assert.deepEqual(INTEL_NOTE_SOURCES.map((source) => source.id), ["mkt1", "growth-unhinged", "lenny", "hkpc", "lemlist"]);
  const bookmarks = INTEL_NOTE_SOURCES.filter((source) => source.bookmarkUrl);
  assert.deepEqual(bookmarks.map((source) => source.id), ["hkpc", "lemlist"]);
  for (const source of bookmarks) {
    assert.match(source.bookmarkUrl ?? "", /^https:\/\//);
  }
});

test("builds one unapproved research note without fetching a URL", () => {
  const result = buildIntelNoteDraft({
    sourceId: "mkt1",
    title: "AI GTM checklist",
    url: "https://example.com/mkt1-issue",
    note: "可試在 Diagnostic 用三段式定位。",
    useCase: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.sourceLabel, "MKT1");
  assert.equal(result.draft.url, "https://example.com/mkt1-issue");
  assert.equal(result.draft.useCase, "Diagnostic、Content Ops、獲客");
  assert.match(result.draft.body, /可試在 Diagnostic 用三段式定位/);
  assert.equal(result.draft.body.includes("https://example.com/mkt1-issue"), false);
  assert.equal(result.draft.evidenceReference, "可試在 Diagnostic 用三段式定位。");
});

test("rejects empty, oversized, and non-http intel notes", () => {
  assert.equal(buildIntelNoteDraft({ sourceId: "nope", title: "A", url: "", note: "B", useCase: "" }).ok, false);
  assert.deepEqual(buildIntelNoteDraft({ sourceId: "lenny", title: "  ", url: "", note: "A note", useCase: "" }), { ok: false, reason: "empty_title" });
  assert.deepEqual(buildIntelNoteDraft({ sourceId: "lenny", title: "Title", url: "", note: "  ", useCase: "" }), { ok: false, reason: "empty_note" });
  assert.deepEqual(buildIntelNoteDraft({ sourceId: "hkpc", title: "Title", url: "javascript:alert(1)", note: "A note", useCase: "" }), { ok: false, reason: "bad_url" });
  const oversized = buildIntelNoteDraft({ sourceId: "lemlist", title: "Title", url: "", note: "筆".repeat(INTEL_NOTE_MAX_CHARS + 1), useCase: "Outbound" });
  assert.deepEqual(oversized, { ok: false, reason: "note_too_long" });
});

test("intel note copy exists in both interface languages and states the manual boundary", () => {
  for (const locale of ["zh-Hant", "zh-en"] as const) {
    const copy = messages[locale].sourceInbox.intelNote;
    assert.match(copy.hint, /2000|不讀|does not read/i);
    assert.match(copy.policy, /Carrd/);
    assert.match(copy.noteTooLong, /2000/);
  }
  assert.match(messages["zh-Hant"].sourceInbox.intelNote.hint, /不讀郵箱/);
  assert.match(messages["zh-Hant"].sourceInbox.intelNote.saved, /不會自動批准/);
});
