import assert from "node:assert/strict";
import test from "node:test";

import { formatIntelligenceSignal, messages, parseLocale } from "../lib/i18n.ts";

test("locale messages have visibly different interface modes", () => {
  assert.notEqual(messages["zh-Hant"].nav.home, messages["zh-en"].nav.home);
  assert.equal(messages["zh-Hant"].sourceInbox.pasteUrl, "貼連結");
  assert.equal(messages["zh-en"].sourceInbox.pasteUrl, "貼連結 / Paste URL");
  assert.equal(messages["zh-Hant"].language.contentHint, "介面語言不會翻譯文章原文或使用者輸入內容。");
  assert.match(messages["zh-Hant"].research.intelligence.scoreNote, /可觀察 signals 的維度比例/);
  assert.match(messages["zh-en"].research.intelligence.scoreNote, /observable signals/);
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
