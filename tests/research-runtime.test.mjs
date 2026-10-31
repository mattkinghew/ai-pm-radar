import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DEFAULT_RESEARCH_PROJECTS,
  aggregateResearchStatus,
  buildResearchBrief,
  emptyResearchState,
  hongKongDate,
  isResearchDateToday,
  selectFeedCandidates,
  summarizeResearchDate,
  resumableResearchMaterials,
} from "../lib/research-runtime.ts";
import { normaliseSourceInput } from "../lib/source-inbox.ts";
import { mergeFeedItems } from "../lib/source-feed.ts";
import { getCollectorSnapshotFreshness } from "../lib/collector-snapshot-status.ts";
import {
  acquireRunLock,
  readRuntimeConfig,
  readRuntimeState,
  runtimePaths,
  isResearchDue,
  writeRuntimeConfig,
  writeRuntimeState,
} from "../scripts/research-runtime.mjs";

const item = (id, overrides = {}) => ({
  id,
  feed_url: "https://example.com/feed.xml",
  source_id: "feed_1",
  item_id: id,
  article_url: `https://example.com/articles/${id}`,
  title: `Research ${id}`,
  creator: "Synthetic creator",
  published_at: "2026-09-19T00:00:00.000Z",
  updated_at: null,
  summary: "A synthetic summary.",
  content: null,
  content_kind: "summary",
  discovered_at: "2026-09-19T00:00:00.000Z",
  source_refs: [{ source_id: "feed_1", feed_url: "https://example.com/feed.xml", item_id: id }],
  ...overrides,
});

test("classifies Collector inbox snapshot freshness without implying a feed fetch succeeded", () => {
  const now = new Date("2026-10-26T00:00:00.000Z");

  assert.deepEqual(getCollectorSnapshotFreshness("2026-10-25T12:00:00.000Z", now), {
    status: "fresh",
    updatedAt: "2026-10-25T12:00:00.000Z",
  });
  assert.deepEqual(getCollectorSnapshotFreshness("2026-10-24T23:59:59.999Z", now), {
    status: "stale",
    updatedAt: "2026-10-24T23:59:59.999Z",
  });
  assert.deepEqual(getCollectorSnapshotFreshness(null, now), { status: "unknown", updatedAt: null });
  assert.deepEqual(getCollectorSnapshotFreshness("not-a-date", now), { status: "unknown", updatedAt: null });
  assert.deepEqual(getCollectorSnapshotFreshness("2026-10-26T00:10:00.000Z", now), { status: "unknown", updatedAt: null });
});

test("selects new feed items within the runner material limit and does not repeat drafts", () => {
  const record = normaliseSourceInput({ value: "Synthetic body", kind: "paste_text", sourceUrl: "https://example.com/articles/done" }, { now: "2026-09-19T00:00:00.000Z" }).record;
  const existing = [{
    material_id: "done",
    feed_item: item("done"),
    source_record: record,
    status: "draft",
    content_scope: "full_text",
    selection_reasons: [],
    score: 1,
    created_at: "2026-09-19T00:00:00.000Z",
    updated_at: "2026-09-19T00:00:00.000Z",
    error: null,
    brief: null,
  }];
  const selected = selectFeedCandidates([item("done"), item("new")], existing, 1, new Date("2026-09-19T00:00:00.000Z"));
  assert.deepEqual(selected.map((candidate) => candidate.item.id), ["new"]);
  assert.ok(selected[0]?.reasons.includes("本次新項目"));
});

test("keeps possible duplicate reports but places a distinct candidate first when available", () => {
  const first = item("first", { title: "AI PM Radar releases a model reliability guide", discovered_at: "2026-09-19T03:00:00.000Z" });
  const duplicate = item("duplicate", { title: "AI PM Radar releases a model reliability guide - updated", discovered_at: "2026-09-19T02:00:00.000Z" });
  const distinct = item("distinct", { title: "A classroom tests synthetic support ticket labels", discovered_at: "2026-09-19T01:00:00.000Z" });
  const selected = selectFeedCandidates([first, duplicate, distinct], [], 3, new Date("2026-09-19T04:00:00.000Z"));
  assert.deepEqual(selected.map((candidate) => candidate.item.id), ["first", "distinct", "duplicate"]);
  assert.match(selected[2]?.reasons.join(" ") ?? "", /來源保留/);
});

