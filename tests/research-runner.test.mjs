import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DEFAULT_RESEARCH_PROJECTS, emptyResearchState, hongKongDate } from "../lib/research-runtime.ts";
import { normaliseSourceInput } from "../lib/source-inbox.ts";
import { readRuntimeState, runtimePaths, writeRuntimeConfig, writeRuntimeState } from "../scripts/research-runtime.mjs";
import { runResearch } from "../scripts/research-runner.mjs";

const BODY = "A synthetic research note reports that 18 sample tickets were classified correctly.";

function feedItem(id, overrides = {}) {
  const now = new Date().toISOString();
  return {
    id,
    feed_url: "https://example.com/feed.xml",
    source_id: "synthetic-feed",
    item_id: id,
    article_url: `https://example.com/${id}`,
    title: `Synthetic item ${id}`,
    creator: null,
    published_at: now,
    updated_at: null,
    summary: "Synthetic summary for runner regression tests.",
    content: null,
    content_kind: "summary",
    discovered_at: now,
    source_refs: [{ source_id: "synthetic-feed", feed_url: "https://example.com/feed.xml", item_id: id }],
    ...overrides,
  };
}

function config(subscriptions = [{
  id: "synthetic-feed", name: "Synthetic feed", feed_url: "https://example.com/feed.xml", expert_name: "", reason: "fixture",
  topic_tags: [], priority: "medium", enabled: true, last_attempted_at: null, last_successful_at: null, etag: null, last_modified: null, recent_runs: [],
}]) {
  return {
    version: 3,
    collection_enabled: true,
    analysis_enabled: true,
    schedule: { enabled: false, timezone: "Asia/Hong_Kong", hour: 8, minute: 0 },
    subscriptions,
    projects: DEFAULT_RESEARCH_PROJECTS,
  };
}

function analysisDraft(sourceUrl) {
  return {
    summary: "合成短文摘要。",
    why_it_matters: "這是供流程測試使用的合成來源。",
    source_facts: ["The source reports 18 sample tickets."],
    key_points: ["18 sample tickets were classified correctly."],
    method_or_teaching_points: [],
    key_claims: [{ claim: "The test classified 18 tickets correctly.", evidence: [{ source: sourceUrl, timestamp: "", text_reference: "18 sample tickets were classified correctly." }] }],
    business_implication: "此測試不支持收入或時間效益結論。",
    ai_pm_implication: "先保留人工覆核，再評估分類準確度。",
    use_cases: [], content_ideas: [], uncertainties: ["合成測試，不能推及真實表現。"],
    suggested_title: "合成分類測試", question_title: "分類結果如何核對？", short_title: "合成分類",
    category: "AI product", daily_tags: ["AI"], tags: ["synthetic"], confidence: 0.7,
    impact_score: { value: 5, rationale: "合成測試沒有實際業務結果。" },
    relevance_score: { value: 5, rationale: "只用於驗證資料流程。" },
    trust_score: { value: 5, rationale: "原文是虛構測試素材。" },
  };
}

function feedResult(items) {
  return async () => ({ items, etag: null, lastModified: null, not_modified: false });
}

function fetchedBody(url) {
  return async (target) => ({ originalUrl: target, finalUrl: target, capturedAt: new Date().toISOString(), title: "Synthetic article", creator: null, publishedAt: null, completeness: "full", body: BODY });
}

function aiService(calls) {
  return async ({ sourceText, sourceUrl, onAttempt }) => {
    assert.equal(sourceText, BODY);
    await onAttempt();
    calls.count += 1;
    return { provider: "gemini", model: "synthetic-model", analysis: analysisDraft(sourceUrl), usage: null };
  };
}

function makeRuntime(t) {
  const runtimeDir = mkdtempSync(join(tmpdir(), "radar-research-runner-"));
  t.after(() => rmSync(runtimeDir, { recursive: true, force: true }));
  return runtimeDir;
}

