import process from "node:process";
import { randomUUID } from "node:crypto";

import {
  MAX_ANALYSIS_INPUT_CHARS,
  fetchPublicArticle,
  fetchPublicFeed,
  requestAIAnalysis,
} from "./source-fetch-helper.mjs";
import {
  RESEARCH_LIMITS,
  aggregateResearchStatus,
  buildResearchBrief,
  emptyResearchState,
  hongKongDate,
  hasConservativeTitleOverlap,
  resumableResearchMaterials,
  selectFeedCandidates,
} from "../lib/research-runtime.ts";
import { mergeFeedItems } from "../lib/source-feed.ts";
import { applyAIAnalysisDraft, createAnalysisSourceSnapshot } from "../lib/ai-analysis.ts";
import { normaliseSourceInput } from "../lib/source-inbox.ts";
import {
  acquireRunLock,
  appendRuntimeLog,
  getRuntimeDir,
  isResearchDue,
  readRuntimeConfig,
  readRuntimeState,
  writeRuntimeConfig,
  writeRuntimeState,
} from "./research-runtime.mjs";

function flag(name) {
  return process.argv.includes(name);
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function nowIso() {
  return new Date().toISOString();
}

function sourceCollection(item) {
  return {
    version: 1,
    feed_url: item.feed_url,
    source_id: item.source_id,
    item_id: item.item_id,
    content_kind: item.content_kind,
    discovered_at: item.discovered_at,
    feed_updated_at: item.updated_at,
  };
}

function sourceRecordForItem(item, body = "", fetched = null) {
  const finalUrl = fetched?.finalUrl ?? item.article_url;
  const sourceUrl = finalUrl ?? item.article_url ?? item.feed_url;
  const kind = body.trim() ? "paste_text" : "manual_url";
  return normaliseSourceInput({
    value: body.trim() ? body : sourceUrl,
    kind,
    sourceUrl,
    originalSourceUrl: item.article_url ?? item.feed_url,
    finalSourceUrl: finalUrl ?? item.article_url ?? item.feed_url,
    title: fetched?.title || item.title,
    creator: fetched?.creator || item.creator || undefined,
    description: item.summary || undefined,
    publishedAt: fetched?.publishedAt || item.published_at || undefined,
    capturedAt: fetched?.capturedAt || nowIso(),
    collection: sourceCollection(item),
  }, { now: fetched?.capturedAt || nowIso() }).record;
}

function makeError(stage, error) {
  const code = typeof error?.code === "string" ? error.code : `${stage}_failed`;
  const message = typeof error?.message === "string" ? error.message.slice(0, 300) : `${stage} failed.`;
  return { stage, code, message };
}

function setMaterial(state, materialId, update) {
  state.materials = state.materials.map((material) => material.material_id === materialId
    ? { ...material, ...update, updated_at: nowIso() }
    : material);
}

function quotaAvailable(state, field, limit) {
  const quota = state.daily.quota;
  if (quota[field] >= limit) return false;
  quota[field] += 1;
  return true;
}

async function runLimited(values, limit, task) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const value = values[cursor++];
      await task(value);
    }
  }));
}

