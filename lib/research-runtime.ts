import type { FeedItem, SourceSubscription } from "./source-feed.ts";
import type { SourceRecord } from "./source-inbox.ts";

export const RESEARCH_RUNTIME_VERSION = 3 as const;
export const RESEARCH_TIMEZONE = "Asia/Hong_Kong" as const;
export const RESEARCH_LIMITS = {
  maxSources: 12,
  maxBodyAttemptsPerDay: 10,
  maxAnalysisAttemptsPerDay: 10,
  maxProviderAttemptsPerAnalysis: 2,
  maxMaterialsPerRun: 10,
  maxBriefsPerDay: 5,
  maxActionsPerDay: 1,
  maxConcurrentTasks: 1,
  maxRecentRuns: 20,
} as const;

export type ResearchProjectCard = {
  id: string;
  name: string;
  goal: string;
  stage: string;
  blocker: string;
  non_goal: string;
  priority: "high" | "medium" | "low";
  updated_at: string | null;
};

export const DEFAULT_RESEARCH_PROJECTS: ResearchProjectCard[] = [
  {
    id: "diagnostic-studio",
    name: "Diagnostic Studio",
    goal: "客戶問題與付費試點驗證",
    stage: "草稿",
    blocker: "待人工確認目前試點與客戶問題",
    non_goal: "不把來源文章直接當成客戶需求證據",
    priority: "high",
    updated_at: null,
  },
  {
    id: "radar",
    name: "Radar",
    goal: "低摩擦研究、可靠分析、可重用案例",
    stage: "進行中",
    blocker: "待人工確認研究結果與每日候選的取捨",
    non_goal: "不自動發布或把模型推論當成 verified",
    priority: "high",
    updated_at: null,
  },
  {
    id: "storyloom",
    name: "Storyloom",
    goal: "長篇管理、分鏡及 Creative IP",
    stage: "草稿",
    blocker: "未知，需由使用者補充",
    non_goal: "不從來源內容推測未確認的專案進度",
    priority: "medium",
    updated_at: null,
  },
];

export type ResearchSchedule = {
  enabled: boolean;
  timezone: typeof RESEARCH_TIMEZONE;
  hour: 8;
  minute: 0;
};

export type ResearchRuntimeConfig = {
  version: typeof RESEARCH_RUNTIME_VERSION;
  saved_at: string;
  timezone: typeof RESEARCH_TIMEZONE;
  collection_enabled: boolean;
  analysis_enabled: boolean;
  schedule: ResearchSchedule;
  subscriptions: SourceSubscription[];
  projects: ResearchProjectCard[];
};

export type ResearchMaterialStatus =
  | "discovered"
  | "capturing_body"
  | "analysis_running"
  | "captured"
  | "needs_manual_input"
  | "analysis_pending"
  | "deferred"
  | "draft"
  | "failed";

export type ResearchMaterialError = {
  stage: "feed" | "article" | "analysis" | "storage";
  code: string;
  message: string;
};

export type ResearchProjectRecommendation = {
  project_id: string | null;
  project_name: string;
  reason: string;
  basis: string;
  project_updated_at: string | null;
  matched_goal: string | null;
  matched_blocker: string | null;
};

export type SuggestedResearchAction = {
  title: string;
  deliverable: string;
  minutes: number;
  affects_wip: string;
  reason: string;
};

export type ResearchBriefDraft = {
  version: 3;
  material_id: string;
  source_record_id: string;
  generated_at: string;
  provider: SourceRecord["analysis"]["provider"];
  model: string | null;
  source_scope: "full_text" | "feed_content" | "summary_only" | "manual";
  source_dates: { published_at: string | null; updated_at: string | null; discovered_at: string };
  selection_reasons: string[];
  summary: string;
  key_points: string[];
  key_claims: SourceRecord["key_claims"];
  method_or_teaching_points: string[];
  applicability: string[];
  business_implication: string | null;
  ai_pm_implication: string | null;
  uncertainties: string[];
  project_recommendations: ResearchProjectRecommendation[];
  adoption: "undecided" | "adopt" | "timeboxed_experiment" | "backlog" | "skip";
  recommendation_reason: string;
  suggested_action: SuggestedResearchAction | null;
  usage: SourceRecord["analysis"]["usage"];
  feedback: "useful" | "skipped" | "adopted" | null;
  feedback_note: string;
};