test("runner captures, analyzes once, persists quota, and does not duplicate an existing draft", async (t) => {
  const runtimeDir = makeRuntime(t);
  const calls = { count: 0 };
  const item = feedItem("single");
  await writeRuntimeConfig(config(), runtimeDir);
  const services = {
    fetchPublicFeed: feedResult([item]),
    fetchPublicArticle: fetchedBody(item.article_url),
    requestAIAnalysis: aiService(calls),
  };

  const first = await runResearch({ runtimeDir, services });
  assert.equal(first.run.drafts_created, 1, JSON.stringify(first.run.errors));
  assert.equal(calls.count, 1);
  assert.equal(first.state.daily.quota.analysis_attempts, 1);
  const material = first.state.materials.find((entry) => entry.material_id === item.id);
  assert.equal(material.status, "draft");
  assert.equal(material.brief.source_scope, "full_text");
  assert.equal(material.source_record.review_status, "needs_review");
  assert.equal(material.source_record.approval_status, "not_approved");
  assert.equal(material.source_record.evidence_grade, "ungraded");

  const second = await runResearch({ runtimeDir, services: { ...services, fetchPublicFeed: feedResult([item]) } });
  assert.equal(second.run.drafts_created, 0);
  assert.equal(calls.count, 1);
  assert.equal(second.state.daily.quota.analysis_attempts, 1);
});

test("collection and analysis toggles operate independently", async (t) => {
  const captureRuntime = makeRuntime(t);
  const captureCalls = { count: 0 };
  const captureItem = feedItem("capture-only");
  const captureConfig = config();
  captureConfig.analysis_enabled = false;
  await writeRuntimeConfig(captureConfig, captureRuntime);
  const captured = await runResearch({ runtimeDir: captureRuntime, services: {
    fetchPublicFeed: feedResult([captureItem]),
    fetchPublicArticle: fetchedBody(captureItem.article_url),
    requestAIAnalysis: aiService(captureCalls),
  } });
  assert.equal(captured.run.feeds_attempted, 1);
  assert.equal(captured.run.body_attempted, 1);
  assert.equal(captureCalls.count, 0);
  assert.equal(captured.state.materials[0]?.status, "captured");

  const analysisRuntime = makeRuntime(t);
  const analysisCalls = { count: 0 };
  const analysisItem = feedItem("analysis-only");
  const record = normaliseSourceInput({ value: BODY, kind: "paste_text", sourceUrl: analysisItem.article_url }, { now: new Date().toISOString() }).record;
  const state = emptyResearchState(hongKongDate());
  state.materials = [{
    material_id: analysisItem.id, source_version: "v1-captured", result_version: 0, feed_item: analysisItem, source_record: record,
    status: "captured", content_scope: "full_text", selection_reasons: ["Previously captured"], score: 1,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: null, brief: null,
  }];
  const analysisConfig = config([]);
  analysisConfig.collection_enabled = false;
  await writeRuntimeConfig(analysisConfig, analysisRuntime);
  await writeRuntimeState(state, analysisRuntime);
  const analyzed = await runResearch({ runtimeDir: analysisRuntime, services: {
    fetchPublicFeed: async () => { throw new Error("Collection-disabled run must not fetch feeds"); },
    fetchPublicArticle: async () => { throw new Error("Captured material must not fetch its article again"); },
    requestAIAnalysis: aiService(analysisCalls),
  } });
  assert.equal(analyzed.run.feeds_attempted, 0);
  assert.equal(analyzed.run.body_attempted, 0);
  assert.equal(analysisCalls.count, 1);
  assert.equal(analyzed.state.materials[0]?.status, "draft");
  assert.equal(analyzed.state.daily.quota.analysis_attempts, 1);
});

test("a body-fetch failure is isolated and the following material still reaches analysis", async (t) => {
  const runtimeDir = makeRuntime(t);
  const calls = { count: 0 };
  const failedItem = feedItem("a-fails");
  const goodItem = feedItem("b-good");
  await writeRuntimeConfig(config(), runtimeDir);
  const result = await runResearch({ runtimeDir, services: {
    fetchPublicFeed: feedResult([failedItem, goodItem]),
    fetchPublicArticle: async (url) => {
      if (url.endsWith("a-fails")) throw Object.assign(new Error("Synthetic fetch failure"), { code: "timeout" });
      return fetchedBody(url)(url);
    },
    requestAIAnalysis: aiService(calls),
  } });
  assert.equal(result.run.failures, 1, JSON.stringify(result.run.errors));
  assert.equal(result.run.drafts_created, 1);
  assert.equal(calls.count, 1);
  assert.equal(result.state.materials.find((material) => material.material_id === "a-fails")?.status, "failed");
  assert.equal(result.state.materials.find((material) => material.material_id === "b-good")?.status, "draft");
});