async function syncFeeds(config, state, run, runtimeDir, services) {
  const remainingSources = Math.max(0, RESEARCH_LIMITS.maxSources - state.daily.quota.source_attempts);
  const sources = config.subscriptions.filter((source) => source.enabled).slice(0, remainingSources);
  const results = [];
  await runLimited(sources, RESEARCH_LIMITS.maxConcurrentTasks, async (subscription) => {
    if (!quotaAvailable(state, "source_attempts", RESEARCH_LIMITS.maxSources)) return;
    run.feeds_attempted += 1;
    await writeRuntimeState(state, runtimeDir);
    try {
      const result = await services.fetchPublicFeed(subscription.feed_url, {
        etag: subscription.etag,
        lastModified: subscription.last_modified,
        sourceId: subscription.id,
      });
      const merged = mergeFeedItems(state.feed_items, result.items);
      state.feed_items = merged.items;
      run.feeds_succeeded += 1;
      run.new_items += merged.additions.length;
      run.duplicates += merged.duplicates.length;
      results.push(...merged.additions);
      const attempted = nowIso();
      config.subscriptions = config.subscriptions.map((candidate) => candidate.id === subscription.id
        ? {
            ...candidate,
            etag: result.etag,
            last_modified: result.last_modified,
            last_attempted_at: attempted,
            last_successful_at: attempted,
            recent_runs: [{
              attempted_at: attempted,
              status: result.not_modified ? "not_modified" : "success",
              added: merged.additions.length,
              duplicates: merged.duplicates.length,
              updates: merged.updates.length,
              skipped: 0,
              reason: null,
              duration_ms: 0,
            }, ...candidate.recent_runs].slice(0, RESEARCH_LIMITS.maxRecentRuns),
          }
        : candidate);
      await writeRuntimeConfig(config, runtimeDir);
      await writeRuntimeState(state, runtimeDir);
    } catch (error) {
      const failure = makeError("feed", error);
      run.failures += 1;
      run.errors.push(failure);
      const attempted = nowIso();
      config.subscriptions = config.subscriptions.map((candidate) => candidate.id === subscription.id
        ? {
            ...candidate,
            last_attempted_at: attempted,
            recent_runs: [{ attempted_at: attempted, status: "failed", added: 0, duplicates: 0, updates: 0, skipped: 0, reason: failure.code, duration_ms: 0 }, ...candidate.recent_runs].slice(0, RESEARCH_LIMITS.maxRecentRuns),
          }
        : candidate);
      await writeRuntimeConfig(config, runtimeDir);
      await writeRuntimeState(state, runtimeDir);
    }
  });
  return results;
}

function discoveryMaterial(item, generatedAt, projects) {
  const record = sourceRecordForItem(item);
  return {
    material_id: item.id,
    source_version: createAnalysisSourceSnapshot(record).source_version,
    result_version: 0,
    feed_item: item,
    source_record: record,
    status: "discovered",
    content_scope: item.content_kind === "feed_content" ? "feed_content" : item.content_kind === "summary" ? "summary_only" : "none",
    selection_reasons: [],
    score: 0,
    created_at: generatedAt,
    updated_at: generatedAt,
    error: null,
    brief: null,
  };
}