export type ResearchDailyQuota = {
  source_attempts: number;
  body_attempts: number;
  analysis_attempts: number;
  briefs_created: number;
  actions_suggested: number;
};

export type ResearchMaterial = {
  material_id: string;
  source_version: string;
  result_version: number;
  feed_item: FeedItem;
  source_record: SourceRecord;
  status: ResearchMaterialStatus;
  content_scope: "full_text" | "feed_content" | "summary_only" | "manual" | "none";
  selection_reasons: string[];
  score: number;
  created_at: string;
  updated_at: string;
  error: ResearchMaterialError | null;
  brief: ResearchBriefDraft | null;
};

export type ResearchRunSummary = {
  run_id: string;
  date: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "completed" | "partial" | "failed" | "skipped";
  stages: {
    feed_sync: "pending" | "running" | "completed" | "partial" | "failed" | "skipped";
    selection: "pending" | "running" | "completed" | "partial" | "failed" | "skipped";
    body_capture: "pending" | "running" | "completed" | "partial" | "failed" | "skipped";
    analysis: "pending" | "running" | "completed" | "partial" | "failed" | "skipped";
    brief: "pending" | "running" | "completed" | "partial" | "failed" | "skipped";
  };
  feeds_attempted: number;
  feeds_succeeded: number;
  new_items: number;
  duplicates: number;
  skipped_items: number;
  manual_input_items?: number;
  body_attempted: number;
  analyses_attempted: number;
  drafts_created: number;
  failures: number;
  analysis_stopped?: boolean;
  errors: ResearchMaterialError[];
};

export type ResearchDailySummary = {
  date: string;
  status: "not_run" | "running" | "completed" | "partial" | "failed";
  new_items: number;
  duplicate_items: number;
  skipped_items: number;
  failed_items: number;
  pending_analysis: number;
  needs_manual_input: number;
  selected_material_ids: string[];
  recommended_action: SuggestedResearchAction | null;
  quota: ResearchDailyQuota;
  note: string;
};

export type ResearchRuntimeState = {
  version: typeof RESEARCH_RUNTIME_VERSION;
  saved_at: string;
  feed_items: FeedItem[];
  materials: ResearchMaterial[];
  runs: ResearchRunSummary[];
  last_run: ResearchRunSummary | null;
  daily: ResearchDailySummary;
};

export function hongKongDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RESEARCH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function sourceScope(record: SourceRecord): ResearchBriefDraft["source_scope"] {
  if (record.transcript?.trim()) return "full_text";
  if (record.raw_text.trim()) return record.collection?.content_kind === "feed_content" ? "feed_content" : "full_text";
  if (record.description?.trim()) return "summary_only";
  return "manual";
}

function recommendationForProject(record: SourceRecord, project: ResearchProjectCard) {
  const haystack = [
    record.title,
    record.summary,
    record.ai_pm_implication,
    ...record.topic_tags,
    ...record.trend_tags,
  ].filter(Boolean).join(" ").toLowerCase();
  const termsFor = (value: string) => {
    const terms = new Set(value.toLowerCase().match(/[a-z0-9]{3,}/gu) ?? []);
    for (const phrase of value.match(/[\u3400-\u9fff]{3,}/gu) ?? []) {
      for (let size = 3; size <= Math.min(6, phrase.length); size += 1) {
        for (let index = 0; index <= phrase.length - size; index += 1) terms.add(phrase.slice(index, index + size));
      }
    }
    return [...terms].filter((term) => !["目前", "相關", "可以", "需要", "以及", "進行", "支援", "產品", "內容"].includes(term));
  };
  const goalMatches = termsFor(project.goal).filter((term) => haystack.includes(term));
  const blockerMatches = termsFor(project.blocker).filter((term) => haystack.includes(term));
  if (goalMatches.length === 0 && blockerMatches.length === 0) return null;
  return { goalMatches: goalMatches.slice(0, 3), blockerMatches: blockerMatches.slice(0, 3) };
}

