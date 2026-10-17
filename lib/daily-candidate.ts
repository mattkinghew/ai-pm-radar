import type {
  ApprovalStatus,
  ReviewStatus,
  SourceRecord,
} from "./source-inbox.ts";
import { validateSourceRecord } from "./source-inbox.ts";

export type ManualEnrichment = Pick<
  SourceRecord,
  | "summary"
  | "key_points"
  | "key_claims"
  | "why_it_matters"
  | "business_implication"
  | "ai_pm_implication"
  | "video_implication"
  | "content_ideas"
  | "case_candidate"
  | "library_targets"
  | "trend_tags"
  | "topic_tags"
  | "confidence"
  | "evidence_grade"
  | "evidence"
  | "uncertainties"
>;

export type ManualReviewDecision = {
  review_status: ReviewStatus;
  approval_status: ApprovalStatus;
};

export type DailyCandidateMetadata = {
  question_title: string;
  short_title: string;
  category: string;
  tags: string[];
  impact_score: number;
  relevance_score: number;
  trust_score: number;
};

export type DailyArticle = {
  question_title: string;
  short_title: string;
  summary: string;
  why_it_matters: string;
  business_angle: string;
  ai_pm_angle: string;
  risk_note: string;
  category: string;
  tags: string[];
  source_name: string;
  source_url: string;
  published_at: string;
  impact_score: number;
  relevance_score: number;
  trust_score: number;
  review: {
    status: "reviewed";
    human_review_required: false;
    review_notes: string;
  };
};

export type DailyCandidate = {
  date: string;
  articles: DailyArticle[];
};

export type CandidateSource = {
  record: SourceRecord;
  daily?: DailyCandidateMetadata;
};

export type DailyCandidateBuildResult = {
  candidate: DailyCandidate;
  included: Array<{ source_record_id: string; article: DailyArticle }>;
  blocked: Array<{ source_record_id: string; reasons: string[] }>;
};

export type ReviewGateState = {
  review_status: ReviewStatus;
  approval_status: ApprovalStatus;
};

export function getReviewGateState(
  currentFingerprint: string,
  reviewedFingerprint: string | null,
  approvedFingerprint: string | null,
  rejectedFingerprint: string | null,
): ReviewGateState {
  const review_status = rejectedFingerprint === currentFingerprint
    ? "rejected"
    : reviewedFingerprint === currentFingerprint
      ? "reviewed"
      : "needs_review";

  return {
    review_status,
    approval_status:
      review_status === "reviewed" && approvedFingerprint === currentFingerprint
        ? "approved"
        : "not_approved",
  };
}

export function applyManualEnrichment(
  record: SourceRecord,
  enrichment: ManualEnrichment,
): SourceRecord {
  return { ...record, ...enrichment };
}

export function applyManualReview(
  record: SourceRecord,
  decision: ManualReviewDecision,
): SourceRecord {
  return { ...record, ...decision };
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasSourceBody(record: SourceRecord) {
  return hasText(record.raw_text) || hasText(record.transcript);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function getDailyCandidateBlockers(
  record: SourceRecord,
  daily?: DailyCandidateMetadata,
) {
  const reasons = validateSourceRecord(record).map((issue) => `SourceRecord invalid: ${issue}`);

  if (record.review_status === "rejected") {
    reasons.push("SourceRecord was rejected during human review.");
  } else if (record.review_status !== "reviewed") {
    reasons.push("SourceRecord is not human reviewed.");
  }

  if (record.approval_status !== "approved") {
    reasons.push("SourceRecord is not explicitly approved for daily candidate output.");
  }

  if (!hasText(record.source_url)) {
    reasons.push("A publishable daily article requires a source URL.");
  }

  if (!hasText(record.creator)) {
    reasons.push("A publishable daily article requires a source name or creator.");
  }

  if (!hasSourceBody(record)) {
    reasons.push("SourceRecord has no source body or transcript; use manual recovery first.");
  }

  if (record.evidence.length === 0) {
    reasons.push("SourceRecord has no evidence items.");
  }

  if (record.key_claims.length === 0) {
    reasons.push("SourceRecord has no reviewed key claims.");
  }

  if (record.key_claims.some((claim) => claim.evidence.length === 0)) {
    reasons.push("Every key claim must retain at least one evidence reference.");
  }

  if (record.evidence_grade === "ungraded") {
    reasons.push("SourceRecord evidence_grade must be assessed before candidate output.");
  }

  if (!daily) {
    reasons.push("Daily candidate metadata is missing.");
  } else {
    const requiredMetadata = [
      ["question_title", daily.question_title],
      ["short_title", daily.short_title],
      ["category", daily.category],
    ] as const;

    for (const [field, value] of requiredMetadata) {
      if (!hasText(value)) {
        reasons.push(`Daily candidate metadata is missing ${field}.`);
      }
    }

    for (const field of ["impact_score", "relevance_score", "trust_score"] as const) {
      if (!Number.isFinite(daily[field]) || daily[field] < 1 || daily[field] > 10) {
        reasons.push(`Daily candidate metadata ${field} must be between 1 and 10.`);
      }
    }
  }

  for (const [field, value] of [
    ["summary", record.summary],
    ["why_it_matters", record.why_it_matters],
    ["business_implication", record.business_implication],
    ["ai_pm_implication", record.ai_pm_implication],
  ] as const) {
    if (!hasText(value)) {
      reasons.push(`Manual enrichment is missing ${field}.`);
    }
  }

  return [...new Set(reasons)];
}

function toDailyArticle(record: SourceRecord, daily: DailyCandidateMetadata): DailyArticle {
  const riskNote = record.uncertainties.length > 0
    ? `未確定事項：${record.uncertainties.join(" ")}`
    : record.rights_note;

  return {
    question_title: daily.question_title,
    short_title: daily.short_title,
    summary: record.summary as string,
    why_it_matters: record.why_it_matters as string,
    business_angle: record.business_implication as string,
    ai_pm_angle: record.ai_pm_implication as string,
    risk_note: riskNote,
    category: daily.category,
    tags: unique([...daily.tags, ...record.topic_tags, ...record.trend_tags]),
    source_name: record.creator as string,
    source_url: record.source_url as string,
    published_at: record.published_at ?? record.captured_at,
    impact_score: daily.impact_score,
    relevance_score: daily.relevance_score,
    trust_score: daily.trust_score,
    review: {
      status: "reviewed",
      human_review_required: false,
      review_notes:
        "人工批准只表示通過候選輸出 gate；不代表來源事實已被獨立驗證。完整 provenance 保留在 SourceRecord。",
    },
  };
}

export function buildDailyCandidate(
  sources: CandidateSource[],
  date: string,
): DailyCandidateBuildResult {
  const included: DailyCandidateBuildResult["included"] = [];
  const blocked: DailyCandidateBuildResult["blocked"] = [];

  for (const source of sources) {
    const reasons = getDailyCandidateBlockers(source.record, source.daily);
    if (reasons.length > 0) {
      blocked.push({ source_record_id: source.record.id, reasons });
      continue;
    }

    const article = toDailyArticle(source.record, source.daily as DailyCandidateMetadata);
    included.push({ source_record_id: source.record.id, article });
  }

  return {
    candidate: {
      date,
      articles: included.map(({ article }) => article),
    },
    included,
    blocked,
  };
}