async function captureAndAnalyse(material, config, state, run, runtimeDir, services) {
  let record = material.source_record;
  let body = record.transcript?.trim()
    ? record.transcript
    : material.content_scope !== "summary_only" && record.raw_text.trim() ? record.raw_text : "";
  if (!body && material.feed_item.content_kind === "feed_content") body = material.feed_item.content ?? "";
  let fetched = null;
  if (!body && material.feed_item.article_url) {
    if (!quotaAvailable(state, "body_attempts", RESEARCH_LIMITS.maxBodyAttemptsPerDay)) {
      setMaterial(state, material.material_id, {
        status: "deferred",
        error: { stage: "article", code: "daily_body_limit_reached", message: "今日正文擷取上限已達；素材保留，下一個香港日期再處理。" },
      });
      await writeRuntimeState(state, runtimeDir);
      return;
    }
    run.body_attempted += 1;
    setMaterial(state, material.material_id, { status: "capturing_body", error: null });
    await writeRuntimeState(state, runtimeDir);
    try {
      fetched = await services.fetchPublicArticle(material.feed_item.article_url);
      body = fetched.body ?? "";
    } catch (error) {
      const failure = makeError("article", error);
      setMaterial(state, material.material_id, { status: "failed", error: failure });
      run.failures += 1;
      run.errors.push(failure);
      await writeRuntimeState(state, runtimeDir);
      return;
    }
  }
  if (!body.trim()) {
    const failure = { stage: "article", code: "no_article_body", message: "No full text was available; manual paste is required." };
    setMaterial(state, material.material_id, { status: "needs_manual_input", content_scope: "summary_only", error: failure });
    run.manual_input_items += 1;
    run.errors.push(failure);
    await writeRuntimeState(state, runtimeDir);
    return;
  }
  if (!record.transcript?.trim() && (fetched || !record.raw_text.trim())) record = sourceRecordForItem(material.feed_item, body, fetched);
  const contentScope = fetched?.completeness === "partial"
    ? "summary_only"
    : material.feed_item.content_kind === "feed_content" && !fetched ? "feed_content" : fetched ? "full_text" : material.content_scope === "summary_only" ? "summary_only" : "full_text";
  setMaterial(state, material.material_id, { source_record: record, source_version: createAnalysisSourceSnapshot(record).source_version, status: config.analysis_enabled ? "analysis_pending" : "captured", content_scope: contentScope, error: null });
  await writeRuntimeState(state, runtimeDir);
  if (!config.analysis_enabled) return;
  if (body.length > MAX_ANALYSIS_INPUT_CHARS) {
    const failure = { stage: "analysis", code: "analysis_input_too_long", message: "Source text exceeds the local AI analysis limit; the captured text was preserved." };
    setMaterial(state, material.material_id, { status: "failed", error: failure });
    run.failures += 1;
    run.errors.push(failure);
    await writeRuntimeState(state, runtimeDir);
    return;
  }
  if (run.analysis_stopped) {
    setMaterial(state, material.material_id, {
      status: "deferred",
      error: { stage: "analysis", code: "analysis_stage_stopped", message: "前一筆遇到認證或配額阻擋；正文已保存，分析階段已停止。" },
    });
    await writeRuntimeState(state, runtimeDir);
    return;
  }
  if (state.daily.quota.briefs_created >= RESEARCH_LIMITS.maxBriefsPerDay) {
    setMaterial(state, material.material_id, {
      status: "deferred",
      error: { stage: "analysis", code: "daily_brief_limit_reached", message: "今日研究精選已達 5 項；素材與正文已保存，未再呼叫模型。" },
    });
    await writeRuntimeState(state, runtimeDir);
    return;
  }
  const remainingAnalysisRequests = RESEARCH_LIMITS.maxAnalysisAttemptsPerDay - state.daily.quota.analysis_attempts;
  if (remainingAnalysisRequests <= 0) {
    setMaterial(state, material.material_id, {
      status: "deferred",
      error: { stage: "analysis", code: "daily_analysis_limit_reached", message: "今日 AI 分析上限已達；素材保留，未發送新模型請求。" },
    });
    await writeRuntimeState(state, runtimeDir);
    return;
  }
  run.analyses_attempted += 1;
  setMaterial(state, material.material_id, { status: "analysis_running", error: null });
  await writeRuntimeState(state, runtimeDir);
  try {
    const result = await services.requestAIAnalysis({
      sourceText: body,
      title: record.title ?? material.feed_item.title,
      sourceUrl: record.source_url ?? material.feed_item.article_url ?? material.feed_item.feed_url,
      language: record.language,
      maxAttempts: Math.min(RESEARCH_LIMITS.maxProviderAttemptsPerAnalysis, remainingAnalysisRequests),
      onAttempt: async (_attempt, meta) => {
        if (!quotaAvailable(state, "analysis_attempts", RESEARCH_LIMITS.maxAnalysisAttemptsPerDay)) {
          const quotaError = new Error("Daily AI request quota was reached.");
          quotaError.code = "daily_analysis_limit_reached";
          throw quotaError;
        }
        const providerKey = meta?.provider || "unknown";
        const byProvider = state.daily.quota.analysis_attempts_by_provider ?? {};
        byProvider[providerKey] = (byProvider[providerKey] ?? 0) + 1;
        state.daily.quota.analysis_attempts_by_provider = byProvider;
        await writeRuntimeState(state, runtimeDir);
      },
    });
    const analyzed = applyAIAnalysisDraft(record, result.analysis, {
      provider: result.provider,
      model: result.model,
      analyzedAt: nowIso(),
      usage: result.usage ?? null,
    });
    const brief = {
      ...buildResearchBrief(analyzed, material.material_id, nowIso(), config.projects, contentScope),
      selection_reasons: material.selection_reasons ?? [],
      fallback_from: result.fallback_from ?? null,
    };
    if (brief.suggested_action) {
      if (state.daily.quota.actions_suggested >= RESEARCH_LIMITS.maxActionsPerDay) brief.suggested_action = null;
      else state.daily.quota.actions_suggested += 1;
    }
    state.daily.quota.briefs_created += 1;
    setMaterial(state, material.material_id, { source_record: analyzed, result_version: (material.result_version ?? 0) + 1, status: "draft", brief, error: null });
    run.drafts_created += 1;
  } catch (error) {
    const failure = makeError("analysis", error);
    setMaterial(state, material.material_id, { source_record: { ...record, analysis: { ...record.analysis, status: "failed", error_code: failure.code } }, status: "failed", error: failure });
    run.failures += 1;
    run.errors.push(failure);
    if (["rate_limited", "provider_auth_failed", "provider_permission_denied", "model_not_configured", "provider_not_configured", "model_unavailable", "model_unavailable_for_account", "provider_service_unavailable"].includes(failure.code)) {
      run.analysis_stopped = true;
    }
  }
  await writeRuntimeState(state, runtimeDir);
}