export function buildResearchBrief(
  record: SourceRecord,
  materialId: string,
  generatedAt: string,
  projects = DEFAULT_RESEARCH_PROJECTS,
  sourceScopeOverride?: ResearchBriefDraft["source_scope"],
): ResearchBriefDraft {
  const methods = record.analysis.method_or_teaching_points ?? [];
  const projectRecommendations: ResearchProjectRecommendation[] = projects
    .map((project) => ({ project, matches: recommendationForProject(record, project) }))
    .filter((entry): entry is { project: ResearchProjectCard; matches: { goalMatches: string[]; blockerMatches: string[] } } => Boolean(entry.matches))
    .slice(0, 2)
    .map(({ project, matches }) => ({
      project_id: project.id,
      project_name: project.name,
      reason: `素材命中專案目標／blocker 詞句「${[...matches.goalMatches, ...matches.blockerMatches].join("、")}」；與 AI PM 含意一併供人工判斷。`,
      basis: [matches.goalMatches.length ? `目標：${project.goal}` : "", matches.blockerMatches.length ? `Blocker：${project.blocker}` : ""].filter(Boolean).join("；"),
      project_updated_at: project.updated_at,
      matched_goal: matches.goalMatches.length ? project.goal : null,
      matched_blocker: matches.blockerMatches.length ? project.blocker : null,
    }));
  if (projectRecommendations.length === 0) {
    projectRecommendations.push({
      project_id: null,
      project_name: "暫無直接用途",
      reason: "目前未有足夠的明確詞彙支持專案配對；請人工判斷。",
      basis: "保守預設，不把未知用途當成已確認關聯",
      project_updated_at: null,
      matched_goal: null,
      matched_blocker: null,
    });
  }
  return {
    version: 3,
    material_id: materialId,
    source_record_id: record.id,
    generated_at: generatedAt,
    provider: record.analysis.provider,
    model: record.analysis.model,
    source_scope: sourceScopeOverride ?? sourceScope(record),
    source_dates: {
      published_at: record.published_at,
      updated_at: record.collection?.feed_updated_at ?? null,
      discovered_at: record.collection?.discovered_at ?? generatedAt,
    },
    selection_reasons: [],
    summary: record.summary ?? "",
    key_points: record.key_points,
    key_claims: record.key_claims,
    method_or_teaching_points: methods,
    applicability: record.analysis.use_cases,
    business_implication: record.business_implication,
    ai_pm_implication: record.ai_pm_implication,
    uncertainties: record.uncertainties,
    project_recommendations: projectRecommendations,
    adoption: "undecided",
    recommendation_reason: record.ai_pm_implication ?? record.why_it_matters ?? "待人工補充建議理由。",
    suggested_action: methods.length > 0 && projectRecommendations.some((recommendation) => recommendation.project_id !== null) ? {
      title: `限時驗證：${methods[0].slice(0, 80)}`,
      deliverable: "一頁實驗記錄：適用條件、執行步驟、觀察結果及是否採用",
      minutes: 30,
      affects_wip: "新增 1 個限時研究實驗；不自動加入 active build",
      reason: `來源明確提供方法片段「${methods[0].slice(0, 120)}」；先小規模核對。30 分鐘為規劃估算，不是實測。`,
    } : null,
    usage: record.analysis.usage,
    feedback: null,
    feedback_note: "",
  };
}

function candidateDateScore(item: FeedItem, nowMs: number) {
  if (!item.published_at) return { score: 0, reason: "新發現但未提供發布日期" };
  const ageDays = (nowMs - Date.parse(item.published_at)) / 86_400_000;
  if (!Number.isFinite(ageDays)) return { score: 0, reason: "發布日期無法解析" };
  if (ageDays < 0) return { score: 0, reason: "發布日期在未來，時間待確認" };
  if (ageDays <= 7) return { score: 3, reason: "最近 7 日發布" };
  if (ageDays <= 30) return { score: 1, reason: "最近 30 日發布" };
  return { score: -2, reason: "較舊內容，保留但不優先" };
}