test("five synthetic feeds isolate timeout and parse failures, retain redirects and unknown metadata, and rerun without duplicate fetches", async (t) => {
  const runtimeDir = makeRuntime(t);
  const subscriptions = ["a", "b", "c", "d", "e", "timeout", "invalid"].map((suffix) => ({
    id: `feed-${suffix}`, name: `Synthetic ${suffix}`, feed_url: `https://feeds.example/${suffix}.xml`, expert_name: "",
    reason: "Synthetic collection fixture", topic_tags: [], priority: "medium", enabled: true,
    last_attempted_at: null, last_successful_at: null, etag: null, last_modified: null, recent_runs: [],
  }));
  const makeItem = (sourceId, id, articleUrl, overrides = {}) => feedItem(id, {
    feed_url: `https://feeds.example/${sourceId}.xml`, source_id: `feed-${sourceId}`, article_url: articleUrl,
    source_refs: [{ source_id: `feed-${sourceId}`, feed_url: `https://feeds.example/${sourceId}.xml`, item_id: id }],
    ...overrides,
  });
  const shared = makeItem("a", "shared", "https://articles.example/shared");
  const feeds = new Map([
    ["a", [shared]],
    ["b", [makeItem("b", "shared-copy", "https://articles.example/shared")]],
    ["c", [makeItem("c", "redirected", "https://articles.example/redirected")]],
    ["d", [makeItem("d", "metadata-missing", "https://articles.example/metadata-missing", { title: "Feed title fallback", published_at: null, creator: null })]],
    ["e", [makeItem("e", "fifth", "https://articles.example/fifth")]],
  ]);
  let bodyFetches = 0;
  const runtimeConfig = config(subscriptions);
  runtimeConfig.analysis_enabled = false;
  await writeRuntimeConfig(runtimeConfig, runtimeDir);
  const services = {
    fetchPublicFeed: async (url) => {
      const key = url.split("/").at(-1).replace(".xml", "");
      if (key === "timeout") throw Object.assign(new Error("Synthetic timeout"), { code: "timeout" });
      if (key === "invalid") throw Object.assign(new Error("Synthetic invalid feed"), { code: "feed_parse_error" });
      return { items: feeds.get(key), etag: null, lastModified: null, not_modified: false };
    },
    fetchPublicArticle: async (url) => {
      bodyFetches += 1;
      return {
        originalUrl: url,
        finalUrl: url.endsWith("/redirected") ? "https://publisher.example/final-story" : url,
        capturedAt: new Date().toISOString(),
        title: url.endsWith("/metadata-missing") ? null : "Synthetic article title",
        creator: null,
        publishedAt: null,
        completeness: "full",
        body: BODY,
      };
    },
    requestAIAnalysis: async () => { throw new Error("Analysis is disabled in this fixture"); },
  };
  const first = await runResearch({ runtimeDir, services });
  assert.equal(first.run.feeds_succeeded, 5);
  assert.equal(first.run.new_items, 4);
  assert.equal(first.run.duplicates, 1);
  assert.deepEqual(first.run.errors.map((error) => error.code).sort(), ["feed_parse_error", "timeout"]);
  assert.equal(bodyFetches, 4);
  const redirected = first.state.materials.find((material) => material.material_id === "redirected").source_record;
  assert.equal(redirected.source_url_original, "https://articles.example/redirected");
  assert.equal(redirected.source_url_final, "https://publisher.example/final-story");
  const metadataMissing = first.state.materials.find((material) => material.material_id === "metadata-missing").source_record;
  assert.equal(metadataMissing.creator, null);
  assert.equal(metadataMissing.published_at, null);

  const second = await runResearch({ runtimeDir, services });
  assert.equal(second.run.new_items, 0);
  assert.equal(bodyFetches, 4, "a rerun must not fetch duplicate article bodies again");
  assert.equal(second.state.materials.length, 4);
});