test("builds a clearly provisional research brief without changing review or approval", () => {
  const record = normaliseSourceInput({ value: "The customer pilot measured review time.", kind: "paste_text", sourceUrl: "https://example.com/research" }, { now: "2026-09-19T00:00:00.000Z" }).record;
  const analyzed = {
    ...record,
    summary: "A pilot measured workflow time.",
    key_points: ["The customer pilot measured review time."],
    key_claims: [{ claim: "The pilot measured review time.", evidence: [{ source: "https://example.com/research", timestamp: null, text_reference: "The customer pilot measured review time." }] }],
    ai_pm_implication: "Define the workflow metric before scaling.",
    content_ideas: ["A workflow measurement note."],
    analysis: { ...record.analysis, status: "draft", provider: "gemini", model: "gemini-test" },
  };
  const brief = buildResearchBrief(analyzed, "material-1", "2026-09-19T01:00:00.000Z", DEFAULT_RESEARCH_PROJECTS);
  assert.equal(brief.adoption, "undecided");
  assert.equal(brief.provider, "gemini");
  assert.equal(brief.key_claims[0]?.evidence[0]?.text_reference, "The customer pilot measured review time.");
  assert.equal(analyzed.review_status, "needs_review");
  assert.equal(analyzed.approval_status, "not_approved");
  assert.equal(brief.suggested_action, null);
});

test("suggests one bounded action only when the source-backed method exists", () => {
  const method = "First label the sample tickets, then compare each predicted category with the labels.";
  const record = normaliseSourceInput({ value: method, kind: "paste_text", sourceUrl: "https://example.com/method" }, { now: "2026-09-19T00:00:00.000Z" }).record;
  const analyzed = {
    ...record,
    summary: "The source describes a labeling comparison method.",
    ai_pm_implication: "這個方法支持可靠分析與可重用案例。",
    analysis: { ...record.analysis, status: "draft", provider: "gemini", model: "gemini-test", method_or_teaching_points: [method] },
  };
  const brief = buildResearchBrief(analyzed, "method-material", "2026-09-19T01:00:00.000Z", DEFAULT_RESEARCH_PROJECTS);
  assert.deepEqual(brief.method_or_teaching_points, [method]);
  assert.equal(brief.suggested_action?.minutes, 30);
  assert.match(brief.suggested_action?.deliverable ?? "", /一頁實驗記錄/);
  assert.match(brief.suggested_action?.affects_wip ?? "", /不自動加入/);
  assert.equal(analyzed.review_status, "needs_review");
  assert.equal(analyzed.approval_status, "not_approved");
});

test("does not suggest an action from an unrelated method without a project match", () => {
  const method = "Fold the paper twice and cut along the marked line.";
  const record = normaliseSourceInput({ value: method, kind: "paste_text", sourceUrl: "https://example.com/unrelated-method" }, { now: "2026-09-19T00:00:00.000Z" }).record;
  const analyzed = {
    ...record,
    summary: "The source describes a paper-folding method.",
    analysis: { ...record.analysis, status: "draft", provider: "gemini", model: "gemini-test", method_or_teaching_points: [method] },
  };
  assert.equal(buildResearchBrief(analyzed, "unrelated", "2026-09-19T01:00:00.000Z", DEFAULT_RESEARCH_PROJECTS).suggested_action, null);
});

