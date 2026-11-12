import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoreLane } from "../cloud/src/curation.mjs";

const gold = JSON.parse(readFileSync(new URL("./fixtures/preference-gold-order.synthetic.json", import.meta.url), "utf8"));
const sourceInputs = JSON.parse(readFileSync(new URL("./fixtures/threads-source-inputs-2026-11-10.json", import.meta.url), "utf8"));

test("synthetic preference gold order keeps the top ten and all expected lanes", () => {
  assert.equal(gold.items.length, 20);
  assert.equal(gold.topN, 10);
  assert.equal(new Set(gold.items.map((item) => item.number)).size, gold.items.length);
  const ranked = gold.items.map((item, index) => {
    const source = sourceInputs[item.number - 1];
    assert.ok(source?.sourceUrl && source?.title);
    const scored = scoreLane({ title: source.title, description: item.signal_text }, { nowMs: Date.parse("2026-11-10T00:00:00Z") });
    assert.equal(scored.lane, item.expected_lane, `saved item #${item.number}`);
    assert.ok(scored.pref_reasons.includes("freshness_unknown"));
    return { number: item.number, score: scored.pref_score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  assert.deepEqual(ranked.slice(0, gold.topN).map((item) => item.number), gold.expected_order);
});