test("a URL-less summary stays manual-input only and is never sent to the model as full text", async (t) => {
  const runtimeDir = makeRuntime(t);
  const calls = { count: 0 };
  const item = feedItem("summary-only", { article_url: null, content_kind: "summary" });
  await writeRuntimeConfig(config(), runtimeDir);
  const result = await runResearch({ runtimeDir, services: {
    fetchPublicFeed: feedResult([item]),
    fetchPublicArticle: async () => { throw new Error("No article URL should be fetched"); },
    requestAIAnalysis: aiService(calls),
  } });
  const material = result.state.materials.find((entry) => entry.material_id === item.id);
  assert.equal(material.status, "needs_manual_input");
  assert.equal(material.source_record.raw_text, item.summary);
  assert.equal(material.content_scope, "summary_only");
  assert.equal(result.run.manual_input_items, 1);
  assert.equal(result.run.failures, 0);
  assert.equal(result.state.daily.needs_manual_input, 1);
  assert.equal(calls.count, 0);
});

test("provider failure preserves captured source and evidence state without auto-approval or retry", async (t) => {
  const runtimeDir = makeRuntime(t);
  const item = feedItem("provider-unavailable");
  let attempts = 0;
  await writeRuntimeConfig(config(), runtimeDir);
  const services = {
    fetchPublicFeed: feedResult([item]),
    fetchPublicArticle: fetchedBody(item.article_url),
    requestAIAnalysis: async () => {
      attempts += 1;
      throw Object.assign(new Error("Synthetic provider unavailable"), { code: "provider_service_unavailable" });
    },
  };
  const first = await runResearch({ runtimeDir, services });
  const failed = first.state.materials.find((material) => material.material_id === item.id);
  assert.equal(failed.status, "failed");
  assert.equal(failed.source_record.raw_text, BODY);
  assert.equal(failed.source_record.review_status, "needs_review");
  assert.equal(failed.source_record.approval_status, "not_approved");
  assert.equal(failed.source_record.analysis.status, "failed");
  assert.equal(first.run.errors[0]?.code, "provider_service_unavailable");

  const second = await runResearch({ runtimeDir, services });
  assert.equal(attempts, 1, "a failed analysis requires explicit retry");
  assert.equal(second.state.materials.find((material) => material.material_id === item.id)?.source_record.raw_text, BODY);
});

test("three simulated HKT days retain success, partial collection and provider failure history", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-18T00:00:00.000Z") });
  const runtimeDir = makeRuntime(t);
  const dayOne = feedItem("day-one");
  const successCalls = { count: 0 };
  await writeRuntimeConfig(config(), runtimeDir);
  const first = await runResearch({ runtimeDir, services: {
    fetchPublicFeed: feedResult([dayOne]),
    fetchPublicArticle: fetchedBody(dayOne.article_url),
    requestAIAnalysis: aiService(successCalls),
  } });
  assert.equal(first.run.status, "completed");
  assert.equal(first.state.materials.find((material) => material.material_id === dayOne.id)?.status, "draft");

  t.mock.timers.setTime(new Date("2026-11-19T00:00:00.000Z").getTime());
  const goodSubscription = { ...config().subscriptions[0], id: "day-two-good", feed_url: "https://example.com/day-two.xml" };
  const timeoutSubscription = { ...goodSubscription, id: "day-two-timeout", feed_url: "https://example.com/timeout.xml" };
  const dayTwoConfig = config([goodSubscription, timeoutSubscription]);
  dayTwoConfig.analysis_enabled = false;
  await writeRuntimeConfig(dayTwoConfig, runtimeDir);
  const dayTwoItem = feedItem("day-two", { feed_url: goodSubscription.feed_url, source_id: goodSubscription.id });
  const second = await runResearch({ runtimeDir, services: {
    fetchPublicFeed: async (url) => {
      if (url === timeoutSubscription.feed_url) throw Object.assign(new Error("Synthetic Day 2 timeout"), { code: "timeout" });
      return { items: [dayTwoItem], etag: null, lastModified: null, not_modified: false };
    },
    fetchPublicArticle: fetchedBody(dayTwoItem.article_url),
    requestAIAnalysis: async () => { throw new Error("Analysis disabled for Day 2"); },
  } });
  assert.equal(second.run.status, "partial");
  assert.equal(second.state.materials.find((material) => material.material_id === dayTwoItem.id)?.status, "captured");

  t.mock.timers.setTime(new Date("2026-11-20T00:00:00.000Z").getTime());
  dayTwoConfig.collection_enabled = false;
  dayTwoConfig.analysis_enabled = true;
  await writeRuntimeConfig(dayTwoConfig, runtimeDir);
  const third = await runResearch({ runtimeDir, services: {
    fetchPublicFeed: async () => { throw new Error("Collection disabled for Day 3"); },
    fetchPublicArticle: async () => { throw new Error("Captured text must be reused"); },
    requestAIAnalysis: async () => { throw Object.assign(new Error("Synthetic provider unavailable"), { code: "provider_service_unavailable" }); },
  } });
  assert.equal(third.run.status, "failed");
  const retained = third.state.materials.find((material) => material.material_id === dayTwoItem.id);
  assert.equal(retained.status, "failed");
  assert.equal(retained.source_record.raw_text, BODY);
  assert.equal(retained.source_record.review_status, "needs_review");
  assert.equal(retained.source_record.approval_status, "not_approved");
  assert.deepEqual(third.state.runs.slice(0, 3).map((run) => [run.date, run.status]), [
    ["2026-11-20", "failed"], ["2026-11-19", "partial"], ["2026-11-18", "completed"],
  ]);
});