export function hasConservativeTitleOverlap(left: string, right: string) {
  const normalise = (value: string) => value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "");
  const first = normalise(left);
  const second = normalise(right);
  if (Math.min(first.length, second.length) < 12) return false;
  if (first.includes(second) || second.includes(first)) return true;
  const bigrams = (value: string) => new Set(Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)));
  const leftBigrams = bigrams(first);
  const rightBigrams = bigrams(second);
  const overlap = [...leftBigrams].filter((part) => rightBigrams.has(part)).length;
  return overlap / Math.max(1, new Set([...leftBigrams, ...rightBigrams]).size) >= 0.82;
}

export function resumableResearchMaterials(
  materials: ResearchMaterial[],
  options: { analysisEnabled: boolean; collectionEnabled?: boolean; retryFailed?: boolean },
) {
  const collectionEnabled = options.collectionEnabled ?? true;
  return materials.filter((material) => {
    if (material.brief) return false;
    const hasBody = Boolean(material.source_record?.transcript?.trim() || material.source_record?.raw_text?.trim());
    if (material.status === "discovered") return collectionEnabled;
    if (["analysis_pending", "captured"].includes(material.status)) return options.analysisEnabled && hasBody;
    if (material.status === "deferred") {
      if (material.error?.code === "daily_body_limit_reached") return collectionEnabled;
      if (/^daily_(?:brief|analysis)_limit_reached$/u.test(material.error?.code ?? "")) return options.analysisEnabled && hasBody;
      if (options.retryFailed === true) {
        if (material.error?.stage === "article") return collectionEnabled;
        return options.analysisEnabled && hasBody;
      }
    }
    if (material.status !== "failed" || options.retryFailed !== true) return false;
    if (material.error?.stage === "article") return collectionEnabled;
    if (material.error?.stage === "analysis") return options.analysisEnabled && hasBody;
    return collectionEnabled || (options.analysisEnabled && hasBody);
  });
}

export function selectFeedCandidates(
  items: FeedItem[],
  existing: ResearchMaterial[],
  limit: number = RESEARCH_LIMITS.maxMaterialsPerRun,
  now = new Date(),
  includeFailed = false,
  subscriptions: SourceSubscription[] = [],
) {
  const existingKeys = new Set(existing
    .filter((material) => material.status !== "failed" || !includeFailed)
    .flatMap((material) => [material.material_id, material.feed_item.id, material.feed_item.article_url].filter(Boolean)));
  const nowMs = now.getTime();
  const ranked = items
    .filter((item) => !existingKeys.has(item.id) && (!item.article_url || !existingKeys.has(item.article_url)))
    .map((item) => {
      const date = candidateDateScore(item, nowMs);
      const subscription = subscriptions.find((source) => source.id === item.source_id);
      const searchable = [item.title, item.summary, item.content].filter(Boolean).join(" ").toLowerCase();
      const topicMatches = (subscription?.topic_tags ?? []).filter((tag) => searchable.includes(tag.toLowerCase()));
      const topic = topicMatches.length > 0
        ? { score: Math.min(topicMatches.length, 2), reason: `命中關注主題：${topicMatches.slice(0, 3).join("、")}` }
          : { score: 0, reason: "沒有明確命中關注主題，仍保留作保守候選" };
      const priority = subscription?.priority === "high"
        ? { score: 2, reason: "來源優先級：高" }
        : subscription?.priority === "low"
          ? { score: 0, reason: "來源優先級：低" }
          : { score: 1, reason: "來源優先級：中" };
      const scope = item.content_kind === "feed_content"
        ? { score: 2, reason: "feed 已提供正文" }
        : item.content_kind === "summary"
          ? { score: 1, reason: "feed 提供摘要，可有限擷取正文" }
          : { score: 0, reason: "只有 metadata，需嘗試取得正文" };
      return {
        item,
        score: date.score + scope.score + topic.score + priority.score,
        reasons: ["本次新項目", date.reason, topic.reason, priority.reason, scope.reason],
      };
    })
    .sort((left, right) => right.score - left.score || right.item.discovered_at.localeCompare(left.item.discovered_at));
  const diverse: typeof ranked = [];
  const possibleDuplicates: typeof ranked = [];
  for (const candidate of ranked) {
    const similar = diverse.find((selected) => hasConservativeTitleOverlap(candidate.item.title, selected.item.title));
    if (!similar) {
      diverse.push(candidate);
      continue;
    }
    candidate.reasons.push(`可能同題報導「${similar.item.title}」；來源保留，但有其他候選時延後精選。`);
    possibleDuplicates.push(candidate);
  }
  return [...diverse, ...possibleDuplicates].slice(0, limit);
}