test("v1 runtime config and new state are written in the current v3 format", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-pm-radar-runtime-"));
  try {
    const config = await writeRuntimeConfig({
      version: 1,
      collection_enabled: true,
      analysis_enabled: false,
      schedule: { enabled: false, timezone: "Asia/Hong_Kong", hour: 8, minute: 0 },
      subscriptions: [{ id: "feed_1", name: "Synthetic", feed_url: "https://example.com/feed.xml", expert_name: "", reason: "test", topic_tags: [], enabled: true, last_attempted_at: null, last_successful_at: null, etag: null, last_modified: null, recent_runs: [] }],
      projects: DEFAULT_RESEARCH_PROJECTS,
    }, directory);
    assert.equal(config.version, 3);
    assert.equal(config.subscriptions[0]?.priority, "medium");
    const state = await writeRuntimeState(emptyResearchState("2026-09-19"), directory);
    assert.equal(state.version, 3);
    assert.equal((await readRuntimeConfig(directory))?.subscriptions.length, 1);
    assert.equal((await readRuntimeState(directory)).daily.date, "2026-09-19");
    const release = await acquireRunLock(directory);
    await assert.rejects(acquireRunLock(directory), /already active/);
    await release();
    await writeRuntimeState({ ...state, daily: { ...state.daily, note: "second atomic save" } }, directory);
    assert.equal(readdirSync(directory).some((name) => name.endsWith(".tmp")), false);
    assert.equal((await readRuntimeState(directory)).daily.note, "second atomic save");
    assert.equal(state.version, 3);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the runtime lock blocks a separate Node process until it is released", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-pm-radar-cross-process-lock-"));
  const moduleUrl = new URL("../scripts/research-runtime.mjs", import.meta.url).href;
  const childScript = `import { acquireRunLock } from ${JSON.stringify(moduleUrl)}; try { const release = await acquireRunLock(${JSON.stringify(directory)}); await release(); } catch (error) { console.error(error.message); process.exitCode = 12; }`;
  try {
    const release = await acquireRunLock(directory);
    const blocked = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", childScript], { encoding: "utf8" });
    assert.equal(blocked.status, 12);
    assert.match(blocked.stderr, /already active/);
    await release();
    const accepted = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", childScript], { encoding: "utf8" });
    assert.equal(accepted.status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("migrates v1 runtime state without losing materials, briefs, quota history, or run status", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-pm-radar-runtime-v1-"));
  const date = "2026-09-19";
  const generatedAt = "2026-09-19T02:00:00.000Z";
  const record = normaliseSourceInput({
    value: "Legacy source body with a traceable sentence.",
    kind: "paste_text",
    sourceUrl: "https://example.com/legacy",
  }, { now: generatedAt }).record;
  const oldRun = {
    run_id: "legacy-run",
    date,
    started_at: generatedAt,
    finished_at: generatedAt,
    status: "partial",
    feeds_attempted: 2,
    feeds_succeeded: 1,
    new_items: 1,
    duplicates: 0,
    body_attempted: 1,
    analyses_attempted: 1,
    drafts_created: 1,
    failures: 1,
    errors: [],
  };
  const oldBrief = {
    version: 1,
    material_id: "legacy-item",
    source_record_id: record.id,
    generated_at: generatedAt,
    provider: "gemini",
    model: "gemini-test",
    source_scope: "full_text",
    summary: "Legacy summary",
    key_points: [],
    key_claims: [],
    method_or_teaching_points: [],
    applicability: [],
    business_implication: null,
    ai_pm_implication: null,
    uncertainties: [],
    project_recommendations: [{ project_id: "radar", project_name: "Radar", reason: "legacy reason", basis: "legacy basis" }],
    adoption: "undecided",
    recommendation_reason: "legacy recommendation",
    suggested_action: null,
    usage: null,
    feedback: null,
    feedback_note: "",
  };
  const legacyState = {
    version: 1,
    saved_at: generatedAt,
    feed_items: [item("legacy-item")],
    materials: [{
      material_id: "legacy-item",
      feed_item: item("legacy-item"),
      source_record: record,
      status: "draft",
      content_scope: "full_text",
      selection_reasons: ["legacy selection"],
      score: 5,
      created_at: generatedAt,
      updated_at: generatedAt,
      error: null,
      brief: oldBrief,
    }],
    runs: [oldRun],
    last_run: oldRun,
    daily: {
      date,
      status: "partial",
      new_items: 1,
      duplicate_items: 0,
      failed_items: 1,
      pending_analysis: 0,
      selected_material_ids: ["legacy-item"],
      recommended_action: null,
      note: "legacy daily summary",
    },
  };
  try {
    writeFileSync(runtimePaths(directory).state, JSON.stringify(legacyState));
    const migrated = await readRuntimeState(directory);
    assert.equal(migrated.version, 3);
    assert.equal(migrated.materials[0]?.source_record.raw_text, record.raw_text);
    assert.match(migrated.materials[0]?.source_version ?? "", /^v1-/u);
    assert.equal(migrated.materials[0]?.result_version, 1);
    assert.equal(migrated.materials[0]?.brief?.version, 3);
    assert.deepEqual(migrated.materials[0]?.brief?.source_dates, {
      published_at: item("legacy-item").published_at,
      updated_at: item("legacy-item").updated_at,
      discovered_at: item("legacy-item").discovered_at,
    });
    assert.deepEqual(migrated.materials[0]?.brief?.project_recommendations[0], {
      ...oldBrief.project_recommendations[0],
      project_updated_at: null,
      matched_goal: null,
      matched_blocker: null,
    });
    assert.deepEqual(migrated.last_run?.stages, {
      feed_sync: "partial",
      selection: "completed",
      body_capture: "partial",
      analysis: "partial",
      brief: "completed",
    });
    assert.equal(migrated.daily.quota.source_attempts, 2);
    assert.equal(migrated.daily.quota.body_attempts, 1);
    assert.equal(migrated.daily.quota.analysis_attempts, 1);
    assert.equal(migrated.daily.quota.briefs_created, 1);
    assert.equal(migrated.daily.quota.actions_suggested, 0);
    assert.equal(migrated.daily.status, "partial");
    assert.deepEqual(await readRuntimeState(directory), migrated);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("migrates a v2 config and state into v3 without losing its manual brief data", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-pm-radar-runtime-v2-"));
  const date = "2026-09-19";
  const record = normaliseSourceInput({ value: "V2 preserved body", kind: "paste_text", sourceUrl: "https://example.com/v2" }, { now: "2026-09-19T01:00:00.000Z" }).record;
  try {
    writeFileSync(runtimePaths(directory).config, JSON.stringify({ version: 2, collection_enabled: true, analysis_enabled: false, schedule: { enabled: false }, subscriptions: [{ id: "feed_1", name: "Feed", feed_url: "https://example.com/feed.xml", enabled: true }], projects: DEFAULT_RESEARCH_PROJECTS }));
    writeFileSync(runtimePaths(directory).state, JSON.stringify({
      version: 2, saved_at: "2026-09-19T01:00:00.000Z", feed_items: [item("v2")], materials: [{
        material_id: "v2", feed_item: item("v2"), source_record: record, status: "draft", content_scope: "full_text",
        selection_reasons: ["v2 reason"], score: 1, created_at: "2026-09-19T01:00:00.000Z", updated_at: "2026-09-19T01:00:00.000Z", error: null,
        brief: { version: 2, material_id: "v2", generated_at: "2026-09-19T01:00:00.000Z", project_recommendations: [], suggested_action: null },
      }], runs: [], last_run: null, daily: { date, quota: { source_attempts: 1, body_attempts: 1, analysis_attempts: 1, briefs_created: 1 } },
    }));
    const configV3 = await readRuntimeConfig(directory);
    const stateV3 = await readRuntimeState(directory);
    assert.equal(configV3.version, 3);
    assert.equal(stateV3.version, 3);
    assert.equal(stateV3.materials[0]?.source_record.raw_text, "V2 preserved body");
    assert.equal(stateV3.materials[0]?.brief?.version, 3);
    assert.deepEqual(stateV3.materials[0]?.brief?.selection_reasons, ["v2 reason"]);
    assert.equal(stateV3.daily.quota.actions_suggested, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Hong Kong date is explicit and feed merge retains provenance", () => {
  assert.equal(hongKongDate(new Date("2026-09-18T16:30:00.000Z")), "2026-09-19");
  const merged = mergeFeedItems([], [item("one")]);
  assert.equal(merged.items[0]?.source_refs[0]?.source_id, "feed_1");
});

test("research date is labeled today only when it matches the current Hong Kong date", () => {
  const now = new Date("2026-10-29T18:00:00.000Z");
  assert.equal(hongKongDate(now), "2026-10-30");
  assert.equal(isResearchDateToday("2026-10-30", now), true);
  assert.equal(isResearchDateToday("2026-10-11", now), false);
});

test("does not invent a suggested action and snapshots source dates and project version", () => {
  const record = normaliseSourceInput({ value: "A source body without a concrete next step.", kind: "paste_text", sourceUrl: "https://example.com/research" }, { now: "2026-09-19T00:00:00.000Z" }).record;
  const analyzed = {
    ...record,
    summary: "A bounded synthetic summary.",
    ai_pm_implication: "This may be relevant to product evaluation, but no specific experiment is supported.",
    analysis: { ...record.analysis, status: "draft", provider: "gemini", model: "gemini-test" },
  };
  const project = { ...DEFAULT_RESEARCH_PROJECTS[0], goal: "product evaluation", updated_at: "2026-09-19T02:00:00.000Z" };
  const brief = buildResearchBrief(analyzed, "material-2", "2026-09-19T03:00:00.000Z", [project]);
  assert.equal(brief.suggested_action, null);
  assert.equal(brief.project_recommendations[0]?.project_updated_at, project.updated_at);
  assert.deepEqual(brief.source_dates, { published_at: null, updated_at: null, discovered_at: "2026-09-19T03:00:00.000Z" });
});

test("resumes only safe pending work and requires explicit retry for failures or provider-stop deferrals", () => {
  const source_record = { transcript: null, raw_text: "Captured source body." };
  const materials = [
    { material_id: "pending", status: "analysis_pending", error: null, brief: null, source_record },
    { material_id: "quota", status: "deferred", error: { stage: "analysis", code: "daily_analysis_limit_reached" }, brief: null, source_record },
    { material_id: "auth", status: "deferred", error: { stage: "analysis", code: "analysis_stage_stopped" }, brief: null, source_record },
    { material_id: "failed", status: "failed", error: { stage: "analysis", code: "timeout" }, brief: null, source_record },
    { material_id: "done", status: "draft", error: null, brief: {}, source_record },
  ];
  assert.deepEqual(resumableResearchMaterials(materials, { analysisEnabled: true }).map((material) => material.material_id), ["pending", "quota"]);
  assert.deepEqual(resumableResearchMaterials(materials, { analysisEnabled: true, retryFailed: true }).map((material) => material.material_id), ["pending", "quota", "auth", "failed"]);
});

test("scheduled collection uses Hong Kong date and runs once after 08:00 without backfilling missed days", () => {
  const config = { collection_enabled: true, schedule: { enabled: true, timezone: "Asia/Hong_Kong", hour: 8, minute: 0 } };
  assert.equal(isResearchDue(config, { last_run: null }, new Date("2026-09-18T23:59:00.000Z")), false);
  assert.equal(isResearchDue(config, { last_run: null }, new Date("2026-09-19T00:00:00.000Z")), true);
  assert.equal(isResearchDue(config, { last_run: { date: "2026-09-19", status: "completed" } }, new Date("2026-09-19T00:05:00.000Z")), false);
  assert.equal(isResearchDue(config, { last_run: { date: "2026-09-18", status: "completed" } }, new Date("2026-09-19T02:00:00.000Z")), true);
  assert.equal(isResearchDue({ ...config, collection_enabled: false, analysis_enabled: true }, { last_run: null }, new Date("2026-09-19T00:00:00.000Z")), true);
  assert.equal(isResearchDue({ ...config, collection_enabled: false, analysis_enabled: false }, { last_run: null }, new Date("2026-09-19T00:00:00.000Z")), false);
});

test("historical date summary uses that date's runs and briefs rather than today's daily counters", () => {
  const state = emptyResearchState("2026-09-20");
  state.runs = [{
    run_id: "run_yesterday", date: "2026-09-19", started_at: "2026-09-18T18:00:00.000Z", finished_at: "2026-09-18T18:01:00.000Z",
    status: "partial", stages: { feed_sync: "completed", selection: "completed", body_capture: "partial", analysis: "partial", brief: "completed" },
    feeds_attempted: 1, feeds_succeeded: 1, new_items: 2, duplicates: 1, skipped_items: 1, body_attempted: 1, analyses_attempted: 1, drafts_created: 1, failures: 1, errors: [],
  }];
  const material = {
    material_id: "yesterday", source_version: "v1-test", result_version: 1, feed_item: item("yesterday"),
    source_record: normaliseSourceInput({ value: "Historical body", kind: "paste_text", sourceUrl: "https://example.com/old" }, { now: "2026-09-18T18:00:00.000Z" }).record,
    status: "draft", content_scope: "full_text", selection_reasons: [], score: 1,
    created_at: "2026-09-18T18:00:00.000Z", updated_at: "2026-09-18T18:01:00.000Z", error: null,
    brief: { generated_at: "2026-09-18T18:01:00.000Z" },
  };
  state.materials = [material];
  state.daily = { ...state.daily, date: "2026-09-20", new_items: 99, selected_material_ids: [] };
  const summary = summarizeResearchDate(state, "2026-09-19");
  assert.equal(summary.status, "partial");
  assert.equal(summary.new_items, 2);
  assert.equal(summary.analyzed_items, 1);
  assert.deepEqual(summary.selected_material_ids, ["yesterday"]);
});

test("reports mixed failed and completed runs as partial rather than failed", () => {
  assert.equal(aggregateResearchStatus(
    [{ status: "completed" }, { status: "failed" }],
    { briefs: 0, pending: 1, manualInput: 0, failed: 1 },
  ), "partial");
  assert.equal(aggregateResearchStatus(
    [{ status: "failed" }],
    { briefs: 0, pending: 0, manualInput: 0, failed: 1 },
  ), "failed");
});