test("an interrupted in-flight material is preserved as failed and requires explicit retry", async (t) => {
  const runtimeDir = makeRuntime(t);
  const calls = { count: 0 };
  const item = feedItem("interrupted");
  const record = normaliseSourceInput({ value: BODY, kind: "paste_text", sourceUrl: item.article_url }, { now: new Date().toISOString() }).record;
  const state = emptyResearchState(hongKongDate());
  const interruptedRun = {
    run_id: "interrupted-run", date: state.daily.date, started_at: new Date().toISOString(), finished_at: null, status: "running",
    stages: { feed_sync: "completed", selection: "completed", body_capture: "completed", analysis: "running", brief: "running" },
    feeds_attempted: 1, feeds_succeeded: 1, new_items: 1, duplicates: 0, skipped_items: 0, body_attempted: 1,
    analyses_attempted: 1, drafts_created: 0, failures: 0, analysis_stopped: false, errors: [],
  };
  state.last_run = interruptedRun;
  state.runs = [interruptedRun];
  state.materials = [{
    material_id: item.id, source_version: "v1-interrupted", result_version: 0, feed_item: item, source_record: record,
    status: "analysis_running", content_scope: "full_text", selection_reasons: [], score: 1,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: null, brief: null,
  }];
  await writeRuntimeConfig(config([]), runtimeDir);
  await writeRuntimeState(state, runtimeDir);
  const result = await runResearch({ runtimeDir, services: {
    fetchPublicFeed: feedResult([]),
    fetchPublicArticle: async () => { throw new Error("Must not fetch already captured material"); },
    requestAIAnalysis: aiService(calls),
  } });
  const recovered = result.state.materials[0];
  assert.equal(recovered.status, "failed");
  assert.equal(recovered.error.code, "runner_interrupted");
  assert.equal(recovered.source_record.raw_text, BODY);
  assert.equal(calls.count, 0);
  assert.equal((await readRuntimeState(runtimeDir)).materials[0].status, "failed");
});

test("persisted daily AI and brief caps prevent additional provider requests", async (t) => {
  for (const cap of ["analysis_attempts", "briefs_created"]) {
    const runtimeDir = makeRuntime(t);
    const calls = { count: 0 };
    const item = feedItem(`cap-${cap}`);
    const record = normaliseSourceInput({ value: BODY, kind: "paste_text", sourceUrl: item.article_url }, { now: new Date().toISOString() }).record;
    const state = emptyResearchState(hongKongDate());
    state.daily.quota[cap] = cap === "analysis_attempts" ? 10 : 5;
    state.materials = [{
      material_id: item.id, source_version: "v1-cap", result_version: 0, feed_item: item, source_record: record,
      status: "analysis_pending", content_scope: "full_text", selection_reasons: [], score: 1,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: null, brief: null,
    }];
    await writeRuntimeConfig(config([]), runtimeDir);
    await writeRuntimeState(state, runtimeDir);
    const result = await runResearch({ runtimeDir, services: {
      fetchPublicFeed: feedResult([]),
      fetchPublicArticle: async () => { throw new Error("Already captured body must not be fetched"); },
      requestAIAnalysis: aiService(calls),
    } });
    assert.equal(result.state.materials[0]?.status, "deferred");
    assert.equal(result.state.materials[0]?.error?.code, cap === "analysis_attempts" ? "daily_analysis_limit_reached" : "daily_brief_limit_reached");
    assert.equal(calls.count, 0);
    assert.equal(result.state.daily.quota[cap], cap === "analysis_attempts" ? 10 : 5);
  }
});