export function aggregateResearchStatus(
  runs: ResearchRunSummary[],
  counts: { briefs: number; pending: number; manualInput: number; failed: number },
): ResearchDailySummary["status"] {
  if (runs.some((run) => run.status === "running")) return "running";
  if (runs.length === 0) {
    if (counts.briefs > 0) return "completed";
    return counts.failed > 0 ? "partial" : "not_run";
  }
  const completedWork = runs.some((run) => run.status === "completed") || counts.briefs > 0;
  const incompleteWork = runs.some((run) => run.status === "partial")
    || counts.pending > 0
    || counts.manualInput > 0
    || counts.failed > 0;
  if (incompleteWork && (completedWork || !runs.every((run) => run.status === "failed"))) return "partial";
  if (runs.every((run) => run.status === "failed")) return "failed";
  return incompleteWork ? "partial" : "completed";
}

export function summarizeResearchDate(state: ResearchRuntimeState, date: string) {
  const runs = state.runs.filter((run) => run.date === date);
  const briefs = state.materials
    .filter((material) => material.brief && hongKongDate(new Date(material.brief.generated_at)) === date)
    .sort((left, right) => (right.brief?.generated_at ?? "").localeCompare(left.brief?.generated_at ?? ""));
  const pending = state.materials.filter((material) =>
    ["discovered", "capturing_body", "captured", "analysis_pending", "analysis_running", "deferred"].includes(material.status)
      && hongKongDate(new Date(material.created_at)) === date,
  );
  const manualInput = state.materials.filter((material) => material.status === "needs_manual_input" && hongKongDate(new Date(material.created_at)) === date);
  const failed = state.materials.filter((material) =>
    material.status === "failed" && hongKongDate(new Date(material.updated_at)) === date,
  );
  return {
    date,
    status: aggregateResearchStatus(runs, { briefs: briefs.length, pending: pending.length, manualInput: manualInput.length, failed: failed.length }),
    new_items: runs.reduce((sum, run) => sum + run.new_items, 0),
    duplicate_items: runs.reduce((sum, run) => sum + run.duplicates, 0),
    skipped_items: runs.reduce((sum, run) => sum + run.skipped_items, 0),
    analyzed_items: briefs.length,
    failed_items: failed.length,
    pending_analysis: pending.length,
    needs_manual_input: manualInput.length,
    selected_material_ids: date === state.daily.date ? state.daily.selected_material_ids : briefs.map((material) => material.material_id),
    recommended_action: date === state.daily.date ? state.daily.recommended_action : null,
  };
}

export function emptyResearchState(date = hongKongDate()): ResearchRuntimeState {
  return {
    version: RESEARCH_RUNTIME_VERSION,
    saved_at: new Date().toISOString(),
    feed_items: [],
    materials: [],
    runs: [],
    last_run: null,
    daily: {
      date,
      status: "not_run",
      new_items: 0,
      duplicate_items: 0,
      skipped_items: 0,
      failed_items: 0,
      pending_analysis: 0,
      needs_manual_input: 0,
      selected_material_ids: [],
      recommended_action: null,
      quota: {
        source_attempts: 0,
        body_attempts: 0,
        analysis_attempts: 0,
        briefs_created: 0,
        actions_suggested: 0,
      },
      note: "尚未執行；不會因沒有結果而補湊文章或行動。",
    },
  };
}