function updateDaily(state, run, date) {
  const drafts = state.materials
    .filter((material) => material.status === "draft" && material.brief && hongKongDate(new Date(material.brief.generated_at)) === date)
    .sort((left, right) => (right.brief?.generated_at ?? "").localeCompare(left.brief?.generated_at ?? ""))
    .slice(0, RESEARCH_LIMITS.maxBriefsPerDay);
  const pending = state.materials.filter((material) => ["analysis_pending", "analysis_running", "capturing_body", "captured", "deferred", "discovered"].includes(material.status)).length;
  const manualInput = state.materials.filter((material) => material.status === "needs_manual_input" && hongKongDate(new Date(material.created_at)) === date).length;
  const recommendedAction = drafts.map((material) => material.brief?.suggested_action).find(Boolean) ?? null;
  const dayRuns = state.runs.filter((entry) => entry.date === date);
  state.daily = {
    date,
    status: aggregateResearchStatus(dayRuns, {
      briefs: drafts.length,
      pending,
      manualInput,
      failed: state.materials.filter((material) => material.status === "failed" && hongKongDate(new Date(material.updated_at)) === date).length,
    }),
    new_items: dayRuns.reduce((sum, entry) => sum + entry.new_items, 0),
    duplicate_items: dayRuns.reduce((sum, entry) => sum + entry.duplicates, 0),
    skipped_items: dayRuns.reduce((sum, entry) => sum + entry.skipped_items, 0),
    failed_items: dayRuns.reduce((sum, entry) => sum + entry.failures, 0),
    pending_analysis: pending,
    needs_manual_input: manualInput,
    selected_material_ids: drafts.map((material) => material.material_id),
    recommended_action: recommendedAction,
    quota: state.daily.quota,
    note: drafts.length > 0 ? "研究簡報草稿仍需人工核對；不代表已發布或 verified。" : manualInput > 0 ? "有素材需要補入正文；不會把摘要當成全文分析。" : "今天無可用研究簡報草稿；不自動補造行動。",
  };
}

export async function runResearch({ runtimeDir = getRuntimeDir(), scheduled = false, retryFailed = false, services: providedServices = {} } = {}) {
  const services = {
    fetchPublicFeed,
    fetchPublicArticle,
    requestAIAnalysis,
    ...providedServices,
  };
  const release = await acquireRunLock(runtimeDir);
  try {
    const config = await readRuntimeConfig(runtimeDir);
    if (!config) throw new Error("Research runtime is not configured; hand off selected sources first.");
    let state = await readRuntimeState(runtimeDir);
    const date = hongKongDate();
    if (scheduled && !isResearchDue(config, state)) {
      return { skipped: true, reason: "not_due", state };
    }
    const startedAt = nowIso();
    const run = {
      run_id: `research_${randomUUID()}`,
      date,
      started_at: startedAt,
      finished_at: null,
      status: "running",
      stages: { feed_sync: "pending", selection: "pending", body_capture: "pending", analysis: "pending", brief: "pending" },
      analysis_stopped: false,
      feeds_attempted: 0,
      feeds_succeeded: 0,
      new_items: 0,
      duplicates: 0,
      skipped_items: 0,
      manual_input_items: 0,
      body_attempted: 0,
      analyses_attempted: 0,
      drafts_created: 0,
      failures: 0,
      errors: [],
    };
    if (state.last_run?.status === "running") {
      state.last_run.status = "partial";
      state.last_run.finished_at = startedAt;
      state.last_run.errors = [...state.last_run.errors, { stage: "storage", code: "runner_interrupted", message: "上一個 runner 未正常完成；可續行已保存素材。" }];
      for (const stage of Object.keys(state.last_run.stages ?? {})) {
        if (state.last_run.stages[stage] === "running") state.last_run.stages[stage] = "partial";
      }
      if (state.runs[0]?.run_id === state.last_run.run_id) state.runs[0] = state.last_run;
      for (const material of state.materials) {
        if (material.status === "capturing_body" || material.status === "analysis_running") {
          const stage = material.status === "capturing_body" ? "article" : "analysis";
          const interrupted = { stage, code: "runner_interrupted", message: "處理期間 runner 中斷；素材已保留，請明確重試，避免不知情地重複請求。" };
          setMaterial(state, material.material_id, {
            status: "failed",
            error: interrupted,
            ...(stage === "analysis" ? { source_record: { ...material.source_record, analysis: { ...material.source_record.analysis, status: "failed", error_code: "runner_interrupted" } } } : {}),
          });
        }
      }
    }
    const previousDaily = state.daily.date === date ? state.daily : emptyResearchState(date).daily;
    state.daily = { ...previousDaily, date, status: "running" };
    state.last_run = run;
    state.runs = [run, ...state.runs].slice(0, RESEARCH_LIMITS.maxRecentRuns);
    await writeRuntimeState(state, runtimeDir);
    if (!config.collection_enabled && !config.analysis_enabled) {
      run.status = "skipped";
      run.stages = { feed_sync: "skipped", selection: "skipped", body_capture: "skipped", analysis: "skipped", brief: "skipped" };
      run.finished_at = nowIso();
      state.last_run = run;
      state.daily = { ...state.daily, status: "completed", note: "自動收集與自動分析均未啟用；未發出 feed、正文或模型請求。" };
      state.runs[0] = run;
      await writeRuntimeState(state, runtimeDir);
      return { skipped: true, reason: "collection_and_analysis_disabled", state };
    }
    let additions = [];
    if (config.collection_enabled) {
      run.stages.feed_sync = state.daily.quota.source_attempts < RESEARCH_LIMITS.maxSources ? "running" : "skipped";
      await writeRuntimeState(state, runtimeDir);
      additions = await syncFeeds(config, state, run, runtimeDir, services);
      run.stages.feed_sync = run.feeds_attempted === 0 ? "skipped" : run.feeds_succeeded === run.feeds_attempted ? "completed" : run.feeds_succeeded > 0 ? "partial" : "failed";
    } else {
      run.stages.feed_sync = "skipped";
    }
    run.stages.selection = "running";
    const resumable = resumableResearchMaterials(state.materials, { analysisEnabled: config.analysis_enabled, collectionEnabled: config.collection_enabled, retryFailed });
    const resumeIds = new Set(resumable.map((material) => material.material_id));
    const candidatePool = [...additions, ...resumable.map((material) => material.feed_item)];
    const eligibleExisting = state.materials.filter((material) => !resumeIds.has(material.material_id));
    const candidates = selectFeedCandidates(candidatePool, eligibleExisting, RESEARCH_LIMITS.maxMaterialsPerRun, new Date(), retryFailed, config.subscriptions);
    run.skipped_items = Math.max(0, additions.length - candidates.filter((candidate) => additions.some((item) => item.id === candidate.item.id)).length);
    for (const candidate of candidates) {
      const similar = state.materials.find((material) => material.material_id !== candidate.item.id && hasConservativeTitleOverlap(candidate.item.title, material.feed_item.title))
        ?? candidates.find((other) => other.item.id !== candidate.item.id && hasConservativeTitleOverlap(candidate.item.title, other.item.title))?.item;
      if (similar && !candidate.reasons.some((reason) => reason.startsWith("可能同題報導"))) {
        candidate.reasons.push(`可能同題報導「${similar.feed_item?.title ?? similar.title}」；來源保留，請比較後再決定精選。`);
      }
    }
    for (const candidate of candidates) {
      if (!state.materials.some((material) => material.material_id === candidate.item.id)) {
        state.materials.push(discoveryMaterial(candidate.item, nowIso(), config.projects));
      }
      setMaterial(state, candidate.item.id, { selection_reasons: candidate.reasons, score: candidate.score });
    }
    await writeRuntimeState(state, runtimeDir);
    const selected = state.materials.filter((material) => candidates.some((candidate) => candidate.item.id === material.material_id));
    run.stages.selection = candidates.length === 0 ? "completed" : "completed";
    run.stages.body_capture = selected.length === 0 ? "skipped" : "running";
    run.stages.analysis = config.analysis_enabled && selected.length > 0 ? "running" : "skipped";
    run.stages.brief = config.analysis_enabled && selected.length > 0 ? "running" : "skipped";
    await writeRuntimeState(state, runtimeDir);
    await runLimited(selected, RESEARCH_LIMITS.maxConcurrentTasks, (material) => captureAndAnalyse(material, config, state, run, runtimeDir, services));
    run.stages.body_capture = run.failures > 0 || run.manual_input_items > 0 ? (run.body_attempted > 0 || run.manual_input_items > 0 ? "partial" : "failed") : run.body_attempted > 0 || selected.length > 0 ? "completed" : "skipped";
    run.stages.analysis = config.analysis_enabled ? run.analysis_stopped ? "failed" : run.failures > 0 ? "partial" : run.analyses_attempted > 0 ? "completed" : "skipped" : "skipped";
    run.stages.brief = run.drafts_created > 0 ? "completed" : run.failures > 0 ? "partial" : "skipped";
    run.finished_at = nowIso();
    run.status = run.failures > 0 ? (run.feeds_succeeded > 0 || run.body_attempted > run.failures ? "partial" : "failed") : run.manual_input_items > 0 ? "partial" : "completed";
    state.last_run = run;
    state.runs[0] = run;
    updateDaily(state, run, date);
    await writeRuntimeConfig(config, runtimeDir);
    await writeRuntimeState(state, runtimeDir);
    await appendRuntimeLog(`run=${run.run_id} status=${run.status} feeds=${run.feeds_succeeded}/${run.feeds_attempted} drafts=${run.drafts_created} failures=${run.failures}`, runtimeDir);
    return { skipped: false, run, state };
  } finally {
    await release();
  }
}

if (process.argv[1]?.endsWith("research-runner.mjs")) {
  const runtimeDir = option("--runtime-dir") || getRuntimeDir();
  const scheduled = flag("--scheduled");
  const retryFailed = flag("--retry-failed");
  runResearch({ runtimeDir, scheduled, retryFailed })
    .then((result) => {
      console.log(JSON.stringify({ skipped: result.skipped, reason: result.reason ?? null, run: result.run ?? null }, null, 2));
    })
    .catch((error) => {
      console.error(`Research runner failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
