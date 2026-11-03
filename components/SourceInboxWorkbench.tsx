"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useLanguage } from "@/components/LanguageProvider";
import {
  SOURCE_LIBRARIES,
  detectInputKind,
  detectSourceEntryMode,
  detectPlatformFromUrl,
  mergeEditableKeyClaims,
  normaliseSourceInput,
  parseUrlBatch,
  splitPasteTextBlocks,
  type EvidenceGrade,
  type SourceCollectionProvenance,
  type SourceLibrary,
  type SourceRecord,
} from "@/lib/source-inbox";
import type { FeedItem } from "@/lib/source-feed";
import type { ResearchMaterial } from "@/lib/research-runtime";
import { SourceSubscriptions } from "@/components/SourceSubscriptions";
import { CloudSyncOptInPanel } from "@/components/CloudSyncOptInPanel";
import { SyntheticActualWorkbenchCloudPanel } from "@/components/SyntheticActualWorkbenchCloudPanel";
import { OneArticleCloudWorkspacePanel } from "@/components/OneArticleCloudWorkspacePanel";
import {
  applyManualEnrichment,
  applyManualReview,
  buildDailyCandidate,
  getDailyCandidateBlockers,
  getReviewGateState,
  type DailyCandidateMetadata,
  type ManualEnrichment,
} from "@/lib/daily-candidate";
import { formatSourceInboxBlocker, type Messages } from "@/lib/i18n";
import {
  importedEvidenceCandidates,
  validateUploadedTextMaterial,
  MAX_INTAKE_TEXT_BYTES,
  type IntakeEvidenceSelection,
} from "@/lib/intake-evidence-preview";
import {
  MAX_ANALYSIS_INPUT_CHARS,
  applyAIAnalysisDraft,
  canonicaliseAIAnalysisEvidence,
  createAnalysisSourceSnapshot,
  isAnalysisSourceSnapshotCurrent,
  summariseAnalysisEvidenceIssueLocations,
  validateAIAnalysisDraft,
  type AIAnalysisDraft,
} from "@/lib/ai-analysis";
import { parseSourceDrafts, serializeSourceDrafts } from "@/lib/source-draft-storage";
import { SOURCE_INBOX_DRAFT_DB_NAME, SOURCE_INBOX_DRAFT_STORE } from "@/lib/source-inbox-draft-summary";
import { parseQuickCapture, QUICK_CAPTURE_SESSION_KEY } from "@/lib/quick-capture";
import {
  decideResearchImport,
  researchFormFingerprint,
  type ResearchImportMetadata,
} from "@/lib/research-handoff";
import { CompanionApiError, requestCompanionJson } from "@/lib/companion-api";
import { assertApprovalIntegrity, createApprovalSeal } from "@/lib/approval-integrity";
import { createSourceLibraryEntry, getReusableSourceBlockers, sourceRecordFingerprint, type SourceLibraryEntry } from "@/lib/source-library";
import { listSourceLibraryEntries, saveSourceLibraryEntry } from "@/lib/source-library-storage";

type Stage = "import" | "draft" | "review";
type InputMode = "url" | "text";
type DraftOrigin = "manual" | "extracted";
type AnalysisUiStatus = "not_requested" | "processing" | "draft" | "failed";
type PersistenceStatus = "loading" | "saved" | "saving" | "unavailable" | "error";

type WorkbenchFormState = {
  sourceTitle: string;
  sourceUrl: string;
  originalUrl: string;
  finalUrl: string;
  creator: string;
  description: string;
  publishedAt: string;
  capturedAt: string;
  language: string;
  body: string;
  evidenceSource: string;
  evidenceTimestamp: string;
  evidenceReference: string;
  keyPoints: string;
  keyClaims: string;
  claimEvidence: SourceRecord["key_claims"];
  summary: string;
  whyItMatters: string;
  businessImplication: string;
  aiPmImplication: string;
  videoImplication: string;
  contentIdeas: string;
  uncertainties: string;
  topicTags: string;
  trendTags: string;
  confidence: string;
  evidenceGrade: EvidenceGrade;
  caseCandidate: boolean;
  libraryTargets: SourceLibrary[];
  questionTitle: string;
  shortTitle: string;
  category: string;
  dailyTags: string;
  impactScore: string;
  relevanceScore: string;
  trustScore: string;
  sourceFacts: string;
  methodOrTeachingPoints: string;
  analysisInferences: string;
  analysisStatus: AnalysisUiStatus;
  analysisError: string;
  analysisProvider: SourceRecord["analysis"]["provider"];
  analysisModel: string;
  analysisAnalyzedAt: string;
  analysisUsage: string;
  accessMethod: SourceRecord["access_method"];
  sourceKind: "paste_text" | "markdown" | "txt" | "srt" | "vtt";
  collection?: SourceCollectionProvenance;
};

const EMPTY_FORM: WorkbenchFormState = {
  sourceTitle: "",
  sourceUrl: "",
  originalUrl: "",
  finalUrl: "",
  creator: "",
  description: "",
  publishedAt: "",
  capturedAt: "",
  language: "zh-Hant",
  body: "",
  evidenceSource: "",
  evidenceTimestamp: "",
  evidenceReference: "",
  keyPoints: "",
  keyClaims: "",
  claimEvidence: [],
  summary: "",
  whyItMatters: "",
  businessImplication: "",
  aiPmImplication: "",
  videoImplication: "",
  contentIdeas: "",
  uncertainties: "",
  topicTags: "",
  trendTags: "",
  confidence: "0",
  evidenceGrade: "ungraded",
  caseCandidate: false,
  libraryTargets: [],
  questionTitle: "",
  shortTitle: "",
  category: "",
  dailyTags: "",
  impactScore: "5",
  relevanceScore: "5",
  trustScore: "5",
  sourceFacts: "",
  methodOrTeachingPoints: "",
  analysisInferences: "",
  analysisStatus: "not_requested",
  analysisError: "",
  analysisProvider: "none",
  analysisModel: "",
  analysisAnalyzedAt: "",
  analysisUsage: "",
  accessMethod: "direct_input",
  sourceKind: "paste_text",
  collection: undefined,
};

type FetchedDraft = {
  originalUrl: string;
  finalUrl: string;
  capturedAt: string;
  title: string;
  creator: string | null;
  publishedAt: string | null;
  body: string;
  warnings?: string[];
  completeness?: "complete" | "partial";
};

type FetchFailureCode = "invalid_url" | "unsafe_target" | "access_denied" | "timeout" | "not_html" | "no_article_body" | "not_article" | "too_many_redirects" | "response_too_large" | "fetch_failed" | "access_session_expired" | "companion_service_unavailable";
type NoticeKey = "emptyBody" | "batchTooLarge" | "makeDraft" | "fetchSuccess" | "partialContent" | "accessSessionExpired" | "fetchUnavailable" | "fetchFailure" | "fetchAccessDenied" | "fetchTimeout" | "fetchNotHtml" | "fetchTooLarge" | "fetchNoBody" | "platformFallback" | "nonArticle" | "analysisUnavailable" | "analysisMissingKey" | "analysisAuthFailed" | "analysisPermissionDenied" | "analysisRegionUnsupported" | "analysisModelUnavailable" | "analysisModelUnavailableForAccount" | "analysisResourceNotFound" | "analysisRateLimited" | "analysisTimeout" | "analysisRefused" | "analysisIncomplete" | "analysisNoCandidate" | "analysisNoText" | "analysisInvalidJson" | "analysisSchema" | "analysisSchemaMismatch" | "analysisMapping" | "analysisSnapshotStale" | "analysisFailed" | "analysisEvidence" | "analysisTooLong" | "analysisSuccess" | "analysisMethodOmitted" | "backupImported" | "backupInvalid" | "researchImportAdded" | "researchImportUpdated" | "researchImportKept";

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function firstParagraph(value: string) {
  return value.split(/\n\s*\n|\n/).map((item) => item.trim()).find(Boolean) ?? "";
}

function provisionalTitle(value: string) {
  return firstParagraph(value).slice(0, 140);
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function usageValue(value: string): SourceRecord["analysis"]["usage"] {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as SourceRecord["analysis"]["usage"];
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function buildFingerprint(form: WorkbenchFormState, date: string) {
  return JSON.stringify({ form, date });
}

function buildRecord(
  form: WorkbenchFormState,
  reviewStatus: "needs_review" | "reviewed" | "rejected",
  approvalStatus: "not_approved" | "approved",
): SourceRecord {
  const fetchedFromUrl = form.accessMethod === "metadata_probe";
  const evidence = form.evidenceSource.trim() && form.evidenceReference.trim()
    ? [{
        source: form.evidenceSource.trim(),
        timestamp: form.evidenceTimestamp.trim() || null,
        text_reference: form.evidenceReference.trim(),
      }]
    : [];
  const keyClaims = mergeEditableKeyClaims(lines(form.keyClaims), form.claimEvidence, evidence);
  const inputRecord = normaliseSourceInput(
    {
      value: fetchedFromUrl ? form.finalUrl || form.sourceUrl : form.body,
      kind: fetchedFromUrl ? "manual_url" : form.sourceKind,
      capturedText: fetchedFromUrl ? form.body : undefined,
      accessMethod: form.accessMethod,
      sourceUrl: form.sourceUrl || undefined,
      originalSourceUrl: form.originalUrl || undefined,
      finalSourceUrl: form.finalUrl || form.sourceUrl || undefined,
      creator: form.creator || undefined,
      title: form.sourceTitle || undefined,
      description: form.description || undefined,
      publishedAt: form.publishedAt || undefined,
      capturedAt: form.capturedAt || undefined,
      language: form.language || undefined,
      collection: form.collection,
    },
    { now: form.capturedAt || new Date().toISOString() },
  ).record;
  const enrichment: ManualEnrichment = {
    summary: form.summary.trim() || null,
    key_points: lines(form.keyPoints),
    key_claims: keyClaims,
    why_it_matters: form.whyItMatters.trim() || null,
    business_implication: form.businessImplication.trim() || null,
    ai_pm_implication: form.aiPmImplication.trim() || null,
    video_implication: form.videoImplication.trim() || null,
    content_ideas: lines(form.contentIdeas),
    case_candidate: form.caseCandidate,
    library_targets: form.libraryTargets,
    trend_tags: lines(form.trendTags),
    topic_tags: lines(form.topicTags),
    confidence: numberValue(form.confidence),
    evidence_grade: form.evidenceGrade,
    evidence,
    uncertainties: lines(form.uncertainties),
  };
  const record = applyManualReview(
    applyManualEnrichment(inputRecord, enrichment),
    { review_status: reviewStatus, approval_status: approvalStatus },
  );
  return {
    ...record,
    material_status: form.body.trim() ? "captured" : "needs_manual_input",
    analysis: {
      ...record.analysis,
      status: form.analysisStatus,
      provider: form.analysisStatus === "not_requested" ? "none" : form.analysisProvider,
      model: form.analysisModel || null,
      analyzed_at: form.analysisAnalyzedAt || null,
      input_chars: form.body.length,
      usage: usageValue(form.analysisUsage),
      error_code: form.analysisError || null,
      source_facts: lines(form.sourceFacts),
      method_or_teaching_points: lines(form.methodOrTeachingPoints),
      inferences: lines(form.analysisInferences),
    },
  };
}

function buildDailyMetadata(form: WorkbenchFormState): DailyCandidateMetadata {
  return {
    question_title: form.questionTitle.trim(),
    short_title: form.shortTitle.trim(),
    category: form.category.trim(),
    tags: lines(form.dailyTags),
    impact_score: numberValue(form.impactScore),
    relevance_score: numberValue(form.relevanceScore),
    trust_score: numberValue(form.trustScore),
  };
}

function blockerId(reason: string) {
  if (reason.includes("日期") || reason.includes("Date")) return "candidate-date";
  if (reason.includes("source URL")) return "source-url";
  if (reason.includes("creator")) return "creator";
  if (reason.includes("evidence_grade")) return "evidence-grade";
  if (reason.includes("source body")) return "source-body";
  if (reason.includes("evidence")) return "evidence-reference";
  if (reason.includes("Daily candidate metadata")) return "daily-fields";
  if (reason.includes("Manual enrichment")) return "enrichment-fields";
  return "review-section";
}

function localReusableBlocker(reason: string, copy: Messages["sourceInbox"]) {
  if (reason.startsWith("SourceRecord invalid:")) return copy.reuseBlockerInvalid;
  if (reason.includes("human reviewed")) return copy.reuseBlockerReview;
  if (reason.includes("still processing")) return copy.reuseBlockerProcessing;
  if (reason.includes("captured source text")) return copy.reuseBlockerBody;
  if (reason.includes("at least one evidence")) return copy.reuseBlockerEvidence;
  if (reason.includes("at least one reviewed claim")) return copy.reuseBlockerClaim;
  if (reason.includes("Every reviewed claim")) return copy.reuseBlockerClaimEvidence;
  if (reason.includes("Evidence reference")) return copy.reuseBlockerExactEvidence;
  return copy.reuseBlockerInvalid;
}

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function localFetchError(code: string | undefined, error: unknown): NoticeKey {
  if (code === "access_session_expired") return "accessSessionExpired";
  if (code === "companion_service_unavailable") return "fetchUnavailable";
  if (code === "access_denied") return "fetchAccessDenied";
  if (code === "timeout") return "fetchTimeout";
  if (code === "response_too_large") return "fetchTooLarge";
  if (code === "not_html") return "fetchNotHtml";
  if (code === "no_article_body") return "fetchNoBody";
  if (code === "not_article") return "nonArticle";
  if (code === "unsafe_target" || code === "invalid_url" || code === "too_many_redirects") return "fetchFailure";
  if (error instanceof TypeError || (error instanceof Error && /failed to fetch|networkerror|econnrefused/i.test(error.message))) {
    return "fetchUnavailable";
  }
  return "fetchFailure";
}

function localAnalysisError(code: string | undefined, error: unknown): NoticeKey {
  if (code === "access_session_expired") return "accessSessionExpired";
  if (code === "companion_service_unavailable") return "analysisUnavailable";
  if (code === "companion_timeout") return "analysisTimeout";
  if (code === "model_not_configured" || code === "provider_not_configured") return "analysisMissingKey";
  if (code === "provider_auth_failed") return "analysisAuthFailed";
  if (code === "provider_permission_denied") return "analysisPermissionDenied";
  if (code === "provider_region_unsupported") return "analysisRegionUnsupported";
  if (code === "model_unavailable_for_account") return "analysisModelUnavailableForAccount";
  if (code === "provider_resource_not_found") return "analysisResourceNotFound";
  if (code === "model_unavailable" || code === "provider_service_unavailable") return "analysisUnavailable";
  if (code === "rate_limited") return "analysisRateLimited";
  if (code === "model_timeout") return "analysisTimeout";
  if (code === "model_refused") return "analysisRefused";
  if (code === "model_incomplete") return "analysisIncomplete";
  if (code === "model_no_candidate") return "analysisNoCandidate";
  if (code === "model_no_text_parts" || code === "model_empty_output") return "analysisNoText";
  if (code === "model_invalid_json" || code === "model_invalid_output") return "analysisInvalidJson";
  if (code === "provider_request_invalid") return "analysisSchema";
  if (code === "model_schema_mismatch") return "analysisSchemaMismatch";
  if (code === "source_record_mapping_failed") return "analysisMapping";
  if (code === "analysis_snapshot_mismatch") return "analysisSnapshotStale";
  if (code === "analysis_input_too_long" || code === "analysis_request_too_large") return "analysisTooLong";
  if (code === "evidence_not_found") return "analysisEvidence";
  if (error instanceof TypeError || (error instanceof Error && /failed to fetch|networkerror|econnrefused/i.test(error.message))) return "analysisUnavailable";
  return "analysisFailed";
}

type MaterialCard = {
  id: string;
  input: string;
  status: "pending" | "captured" | "manual_only" | "failed";
  title: string;
  sourceUrl: string;
  error: string;
  form: WorkbenchFormState | null;
  researchImport?: ResearchImportMetadata;
  reviewedFingerprint?: string | null;
  approvedFingerprint?: string | null;
  approvalSeal?: string | null;
  rejectedFingerprint?: string | null;
};

type PendingResearchImport = {
  material: ResearchMaterial;
  form: WorkbenchFormState;
};

function researchImportMetadata(material: ResearchMaterial, form: WorkbenchFormState): ResearchImportMetadata {
  return {
    source_version: material.source_version,
    result_version: material.result_version,
    imported_fingerprint: researchFormFingerprint(form),
  };
}

function formFromResearchMaterial(material: ResearchMaterial): WorkbenchFormState {
  const record = material.source_record;
  const evidence = record.evidence[0] ?? record.key_claims[0]?.evidence[0];
  const sourceKind = record.source_type === "markdown" || record.source_type === "txt" || record.source_type === "srt" || record.source_type === "vtt"
    ? record.source_type
    : "paste_text";
  return {
    ...EMPTY_FORM,
    sourceTitle: record.title ?? material.feed_item.title,
    sourceUrl: record.source_url ?? material.feed_item.article_url ?? "",
    originalUrl: record.source_url_original ?? material.feed_item.article_url ?? material.feed_item.feed_url,
    finalUrl: record.source_url_final ?? record.source_url ?? material.feed_item.article_url ?? "",
    creator: record.creator ?? "",
    description: record.description ?? "",
    publishedAt: dateInputValue(record.published_at),
    capturedAt: record.captured_at,
    language: record.language,
    body: material.content_scope === "summary_only" && (material.status === "needs_manual_input" || material.error?.stage === "article") ? record.transcript ?? "" : record.transcript ?? record.raw_text,
    evidenceSource: evidence?.source ?? record.source_url ?? material.feed_item.feed_url,
    evidenceTimestamp: evidence?.timestamp ?? "",
    evidenceReference: evidence?.text_reference ?? "",
    keyPoints: record.key_points.join("\n"),
    keyClaims: record.key_claims.map((claim) => claim.claim).join("\n"),
    claimEvidence: record.key_claims,
    summary: record.summary ?? "",
    whyItMatters: record.why_it_matters ?? "",
    businessImplication: record.business_implication ?? "",
    aiPmImplication: record.ai_pm_implication ?? "",
    videoImplication: record.video_implication ?? "",
    contentIdeas: record.content_ideas.join("\n"),
    uncertainties: record.uncertainties.join("\n"),
    topicTags: record.topic_tags.join("\n"),
    trendTags: record.trend_tags.join("\n"),
    confidence: String(record.confidence),
    evidenceGrade: record.evidence_grade,
    caseCandidate: record.case_candidate,
    libraryTargets: record.library_targets,
    sourceFacts: record.analysis.source_facts.join("\n"),
    methodOrTeachingPoints: (record.analysis.method_or_teaching_points ?? []).join("\n"),
    analysisInferences: record.analysis.inferences.join("\n"),
    analysisStatus: record.analysis.status,
    analysisError: record.analysis.error_code ?? "",
    analysisProvider: record.analysis.provider,
    analysisModel: record.analysis.model ?? "",
    analysisAnalyzedAt: record.analysis.analyzed_at ?? "",
    analysisUsage: record.analysis.usage ? JSON.stringify(record.analysis.usage) : "",
    accessMethod: record.access_method,
    sourceKind,
    collection: record.collection,
  };
}

type PersistedWorkbench = {
  stage: Stage;
  inputMode: InputMode;
  inputValue: string;
  form: WorkbenchFormState;
  candidateDate: string;
  materials: MaterialCard[];
  activeMaterialId?: string | null;
  reviewedFingerprint?: string | null;
  approvedFingerprint?: string | null;
  approvalSeal?: string | null;
  rejectedFingerprint?: string | null;
};

function sourceWebsiteName(sourceUrl: string): string {
  // A source-site domain is traceable provenance, NOT a claim about authorship.
  // Avoid silently inventing a person, publisher brand, or trust grade.
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const hostname = url.hostname.toLowerCase().replace(/^www\./u, "");
    return hostname.includes(".") ? hostname : "";
  } catch { return ""; }
}

function formFromFeedItem(item: FeedItem): WorkbenchFormState {
  const body = item.content_kind === "feed_content" ? item.content ?? "" : "";
  const collection: SourceCollectionProvenance = {
    version: 1,
    feed_url: item.feed_url,
    source_id: item.source_id,
    item_id: item.item_id,
    content_kind: item.content_kind,
    discovered_at: item.discovered_at,
    feed_updated_at: item.updated_at,
  };
  return {
    ...EMPTY_FORM,
    sourceTitle: item.title,
    sourceUrl: item.article_url ?? "",
    originalUrl: item.article_url ?? "",
    finalUrl: item.article_url ?? "",
    creator: item.creator?.trim() || sourceWebsiteName(item.article_url ?? item.feed_url),
    description: item.summary ?? "",
    publishedAt: dateInputValue(item.published_at),
    capturedAt: item.discovered_at,
    body,
    evidenceSource: item.article_url ?? item.feed_url,
    evidenceReference: body,
    collection,
  };
}

const DRAFT_DB_NAME = SOURCE_INBOX_DRAFT_DB_NAME;
const DRAFT_DB_VERSION = 3;
const DRAFT_STORE = SOURCE_INBOX_DRAFT_STORE;

function openDraftDatabase(dbName = DRAFT_DB_NAME) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(dbName, DRAFT_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DRAFT_STORE)) request.result.createObjectStore(DRAFT_STORE);
      if (!request.result.objectStoreNames.contains("subscriptions")) request.result.createObjectStore("subscriptions");
      if (!request.result.objectStoreNames.contains("feed-items")) request.result.createObjectStore("feed-items");
      if (!request.result.objectStoreNames.contains("source-library")) request.result.createObjectStore("source-library");
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onblocked = () => reject(new Error("Close another Radar tab to finish local storage upgrade."));
    request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
  });
}

async function readStoredWorkbench(dbName = DRAFT_DB_NAME) {
  const database = await openDraftDatabase(dbName);
  return new Promise<PersistedWorkbench | null>((resolve, reject) => {
    const request = database.transaction(DRAFT_STORE, "readonly").objectStore(DRAFT_STORE).get("current");
    request.onsuccess = () => resolve(request.result as PersistedWorkbench | null);
    request.onerror = () => reject(request.error ?? new Error("Draft could not be read."));
  });
}

async function writeStoredWorkbench(value: PersistedWorkbench, dbName = DRAFT_DB_NAME) {
  const database = await openDraftDatabase(dbName);
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DRAFT_STORE, "readwrite");
    transaction.objectStore(DRAFT_STORE).put(value, "current");
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Draft could not be saved."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Draft save was aborted."));
    };
  });
}

async function removeStoredWorkbench(dbName = DRAFT_DB_NAME) {
  const database = await openDraftDatabase(dbName);
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction(DRAFT_STORE, "readwrite").objectStore(DRAFT_STORE).delete("current");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Draft could not be removed."));
  });
}

const SYNTHETIC_PREVIEW_DRAFT_DB = "ai-pm-radar-source-inbox-synthetic-phase12c3";
const REAL_PILOT_PREVIEW_DRAFT_DB = "ai-pm-radar-source-inbox-one-article-phase14";

export function SourceInboxWorkbench({
  syntheticPreview = false, realPilotPreview = false,
}: { syntheticPreview?: boolean; realPilotPreview?: boolean } = {}) {
  const isolatedPreview = syntheticPreview || realPilotPreview;
  const draftDbName = realPilotPreview ? REAL_PILOT_PREVIEW_DRAFT_DB
    : syntheticPreview ? SYNTHETIC_PREVIEW_DRAFT_DB : DRAFT_DB_NAME;
  const { messages } = useLanguage();
  const copy = messages.sourceInbox;
  const [stage, setStage] = useState<Stage>("import");
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [inputValue, setInputValue] = useState("");
  const [form, setForm] = useState<WorkbenchFormState>(EMPTY_FORM);
  const [candidateDate, setCandidateDate] = useState("");
  const [reviewedFingerprint, setReviewedFingerprint] = useState<string | null>(null);
  const [approvedFingerprint, setApprovedFingerprint] = useState<string | null>(null);
  const [approvalSeal, setApprovalSeal] = useState<string | null>(null);
  const [rejectedFingerprint, setRejectedFingerprint] = useState<string | null>(null);
  const [notice, setNotice] = useState<"success" | "error" | "info" | null>(null);
  const [noticeKey, setNoticeKey] = useState<NoticeKey | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [draftOrigin, setDraftOrigin] = useState<DraftOrigin>("manual");
  const [materials, setMaterials] = useState<MaterialCard[]>([]);
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>("loading");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [evidenceIssueLocations, setEvidenceIssueLocations] = useState<ReturnType<typeof summariseAnalysisEvidenceIssueLocations>>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [pendingResearchImport, setPendingResearchImport] = useState<PendingResearchImport | null>(null);
  const [libraryEntries, setLibraryEntries] = useState<SourceLibraryEntry[]>([]);
  const [libraryApprovalStatus, setLibraryApprovalStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isApprovingCandidate, setIsApprovingCandidate] = useState(false);
  const hydratedRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveRequestRef = useRef(0);
  const materialsRef = useRef(materials);
  materialsRef.current = materials;
  const latestFormRef = useRef(form);
  latestFormRef.current = form;
  const quickCaptureConsumedRef = useRef(false);
  const quickCaptureAutoAnalyzeRef = useRef(false);

  useEffect(() => {
    setCandidateDate(localDate());
    void readStoredWorkbench(draftDbName).then((saved) => {
      if (saved) {
        const restoredForm: WorkbenchFormState = {
          ...EMPTY_FORM,
          ...saved.form,
          accessMethod: saved.form.accessMethod ?? "direct_input",
          analysisProvider: saved.form.analysisProvider ?? (saved.form.analysisStatus === "not_requested" ? "none" : "openai_responses"),
        };
        const restoredActiveId = saved.activeMaterialId ?? saved.materials[0]?.id ?? null;
        setStage(saved.stage);
        setInputMode(saved.inputMode);
        setInputValue(saved.inputValue);
        setForm(restoredForm);
        setCandidateDate(saved.candidateDate);
        setReviewedFingerprint(saved.reviewedFingerprint ?? null);
        setApprovedFingerprint(saved.approvedFingerprint ?? null);
        setApprovalSeal(saved.approvalSeal ?? null);
        setRejectedFingerprint(saved.rejectedFingerprint ?? null);
        setMaterials(saved.materials.map((material) => {
          const isActive = material.id === restoredActiveId;
          return {
            ...material,
            form: isActive ? restoredForm : material.form ? { ...EMPTY_FORM, ...material.form } : null,
            reviewedFingerprint: Object.prototype.hasOwnProperty.call(material, "reviewedFingerprint")
              ? material.reviewedFingerprint ?? null : isActive ? saved.reviewedFingerprint ?? null : null,
            approvedFingerprint: Object.prototype.hasOwnProperty.call(material, "approvedFingerprint")
              ? material.approvedFingerprint ?? null : isActive ? saved.approvedFingerprint ?? null : null,
            approvalSeal: Object.prototype.hasOwnProperty.call(material, "approvalSeal")
              ? material.approvalSeal ?? null : isActive ? saved.approvalSeal ?? null : null,
            rejectedFingerprint: Object.prototype.hasOwnProperty.call(material, "rejectedFingerprint")
              ? material.rejectedFingerprint ?? null : isActive ? saved.rejectedFingerprint ?? null : null,
          };
        }));
        setActiveMaterialId(restoredActiveId);
      }
      hydratedRef.current = true;
      setIsHydrated(true);
      setPersistenceStatus("saved");
      if (!isolatedPreview) void listSourceLibraryEntries().then(setLibraryEntries).catch(() => setLibraryApprovalStatus("error"));
    }).catch(() => {
      hydratedRef.current = true;
      setIsHydrated(true);
      setPersistenceStatus("unavailable");
    });
  }, [draftDbName, isolatedPreview]);

  useEffect(() => {
    if (!isHydrated || isolatedPreview) return;
    const materialId = new URLSearchParams(window.location.search).get("research_material");
    if (!materialId) return;
    void requestCompanionJson<{ materials?: ResearchMaterial[] }>("/automation/state")
      .then((payload) => {
        const material = payload.materials?.find((item) => item.material_id === materialId);
        if (!material) return;
        const nextForm = formFromResearchMaterial(material);
        const existing = materialsRef.current.find((item) => item.id === material.material_id);
        const decision = decideResearchImport({
          hasExisting: Boolean(existing?.form),
          metadata: existing?.researchImport ?? null,
          currentFingerprint: existing?.form ? researchFormFingerprint(existing.form) : null,
          incomingFingerprint: researchFormFingerprint(nextForm),
          incomingSourceVersion: material.source_version,
          incomingResultVersion: material.result_version,
        });
        if (existing?.form && (decision === "unchanged" || decision === "stale")) {
          setActiveMaterialId(existing.id);
          setForm(existing.form);
          setStage("draft");
          return;
        }
        if (existing?.form && decision === "conflict") {
          setActiveMaterialId(existing.id);
          setForm(existing.form);
          setStage("draft");
          setPendingResearchImport({ material, form: nextForm });
          setNotice("info");
          setNoticeKey(null);
          return;
        }
        const nextMaterial: MaterialCard = {
          id: material.material_id,
          input: material.feed_item.article_url ?? material.feed_item.feed_url,
          status: nextForm.body.trim() ? "captured" : "manual_only",
          title: nextForm.sourceTitle,
          sourceUrl: nextForm.sourceUrl,
          error: material.error?.code ?? "",
          form: nextForm,
          researchImport: researchImportMetadata(material, nextForm),
        };
        setMaterials((current) => current.some((item) => item.id === nextMaterial.id)
          ? current.map((item) => item.id === nextMaterial.id ? nextMaterial : item)
          : [...current, nextMaterial]);
        setActiveMaterialId(nextMaterial.id);
        setForm(nextForm);
        setDraftOrigin("extracted");
        setStage("draft");
        setReviewedFingerprint(null);
        setApprovedFingerprint(null);
        setRejectedFingerprint(null);
        setNotice("success");
        setNoticeKey(decision === "auto_update" ? "researchImportUpdated" : "researchImportAdded");
      })
      .catch(() => undefined);
  }, [isHydrated]);

  const currentWorkbench = (): PersistedWorkbench => ({
    stage, inputMode, inputValue, form, candidateDate,
    materials: materials.map((material) => material.id === activeMaterialId ? {
      ...material, reviewedFingerprint, approvedFingerprint, approvalSeal, rejectedFingerprint,
    } : material),
    activeMaterialId, reviewedFingerprint, approvedFingerprint, approvalSeal, rejectedFingerprint,
  });

  // Serialize writes so an older debounce cannot overwrite a newer explicit save.
  const persistWorkbench = (snapshot: PersistedWorkbench) => {
    const requestId = ++saveRequestRef.current;
    setPersistenceStatus("saving");
    const pending = saveQueueRef.current.catch(() => undefined).then(() => writeStoredWorkbench(snapshot, draftDbName));
    saveQueueRef.current = pending.catch(() => undefined);
    void pending.then(() => {
      if (requestId === saveRequestRef.current) {
        setLastSavedAt(new Date().toISOString());
        setPersistenceStatus("saved");
      }
    }).catch(() => {
      if (requestId === saveRequestRef.current) setPersistenceStatus("error");
    });
    return pending;
  };

  useEffect(() => {
    if (!hydratedRef.current) return;
    setPersistenceStatus("saving");
    const timer = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void persistWorkbench(currentWorkbench());
    }, 250);
    autosaveTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (autosaveTimerRef.current === timer) autosaveTimerRef.current = null;
    };
  }, [stage, inputMode, inputValue, form, candidateDate, materials, activeMaterialId, reviewedFingerprint, approvedFingerprint, approvalSeal, rejectedFingerprint]);

  const saveNow = () => {
    if (!hydratedRef.current) return;
    void persistWorkbench(currentWorkbench());
  };

  const fingerprint = useMemo(() => buildFingerprint(form, candidateDate), [form, candidateDate]);
  useEffect(() => {
    if (approvedFingerprint !== fingerprint) setApprovalSeal(null);
  }, [approvedFingerprint, fingerprint]);
  const gate = getReviewGateState(fingerprint, reviewedFingerprint, approvedFingerprint, rejectedFingerprint);
  const record = useMemo(() => buildRecord(form, gate.review_status, gate.approval_status), [form, gate.approval_status, gate.review_status]);
  const reusableRecordFingerprint = sourceRecordFingerprint({ ...record, review_status: "reviewed", approval_status: "approved" });
  const reusableRecordSaved = libraryEntries.some((entry) => entry.fingerprint === reusableRecordFingerprint);
  const reusableRecord = { ...record, review_status: "reviewed" as const, approval_status: "approved" as const };
  const reusableRecordBlockers = getReusableSourceBlockers({
    ...reusableRecord,
    review_status: gate.review_status === "reviewed" ? "reviewed" : gate.review_status,
  });
  const daily = useMemo(() => buildDailyMetadata(form), [form]);
  const candidateResult = useMemo(() => buildDailyCandidate([{ record, daily }], candidateDate), [candidateDate, daily, record]);
  const dateBlockers = /^\d{4}-\d{2}-\d{2}$/.test(candidateDate) ? [] : [copy.invalidDate];
  const blockers = [...dateBlockers, ...(candidateResult.blocked[0]?.reasons ?? [])];
  const nonApprovalBlockers = blockers.filter((reason) => !reason.includes("not explicitly approved") && !reason.includes("not human reviewed"));
  const isReady = blockers.length === 0 && candidateResult.included.length === 1;
  const sourceParagraphs = useMemo(() => lines(form.body), [form.body]);
  const intakeEvidenceCandidates = useMemo(() => importedEvidenceCandidates(
    form.body, form.sourceKind, (form.evidenceSource.split(" · ")[0] || form.sourceTitle),
  ), [form.body, form.sourceKind, form.evidenceSource, form.sourceTitle]);
  const finalUrl = form.finalUrl || form.sourceUrl;
  const sourceDomain = (() => {
    try { return finalUrl ? new URL(finalUrl).hostname : ""; } catch { return ""; }
  })();

  const importFeedItems = (incoming: FeedItem[]) => {
    const existingIds = new Set(materials.map((material) => material.id));
    const newItems = incoming.filter((item) => !existingIds.has(item.id));
    if (newItems.length === 0) return;
    const cards = newItems.map((item) => {
      const nextForm = formFromFeedItem(item);
      return {
        id: item.id,
        input: item.article_url ?? item.feed_url,
        status: nextForm.body.trim() ? "captured" as const : "manual_only" as const,
        title: nextForm.sourceTitle,
        sourceUrl: nextForm.sourceUrl,
        error: "",
        form: nextForm,
      };
    });
    setMaterials((current) => [...current, ...cards]);
    if (!activeMaterialId) {
      const first = cards[0];
      setActiveMaterialId(first.id);
      setForm(first.form as WorkbenchFormState);
      setDraftOrigin("extracted");
      setStage("draft");
    }
  };

  const updateField = <K extends keyof WorkbenchFormState>(field: K, value: WorkbenchFormState[K]) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (activeMaterialId) {
        setMaterials((items) => items.map((item) => item.id === activeMaterialId ? {
          ...item,
          form: next,
          title: next.sourceTitle || item.title,
          sourceUrl: next.sourceUrl || item.sourceUrl,
        } : item));
      }
      return next;
    });
  };

  const showNotice = (kind: "success" | "error" | "info", key: NoticeKey) => {
    setNotice(kind);
    setNoticeKey(key);
  };

  const usePendingResearchImport = () => {
    if (!pendingResearchImport) return;
    const { material, form: nextForm } = pendingResearchImport;
    setMaterials((current) => current.map((item) => item.id === material.material_id ? {
      ...item,
      input: material.feed_item.article_url ?? material.feed_item.feed_url,
      status: nextForm.body.trim() ? "captured" as const : "manual_only" as const,
      title: nextForm.sourceTitle,
      sourceUrl: nextForm.sourceUrl,
      error: material.error?.code ?? "",
      form: nextForm,
      researchImport: researchImportMetadata(material, nextForm),
      reviewedFingerprint: null,
      approvedFingerprint: null,
      approvalSeal: null,
      rejectedFingerprint: null,
    } : item));
    setForm(nextForm);
    setDraftOrigin("extracted");
    setReviewedFingerprint(null);
    setApprovedFingerprint(null);
    setRejectedFingerprint(null);
    setPendingResearchImport(null);
    showNotice("success", "researchImportUpdated");
  };

  const keepLocalResearchDraft = () => {
    setPendingResearchImport(null);
    showNotice("info", "researchImportKept");
  };

  const createTextDraft = (value = inputValue, appendAsNew = false) => {
    const split = splitPasteTextBlocks(value);
    if (!split.ok) {
      showNotice("error", split.reason === "over_cap" ? "batchTooLarge" : "emptyBody");
      return;
    }
    if (split.blocks.length > 1) {
      const now = new Date().toISOString();
      const cards: MaterialCard[] = split.blocks.map((block, index) => {
        const title = provisionalTitle(block);
        const kind = detectInputKind(block);
        const nextForm: WorkbenchFormState = {
          ...EMPTY_FORM,
          body: block,
          sourceTitle: title,
          capturedAt: now,
          evidenceSource: "使用者貼上正文",
          evidenceReference: title,
          sourceKind: kind === "markdown" || kind === "srt" || kind === "vtt" ? kind : "paste_text",
        };
        return {
          id: `material-${Date.now()}-${index}`,
          input: block,
          status: "captured",
          title,
          sourceUrl: "",
          error: "",
          form: nextForm,
          reviewedFingerprint: null,
          approvedFingerprint: null,
          approvalSeal: null,
          rejectedFingerprint: null,
        };
      });
      const first = cards[0];
      setInputValue(value);
      setForm(first.form ?? EMPTY_FORM);
      setMaterials((current) => appendAsNew ? [...current, ...cards] : cards);
      setActiveMaterialId(first.id);
      setDraftOrigin("manual");
      setStage("draft");
      setReviewedFingerprint(null);
      setApprovedFingerprint(null);
      setApprovalSeal(null);
      setRejectedFingerprint(null);
      showNotice("success", "makeDraft");
      return;
    }
    const now = new Date().toISOString();
    const title = provisionalTitle(value);
    const activeMaterial = appendAsNew ? null : materialsRef.current.find((material) => material.id === activeMaterialId);
    const currentForm = appendAsNew ? EMPTY_FORM : form;
    const preservedUrl = currentForm.sourceUrl.trim() || activeMaterial?.sourceUrl || "";
    const isRecovery = Boolean(activeMaterial && (activeMaterial.status === "failed" || activeMaterial.status === "manual_only") && preservedUrl);
    const nextForm: WorkbenchFormState = {
      ...EMPTY_FORM,
      body: value,
      sourceTitle: currentForm.sourceTitle || title,
      sourceUrl: preservedUrl,
      creator: currentForm.creator || sourceWebsiteName(preservedUrl),
      originalUrl: currentForm.originalUrl || preservedUrl,
      finalUrl: currentForm.finalUrl || preservedUrl,
      capturedAt: now,
      evidenceSource: currentForm.evidenceSource || currentForm.sourceUrl || "使用者貼上正文",
      evidenceReference: currentForm.evidenceReference || title,
      analysisStatus: "not_requested" as const,
      analysisError: "",
      analysisProvider: "none" as const,
      analysisModel: "",
      analysisUsage: "",
      accessMethod: isRecovery ? "manual_fallback" as const : currentForm.accessMethod,
      sourceKind: (() => {
        const kind = detectInputKind(value);
        return kind === "markdown" || kind === "srt" || kind === "vtt" ? kind : "paste_text";
      })(),
    };
    setInputValue(value);
    setForm(nextForm);
    const materialId = activeMaterial?.id ?? `material-${Date.now()}`;
    const material: MaterialCard = {
      id: materialId,
      input: activeMaterial?.input ?? value,
      status: "captured",
      title: nextForm.sourceTitle,
      sourceUrl: nextForm.sourceUrl,
      error: "",
      form: nextForm,
      researchImport: activeMaterial?.researchImport,
    };
    setMaterials((current) => !appendAsNew && current.some((item) => item.id === materialId)
      ? current.map((item) => item.id === materialId ? material : item)
      : [...current, material]);
    setActiveMaterialId(materialId);
    setDraftOrigin("manual");
    setStage("draft");
    setReviewedFingerprint(null);
    setApprovedFingerprint(null);
    setApprovalSeal(null);
    setRejectedFingerprint(null);
    showNotice("success", "makeDraft");
  };

  const createFileDraft = (value: string, fileName: string, appendAsNew = false) => {
    try {
      const materialInput = validateUploadedTextMaterial(value, fileName);
      const now = new Date().toISOString();
      const nextForm = {
        ...EMPTY_FORM,
        body: materialInput.body,
        sourceTitle: materialInput.title,
        capturedAt: now,
        sourceKind: materialInput.kind,
        evidenceSource: materialInput.fileName,
        evidenceReference: "",
        evidenceTimestamp: "",
      };
      const material = { id: `material-${Date.now()}`, input: materialInput.fileName, status: "captured" as const, title: nextForm.sourceTitle, sourceUrl: "", error: "", form: nextForm };
      setForm(nextForm);
      setMaterials((current) => appendAsNew ? [...current, material] : [material]);
      setActiveMaterialId(material.id);
      setReviewedFingerprint(null);
      setApprovedFingerprint(null);
      setApprovalSeal(null);
      setRejectedFingerprint(null);
      setImportFileError(null);
      setDraftOrigin("manual");
      setStage("draft");
    } catch (error) {
      setImportFileError(error instanceof Error ? error.message : "The text file could not be read; paste text instead.");
    }
  };

  const loadPreviewSource = (source: SourceRecord) => {
    const isSynthetic = syntheticPreview && source.source_url === "https://example.invalid/synthetic"
      && /^qa12_[A-Za-z0-9_-]{6,70}$/.test(source.id);
    const isPilot = realPilotPreview && source.id === "src_b374361cee7c6e132205267306a1e82b"
      && source.record_version === 2
      && source.title === "AI PM Radar：以可追溯證據與人工審核提高 AI 研究資料的可信度";
    if (!isSynthetic && !isPilot) return;
    const quote = source.evidence[0];
    const nextForm: WorkbenchFormState = {
      ...EMPTY_FORM, sourceTitle: source.title || "", sourceUrl: source.source_url || "",
      originalUrl: source.source_url_original || "",
      finalUrl: source.source_url_final || "",
      creator: source.creator || "", capturedAt: source.captured_at,
      description: source.description || "",
      publishedAt: source.published_at || "",
      language: source.language || "zh-Hant", body: source.raw_text,
      accessMethod: "direct_input", sourceKind: "paste_text",
      evidenceSource: quote?.source || source.source_url || "",
      evidenceTimestamp: quote?.timestamp || "",
      evidenceReference: quote?.text_reference || "",
      keyClaims: source.key_claims.map(item => item.claim).join("\n"),
      claimEvidence: source.key_claims, summary: source.summary || "",
      keyPoints: source.key_points.join("\n"),
      whyItMatters: source.why_it_matters || "",
      businessImplication: source.business_implication || "",
      aiPmImplication: source.ai_pm_implication || "",
      videoImplication: source.video_implication || "",
      contentIdeas: source.content_ideas.join("\n"),
      caseCandidate: source.case_candidate,
      libraryTargets: [...source.library_targets],
      trendTags: source.trend_tags.join("\n"),
      topicTags: source.topic_tags.join("\n"),
      uncertainties: source.uncertainties.join("\n"),
      evidenceGrade: source.evidence_grade,
      confidence: source.confidence !== null ? String(source.confidence) : "",
      sourceFacts: source.analysis.source_facts.join("\n"),
      methodOrTeachingPoints: (source.analysis.method_or_teaching_points ?? []).join("\n"),
      analysisInferences: source.analysis.inferences.join("\n"),
      analysisStatus: "not_requested",
    };
    const card: MaterialCard = {
      id: source.id, input: source.raw_text, status: "captured",
      title: source.title || "", sourceUrl: source.source_url || "",
      error: "", form: nextForm,
    };
    setForm(nextForm);
    setMaterials((prev) => prev.some(item => item.id === card.id)
      ? prev.map(item => item.id === card.id ? card : item) : [...prev, card]);
    setActiveMaterialId(card.id);
    setStage("draft"); setDraftOrigin("manual");
    setReviewedFingerprint(null); setApprovedFingerprint(null); setRejectedFingerprint(null);
  };

  const makeFetchedForm = (fetched: FetchedDraft, collection?: SourceCollectionProvenance): WorkbenchFormState => ({
    ...EMPTY_FORM,
    sourceTitle: fetched.title,
    sourceUrl: fetched.finalUrl,
    originalUrl: fetched.originalUrl,
    finalUrl: fetched.finalUrl,
    creator: fetched.creator?.trim() || sourceWebsiteName(fetched.finalUrl),
    publishedAt: dateInputValue(fetched.publishedAt),
    capturedAt: fetched.capturedAt,
    body: fetched.body,
    accessMethod: "metadata_probe",
    evidenceSource: fetched.finalUrl,
    evidenceReference: firstParagraph(fetched.body),
    collection,
  });

  const fetchUrlData = async (url: string) => {
    const platform = detectPlatformFromUrl(url);
    if (platform !== "manual") return { platform, fetched: null as FetchedDraft | null };
    const payload = await requestCompanionJson<FetchedDraft>(`/fetch?url=${encodeURIComponent(url)}`);
    return { platform, fetched: payload };
  };

  const createUrlDraft = async (requestedUrl = inputValue, appendAsNew = false) => {
    if (isolatedPreview) return;
    const batch = parseUrlBatch(requestedUrl);
    if (!batch.ok && batch.reason !== "not_url_batch") {
      showNotice("error", batch.reason === "over_cap" ? "batchTooLarge" : "fetchFailure");
      return;
    }
    const urls = batch.ok
      ? batch.urls
      : requestedUrl.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    setIsFetching(true);
    setNotice(null);
    setNoticeKey(null);
    const cards = urls.map((url, index) => ({ id: `material-${Date.now()}-${index}`, input: url, status: "pending" as const, title: url, sourceUrl: url, error: "", form: null }));
    setInputValue(requestedUrl);
    setMaterials((current) => appendAsNew ? [...current, ...cards] : cards);
    setActiveMaterialId(cards[0]?.id ?? null);
    setReviewedFingerprint(null);
    setApprovedFingerprint(null);
    setApprovalSeal(null);
    setRejectedFingerprint(null);
    let firstReady = false;
    let partial = false;
    let firstFailure: NoticeKey | null = null;
    for (const [index, card] of cards.entries()) {
      try {
        const parsed = new URL(card.input);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("invalid_url");
        const result = await fetchUrlData(card.input);
        if (!result.fetched) {
          const manualForm = { ...EMPTY_FORM, sourceUrl: card.input, originalUrl: card.input, finalUrl: card.input, capturedAt: new Date().toISOString(), accessMethod: "manual_fallback" as const };
          setMaterials((items) => items.map((item) => item.id === card.id ? { ...item, status: "manual_only", form: manualForm } : item));
          if (!firstReady) {
            setForm(manualForm);
            setDraftOrigin("manual");
            setStage("draft");
            firstReady = true;
          }
          if (!firstFailure) firstFailure = "platformFallback";
          continue;
        }
        partial ||= result.fetched.completeness === "partial";
        const nextForm = makeFetchedForm(result.fetched);
        setMaterials((items) => items.map((item) => item.id === card.id ? { ...item, status: "captured", title: nextForm.sourceTitle, sourceUrl: nextForm.sourceUrl, form: nextForm } : item));
        if (!firstReady) {
          setForm(nextForm);
          setDraftOrigin("extracted");
          setStage("draft");
          firstReady = true;
        }
      } catch (error) {
        const code = (error as Error & { code?: FetchFailureCode })?.code;
        setMaterials((items) => items.map((item) => item.id === card.id ? { ...item, status: "failed", error: code || "fetch_failed" } : item));
        if (!firstReady && index === 0) {
          const fallbackForm = { ...EMPTY_FORM, sourceUrl: card.input, originalUrl: card.input, finalUrl: card.input, capturedAt: new Date().toISOString(), accessMethod: "manual_fallback" as const };
          setForm(fallbackForm);
          setDraftOrigin("manual");
          setStage("draft");
          firstReady = true;
        }
        firstFailure ||= localFetchError(code, error);
      }
    }
    if (partial) showNotice("info", "partialContent");
    else if (firstFailure) showNotice(firstFailure === "platformFallback" ? "info" : "error", firstFailure);
    else showNotice("success", "fetchSuccess");
    setIsFetching(false);
  };

  useEffect(() => {
    if (!isHydrated || isolatedPreview || quickCaptureConsumedRef.current
      || new URLSearchParams(window.location.search).get("quickCapture") !== "1") return;
    quickCaptureConsumedRef.current = true;
    try {
      const raw = sessionStorage.getItem(QUICK_CAPTURE_SESSION_KEY);
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete("quickCapture");
      window.history.replaceState(window.history.state, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
      if (!raw) {
        if (!form.body.trim() && materials.length === 0) setImportFileError(messages.home.quickCaptureInvalid);
        return;
      }
      const handoff = parseQuickCapture(raw);
      sessionStorage.removeItem(QUICK_CAPTURE_SESSION_KEY);
      quickCaptureAutoAnalyzeRef.current = handoff.autoAnalyze === true;
      setInputValue(handoff.value);
      setInputMode(handoff.fileName ? "text" : detectSourceEntryMode(handoff.value));
      if (handoff.fileName) createFileDraft(handoff.value, handoff.fileName, true);
      else if (detectSourceEntryMode(handoff.value) === "url") void createUrlDraft(handoff.value, true);
      else createTextDraft(handoff.value, true);
    } catch {
      setImportFileError(messages.home.quickCaptureInvalid);
    }
  }, [isHydrated]);

  // Quick Capture "AI 整理": once the draft has real source text, run the same /analyze flow once.
  // If there is no usable text (e.g. a video link that needs login / has no transcript) we do not
  // fake a summary; the local draft stays and the platform/fetch notice explains what is missing.
  useEffect(() => {
    if (!quickCaptureAutoAnalyzeRef.current || isFetching || stage !== "draft") return;
    quickCaptureAutoAnalyzeRef.current = false;
    if (!form.body.trim()) return;
    void analyzeCurrent();
  }, [stage, isFetching, form.body]);

  useEffect(() => {
    if (!quickCaptureAutoAnalyzeRef.current || isFetching) return;
    if (stage === "import" && materials.length > 0 && materials.every((item) => item.status !== "pending")) {
      quickCaptureAutoAnalyzeRef.current = false;
    }
  }, [isFetching, stage, materials]);

  const retryMaterial = async (material: MaterialCard) => {
    setMaterials((items) => items.map((item) => item.id === material.id ? { ...item, status: "pending", error: "" } : item));
    try {
      const result = await fetchUrlData(material.input);
      if (!result.fetched) {
        showNotice("info", "platformFallback");
        setMaterials((items) => items.map((item) => item.id === material.id ? { ...item, status: "manual_only" } : item));
        return;
      }
      const nextForm = makeFetchedForm(result.fetched, material.form?.collection);
      setMaterials((items) => items.map((item) => item.id === material.id ? { ...item, status: "captured", title: nextForm.sourceTitle, sourceUrl: nextForm.sourceUrl, form: nextForm } : item));
      setActiveMaterialId(material.id);
      setForm(nextForm);
      setDraftOrigin("extracted");
      setStage("draft");
      showNotice("success", result.fetched.completeness === "partial" ? "partialContent" : "fetchSuccess");
    } catch (error) {
      const code = (error as Error & { code?: FetchFailureCode })?.code;
      setMaterials((items) => items.map((item) => item.id === material.id ? { ...item, status: "failed", error: code || "fetch_failed" } : item));
      showNotice("error", localFetchError(code, error));
    }
  };

  const analyzeCurrent = async () => {
    if (isolatedPreview) return;
    if (!form.body.trim()) {
      showNotice("error", "emptyBody");
      return;
    }
    const sourceSnapshot = createAnalysisSourceSnapshot(record);
    const analysisText = sourceSnapshot.text;
    if (analysisText.length > MAX_ANALYSIS_INPUT_CHARS) {
      showNotice("error", "analysisTooLong");
      return;
    }
    setEvidenceIssueLocations([]);
    setForm((current) => ({ ...current, analysisStatus: "processing", analysisError: "" }));
    try {
      const payload = await requestCompanionJson<{ provider?: SourceRecord["analysis"]["provider"]; model?: string; analysis?: AIAnalysisDraft; usage?: SourceRecord["analysis"]["usage"]; source_id?: string | null; source_version?: string | null; diagnostics?: { omitted_method_points?: string[] } }>("/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source_text: analysisText,
          source_id: sourceSnapshot.source_id,
          source_version: sourceSnapshot.source_version,
          title: form.sourceTitle,
          source_url: form.finalUrl || form.sourceUrl,
          language: form.language,
        }),
      });
      if (!payload.analysis) {
        const failure = new Error(copy.analysisFailed) as Error & { code?: string };
        failure.code = "model_empty_output";
        throw failure;
      }
      if (payload.source_id !== sourceSnapshot.source_id || payload.source_version !== sourceSnapshot.source_version) {
        const failure = new Error("The analysis response does not match the requested source snapshot.") as Error & { code?: string };
        failure.code = "analysis_snapshot_mismatch";
        throw failure;
      }
      const currentRecord = buildRecord(latestFormRef.current, "needs_review", "not_approved");
      if (!isAnalysisSourceSnapshotCurrent(currentRecord, sourceSnapshot)) {
        const failure = new Error("The source changed while the analysis was running.") as Error & { code?: string };
        failure.code = "analysis_snapshot_mismatch";
        throw failure;
      }
      const draft = payload.analysis;
      const hasOmittedMethods = Boolean(payload.diagnostics?.omitted_method_points?.length);
      const validation = validateAIAnalysisDraft(draft, sourceSnapshot.text);
      if (!validation.valid) {
        const failure = new Error(validation.issues.join(" ")) as Error & { code?: string };
        failure.code = validation.issues.some((issue) => /evidence/i.test(issue))
          ? "evidence_not_found"
          : "model_schema_mismatch";
        throw failure;
      }
      const canonicalDraft = canonicaliseAIAnalysisEvidence(draft, sourceSnapshot.text);
      const analyzedAt = new Date().toISOString();
      let analyzed: SourceRecord;
      try {
        analyzed = applyAIAnalysisDraft(currentRecord, canonicalDraft, {
          provider: payload.provider === "gemini" || payload.provider === "ollama" || payload.provider === "openrouter" ? payload.provider : "openai_responses",
          model: payload.model || "unknown",
          analyzedAt,
          usage: payload.usage ?? null,
        });
      } catch (mappingError) {
        const failure = new Error(mappingError instanceof Error ? mappingError.message : "SourceRecord mapping failed.") as Error & { code?: string };
        failure.code = "source_record_mapping_failed";
        throw failure;
      }
      setForm((current) => {
        const next: WorkbenchFormState = {
          ...current,
        sourceTitle: canonicalDraft.suggested_title || current.sourceTitle,
        summary: canonicalDraft.summary || current.summary,
        keyPoints: canonicalDraft.key_points.join("\n") || current.keyPoints,
        keyClaims: canonicalDraft.key_claims.map((item) => item.claim).join("\n") || current.keyClaims,
        claimEvidence: analyzed.key_claims,
        whyItMatters: canonicalDraft.why_it_matters || current.whyItMatters,
        businessImplication: canonicalDraft.business_implication || current.businessImplication,
        aiPmImplication: canonicalDraft.ai_pm_implication || current.aiPmImplication,
        contentIdeas: canonicalDraft.content_ideas.join("\n") || current.contentIdeas,
        uncertainties: canonicalDraft.uncertainties.join("\n") || current.uncertainties,
        topicTags: canonicalDraft.tags.join("\n") || current.topicTags,
        dailyTags: canonicalDraft.daily_tags.join("\n") || current.dailyTags,
        questionTitle: canonicalDraft.question_title || current.questionTitle,
        shortTitle: canonicalDraft.short_title || current.shortTitle,
        category: canonicalDraft.category || current.category,
        impactScore: String(canonicalDraft.impact_score.value),
        relevanceScore: String(canonicalDraft.relevance_score.value),
        trustScore: String(canonicalDraft.trust_score.value),
        confidence: String(canonicalDraft.confidence),
        evidenceSource: canonicalDraft.key_claims[0]?.evidence[0]?.source || current.evidenceSource,
        evidenceTimestamp: canonicalDraft.key_claims[0]?.evidence[0]?.timestamp || current.evidenceTimestamp,
        evidenceReference: canonicalDraft.key_claims[0]?.evidence[0]?.text_reference || current.evidenceReference,
        sourceFacts: canonicalDraft.source_facts.join("\n") || current.sourceFacts,
        methodOrTeachingPoints: canonicalDraft.method_or_teaching_points.join("\n"),
        analysisInferences: [canonicalDraft.business_implication, canonicalDraft.ai_pm_implication, ...canonicalDraft.use_cases].filter(Boolean).join("\n"),
        analysisStatus: "draft",
        analysisError: hasOmittedMethods ? "method_points_omitted" : "",
        analysisProvider: payload.provider === "gemini" || payload.provider === "ollama" || payload.provider === "openrouter" ? payload.provider : "openai_responses",
        analysisModel: payload.model || "unknown",
        analysisAnalyzedAt: analyzedAt,
        analysisUsage: payload.usage ? JSON.stringify(payload.usage) : "",
        };
        if (activeMaterialId) {
          setMaterials((items) => items.map((item) => item.id === activeMaterialId ? {
            ...item,
            form: next,
            title: next.sourceTitle || item.title,
            sourceUrl: next.sourceUrl || item.sourceUrl,
          } : item));
        }
        return next;
      });
      setReviewedFingerprint(null);
      setApprovedFingerprint(null);
      setRejectedFingerprint(null);
      setNotice(hasOmittedMethods ? "info" : "success");
      setNoticeKey(hasOmittedMethods ? "analysisMethodOmitted" : "analysisSuccess");
      void analyzed;
    } catch (error) {
      const code = (error as Error & { code?: string })?.code;
      const provider = error instanceof CompanionApiError
        ? error.payload?.provider as SourceRecord["analysis"]["provider"] | undefined
        : (error as Error & { provider?: SourceRecord["analysis"]["provider"] })?.provider;
      const diagnostics = error instanceof CompanionApiError ? error.payload?.diagnostics : null;
      const issues = diagnostics && typeof diagnostics === "object" ? (diagnostics as { validation_issues?: unknown }).validation_issues : null;
      setEvidenceIssueLocations(code === "evidence_not_found" ? summariseAnalysisEvidenceIssueLocations(issues) : []);
      setForm((current) => ({ ...current, analysisStatus: "failed", analysisError: code || "analysis_failed", analysisProvider: provider && provider !== "none" ? provider : current.analysisProvider }));
      showNotice("error", localAnalysisError(code, error));
    }
  };

  const markReviewed = () => {
    setReviewedFingerprint(fingerprint);
    setRejectedFingerprint(null);
    setDraftOrigin("manual");
    setApprovedFingerprint(null);
    setApprovalSeal(null);
    setMaterials((current) => current.map((material) => material.id === activeMaterialId ? {
      ...material,
      reviewedFingerprint: fingerprint,
      approvedFingerprint: null,
      approvalSeal: null,
      rejectedFingerprint: null,
    } : material));
  };

  const approveAndDownload = async () => {
    if (gate.review_status !== "reviewed" || nonApprovalBlockers.length > 0 || isApprovingCandidate) return;
    const approvedRecord = buildRecord(form, "reviewed", "approved");
    const approvedCandidate = buildDailyCandidate([{ record: approvedRecord, daily }], candidateDate);
    if (approvedCandidate.included.length !== 1) return;
    const sealPayload = { candidate: approvedCandidate.candidate, sourceRecord: approvedRecord };
    const seal = await createApprovalSeal(sealPayload);
    // Do not export an approved record before that exact approval survives a reload.
    // Cancel a pending unapproved debounce so it cannot overwrite the explicit save.
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setIsApprovingCandidate(true);
    try {
      const snapshot = currentWorkbench();
      await persistWorkbench({
        ...snapshot,
        materials: snapshot.materials.map((material) => material.id === activeMaterialId
          ? { ...material, approvedFingerprint: fingerprint, approvalSeal: seal }
          : material),
        approvedFingerprint: fingerprint,
        approvalSeal: seal,
      });
      setApprovedFingerprint(fingerprint);
      setApprovalSeal(seal);
      setMaterials((current) => current.map((material) => material.id === activeMaterialId ? {
        ...material, approvedFingerprint: fingerprint, approvalSeal: seal,
      } : material));
      await assertApprovalIntegrity(sealPayload, seal);
      download(candidateFileName, approvedCandidate.candidate);
    } catch {
      setPersistenceStatus("error");
    } finally {
      setIsApprovingCandidate(false);
    }
  };

  const downloadApprovedCandidate = async () => {
    try {
      const approvedRecord = buildRecord(form, "reviewed", "approved");
      const approvedCandidate = buildDailyCandidate([{ record: approvedRecord, daily }], candidateDate);
      if (approvedCandidate.included.length !== 1) throw new Error("Candidate is no longer eligible.");
      await assertApprovalIntegrity({ candidate: approvedCandidate.candidate, sourceRecord: approvedRecord }, approvalSeal);
      download(candidateFileName, approvedCandidate.candidate);
    } catch {
      showNotice("error", "analysisSnapshotStale");
    }
  };

  const downloadApprovedSourceRecord = async () => {
    try {
      const approvedRecord = buildRecord(form, "reviewed", "approved");
      const approvedCandidate = buildDailyCandidate([{ record: approvedRecord, daily }], candidateDate);
      if (approvedCandidate.included.length !== 1) throw new Error("Candidate is no longer eligible.");
      await assertApprovalIntegrity({ candidate: approvedCandidate.candidate, sourceRecord: approvedRecord }, approvalSeal);
      download(sourceRecordFileName, approvedRecord);
    } catch {
      showNotice("error", "analysisSnapshotStale");
    }
  };

  const approveSourceForReuse = async () => {
    if (gate.review_status !== "reviewed" || reusableRecordBlockers.length > 0) return;
    setLibraryApprovalStatus("saving");
    try {
      const entry = createSourceLibraryEntry(reusableRecord, new Date().toISOString());
      const saved = await saveSourceLibraryEntry(entry);
      setLibraryEntries((current) => current.some((item) => item.fingerprint === saved.fingerprint) ? current : [...current, saved]);
      setLibraryApprovalStatus("saved");
    } catch {
      setLibraryApprovalStatus("error");
    }
  };

  const reject = () => {
    setRejectedFingerprint(fingerprint);
    setApprovedFingerprint(null);
    setApprovalSeal(null);
    setMaterials((current) => current.map((material) => material.id === activeMaterialId ? {
      ...material,
      approvedFingerprint: null,
      approvalSeal: null,
      rejectedFingerprint: fingerprint,
    } : material));
  };

  const reset = () => {
    if (!window.confirm(copy.deleteDraft)) return;
    setStage("import");
    setInputValue("");
    setForm(EMPTY_FORM);
    setReviewedFingerprint(null);
    setApprovedFingerprint(null);
    setRejectedFingerprint(null);
    setLibraryApprovalStatus("idle");
    setNotice(null);
    setNoticeKey(null);
    setMaterials([]);
    setActiveMaterialId(null);
    setPendingResearchImport(null);
    void removeStoredWorkbench(draftDbName).catch(() => setPersistenceStatus("error"));
  };

  const download = (fileName: string, value: unknown) => {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const exportWorkbench = () => {
    download(`source-inbox-draft-${candidateDate || "undated"}.json`, JSON.parse(serializeSourceDrafts([currentWorkbench()])));
  };

  const importWorkbench = async (file: File) => {
    try {
      const parsed = parseSourceDrafts<PersistedWorkbench>(await file.text());
      const saved = parsed.items[0];
      if (!saved || !saved.form || !Array.isArray(saved.materials)) throw new Error("Invalid draft content.");
      setStage(saved.stage);
      setInputMode(saved.inputMode);
      setInputValue(saved.inputValue);
      setForm({
        ...EMPTY_FORM,
        ...saved.form,
        accessMethod: saved.form.accessMethod ?? "direct_input",
        analysisProvider: saved.form.analysisProvider ?? (saved.form.analysisStatus === "not_requested" ? "none" : "openai_responses"),
      });
      setCandidateDate(saved.candidateDate);
      setReviewedFingerprint(saved.reviewedFingerprint ?? null);
      setApprovedFingerprint(saved.approvedFingerprint ?? null);
      setApprovalSeal(saved.approvalSeal ?? null);
      setRejectedFingerprint(saved.rejectedFingerprint ?? null);
      const restoredActiveId = saved.activeMaterialId ?? saved.materials[0]?.id ?? null;
      setMaterials(saved.materials.map((material) => {
        const isActive = material.id === restoredActiveId;
        return {
          ...material,
          reviewedFingerprint: Object.prototype.hasOwnProperty.call(material, "reviewedFingerprint")
            ? material.reviewedFingerprint ?? null : isActive ? saved.reviewedFingerprint ?? null : null,
          approvedFingerprint: Object.prototype.hasOwnProperty.call(material, "approvedFingerprint")
            ? material.approvedFingerprint ?? null : isActive ? saved.approvedFingerprint ?? null : null,
          approvalSeal: Object.prototype.hasOwnProperty.call(material, "approvalSeal")
            ? material.approvalSeal ?? null : isActive ? saved.approvalSeal ?? null : null,
          rejectedFingerprint: Object.prototype.hasOwnProperty.call(material, "rejectedFingerprint")
            ? material.rejectedFingerprint ?? null : isActive ? saved.rejectedFingerprint ?? null : null,
        };
      }));
      setActiveMaterialId(restoredActiveId);
      setPendingResearchImport(null);
      showNotice("success", "backupImported");
    } catch {
      showNotice("error", "backupInvalid");
    }
  };

  const selectMaterial = (material: MaterialCard) => {
    if (!material.form) return;
    setActiveMaterialId(material.id);
    setForm(material.form);
    setStage("draft");
    setDraftOrigin(material.status === "captured" ? "extracted" : "manual");
    setPendingResearchImport(null);
    setReviewedFingerprint(material.reviewedFingerprint ?? null);
    setApprovedFingerprint(material.approvedFingerprint ?? null);
    setApprovalSeal(material.approvalSeal ?? null);
    setRejectedFingerprint(material.rejectedFingerprint ?? null);
  };

  const candidateFileName = `daily-candidate-${candidateDate || "undated"}-${record.id}.json`;
  const sourceRecordFileName = `source-record-${candidateDate || "undated"}-${record.id}.json`;

  return (
    <main className="container section stack-lg">
      <section className="workbench-intro">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="lead">{copy.intro}</p>
        <p className="workbench-notice">{realPilotPreview
          ? "Phase 1.4A — Clean-room 單篇文章：真正 React Source Inbox + 獨立 IndexedDB。雲端資料只讀、不可上傳或覆寫。請勿輸入其他真實文章或私人資料。"
          : syntheticPreview ? "Protected Preview：真實 Source Inbox React 工作台，獨立合成草稿儲存；AI／背景收集／真實資料上雲均不可用。只准使用內建合成材料，請勿輸入私人資料。" : copy.localOnly}</p>
        <p className="language-hint">{copy.contentHint}</p>
        <div className="workbench-steps" aria-label={copy.inputTitle}>
          {copy.steps.map((step, index) => <span className={stageIndex(stage) === index + 1 ? "active-step" : ""} key={step}>{step}</span>)}
        </div>
      </section>

      {notice && noticeKey ? <div className={`workbench-notice notice-${notice}`} role="status">{copy[noticeKey]}</div> : null}
      {importFileError ? <div className="workbench-notice notice-error" role="alert">{importFileError}</div> : null}

      {pendingResearchImport ? <div className="workbench-notice notice-info" role="status"><p>{copy.researchImportConflict}</p><div className="action-row"><button type="button" className="secondary-button" onClick={keepLocalResearchDraft}>{copy.keepLocalDraft}</button><button type="button" className="primary-button" onClick={usePendingResearchImport}>{copy.useBackgroundResult}</button></div></div> : null}

      {stage === "import" && !isolatedPreview ? (
        <ImportPanel
          copy={copy}
          mode={inputMode}
          value={inputValue}
          sourceUrl={form.sourceUrl}
          isFetching={isFetching}
          isHydrated={isHydrated}
          onModeChange={setInputMode}
          onValueChange={(value) => {
            setInputValue(value);
            if (value.trim()) setInputMode(detectSourceEntryMode(value));
          }}
          onSourceUrlChange={(value) => updateField("sourceUrl", value)}
          onSubmit={inputMode === "url" ? () => void createUrlDraft() : () => createTextDraft()}
          onImportFile={createFileDraft}
          onImportError={setImportFileError}
        />
      ) : null}

      <div className="workbench-save-bar">
        <p className="field-hint persistence-status" role="status">
          {persistenceStatus === "saved" ? copy.savedLocally : persistenceStatus === "saving" ? copy.savingLocally : persistenceStatus === "unavailable" ? copy.storageUnavailable : persistenceStatus === "error" ? copy.storageFailed : copy.savingLocally}
          {persistenceStatus === "saved" && lastSavedAt ? ` · ${copy.lastSavedAt} ${new Date(lastSavedAt).toLocaleTimeString()}` : ""}
        </p>
        <div className="action-row">
          <button type="button" className="secondary-button" disabled={!isHydrated || persistenceStatus === "unavailable"} onClick={saveNow}>{copy.saveNow}</button>
          <button type="button" className="secondary-button" disabled={!isHydrated} onClick={exportWorkbench}>{copy.exportDraft}</button>
        </div>
      </div>

      {realPilotPreview ? <OneArticleCloudWorkspacePanel
        record={record}
        materialId={activeMaterialId}
        localSaved={isHydrated && persistenceStatus === "saved"}
        onLoad={loadPreviewSource}
        onApplyDemoSummary={() => updateField("summary", "修訂版：為跨裝置協作增加明確備份與人工衝突處理。")}
        onBackup={async () => {
          await persistWorkbench(currentWorkbench());
          exportWorkbench();
        }}
      /> : syntheticPreview ? <SyntheticActualWorkbenchCloudPanel
        record={record}
        materialId={activeMaterialId}
        localSaved={isHydrated && persistenceStatus === "saved"}
        onLoadSynthetic={loadPreviewSource}
        onBackup={async () => {
          await persistWorkbench(currentWorkbench());
          exportWorkbench();
        }}
      /> : <CloudSyncOptInPanel
        materialId={activeMaterialId}
        record={record}
        localSaved={isHydrated && persistenceStatus === "saved"}
        onBackup={async () => {
          await persistWorkbench(currentWorkbench());
          exportWorkbench();
        }}
      />}

      {!isolatedPreview && <details className="workbench-details advanced-tools">
        <summary>{copy.advancedTools}</summary>
        <p className="field-hint">{copy.advancedToolsHint}</p>
        <div className="workbench-toolbar">
          <div className="action-row">
            <label className="secondary-button file-button">{copy.importDraft}<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importWorkbench(file); event.currentTarget.value = ""; }} /></label>
          </div>
        </div>
        <p className="field-hint">{copy.backupWarning}</p>
        <SourceSubscriptions copy={copy} onItemsImported={importFeedItems} />
      </details>}

      {materials.length > 0 ? <MaterialCards
        copy={copy}
        materials={materials}
        activeMaterialId={activeMaterialId}
        candidateDate={candidateDate}
        activeReviewState={{ reviewedFingerprint, approvedFingerprint, rejectedFingerprint }}
        onSelect={selectMaterial}
        onRetry={retryMaterial}
      /> : null}

      {stage !== "import" ? (
        <>
          {stage === "draft" ? (
            <DraftPanel
              copy={copy}
              form={form}
              candidateDate={candidateDate}
              draftOrigin={draftOrigin}
              sourceParagraphs={sourceParagraphs}
              intakeEvidenceCandidates={intakeEvidenceCandidates}
              sourceDomain={sourceDomain}
              onUpdate={updateField}
              onDateChange={setCandidateDate}
              onSelectEvidence={(value, candidate) => {
                updateField("evidenceReference", value);
                if (candidate) {
                  updateField("evidenceSource", candidate.evidenceSource);
                  updateField("evidenceTimestamp", candidate.evidenceTimestamp);
                } else if (form.sourceKind === "markdown" || form.sourceKind === "srt" || form.sourceKind === "vtt") {
                  updateField("evidenceTimestamp", "");
                }
              }}
              onRetryFetch={() => void createUrlDraft(form.sourceUrl)}
              onPasteBody={() => { setInputMode("text"); setInputValue(form.body); setStage("import"); }}
              onAnalyze={analyzeCurrent}
              isAnalyzing={form.analysisStatus === "processing"}
              evidenceIssueLocations={evidenceIssueLocations}
              analysisErrorMessage={form.analysisError ? copy[localAnalysisError(form.analysisError, null)] : copy.analysisFailed}
            />
          ) : null}

          {stage === "draft" ? (
            <div className="stage-actions">
              <button type="button" className="secondary-button" onClick={() => setStage("import")}>{copy.backToEdit}</button>
              <button type="button" className="primary-button" onClick={() => setStage("review")}>{copy.nextToReview}</button>
            </div>
          ) : (
            <ReviewPanel
              copy={copy}
              record={record}
              onUpdate={updateField}
              blockers={blockers}
              isReady={isReady}
              reviewStatus={gate.review_status}
              approvalStatus={gate.approval_status}
              approvedFingerprint={approvedFingerprint}
              fingerprint={fingerprint}
              candidateFileName={candidateFileName}
              sourceRecordFileName={sourceRecordFileName}
              onBack={() => setStage("draft")}
              onMarkReviewed={markReviewed}
              onReject={reject}
              onApproveAndDownload={() => void approveAndDownload()}
              isApprovingCandidate={isApprovingCandidate}
              onApproveSourceForReuse={() => void approveSourceForReuse()}
              reusableSourceBlockers={reusableRecordBlockers}
              reusableSourceSaved={reusableRecordSaved}
              reusableSourceSaving={libraryApprovalStatus === "saving"}
              reusableSourceError={libraryApprovalStatus === "error"}
              onDownloadCandidate={() => void downloadApprovedCandidate()}
              onDownloadSourceRecord={() => void downloadApprovedSourceRecord()}
              onReset={reset}
            />
          )}
        </>
      ) : null}
    </main>
  );
}

function stageIndex(stage: Stage) {
  return stage === "import" ? 1 : stage === "draft" ? 2 : 3;
}

function MaterialCards({ copy, materials, activeMaterialId, candidateDate, activeReviewState, onSelect, onRetry }: {
  copy: Messages["sourceInbox"];
  materials: MaterialCard[];
  activeMaterialId: string | null;
  candidateDate: string;
  activeReviewState: { reviewedFingerprint: string | null; approvedFingerprint: string | null; rejectedFingerprint: string | null };
  onSelect: (material: MaterialCard) => void;
  onRetry: (material: MaterialCard) => void;
}) {
  return <section className="workbench-section material-cards" aria-label={copy.materialCards}>
    <div className="workbench-section-heading"><h2>{copy.materialCards}</h2><p>{copy.maxBatch}</p></div>
    <div className="material-card-grid">
      {materials.map((material, index) => {
        const status = material.status === "captured" ? copy.materialCaptured : material.status === "manual_only" ? copy.materialManual : material.status === "failed" ? copy.materialFailed : copy.materialPending;
        const isActive = material.id === activeMaterialId;
        const reviewFingerprint = JSON.stringify({ form: material.form, date: candidateDate });
        const reviewState = getReviewGateState(
          reviewFingerprint,
          isActive ? activeReviewState.reviewedFingerprint : material.reviewedFingerprint ?? null,
          isActive ? activeReviewState.approvedFingerprint : material.approvedFingerprint ?? null,
          isActive ? activeReviewState.rejectedFingerprint : material.rejectedFingerprint ?? null,
        );
        const reviewLabel = reviewState.review_status === "reviewed" ? copy.reviewed
          : reviewState.review_status === "rejected" ? copy.rejected : copy.notReviewed;
        const approvalLabel = reviewState.approval_status === "approved" ? copy.approved : copy.notApproved;
        const nextStep = material.status === "pending"
          ? copy.materialNextFetch
          : material.status === "failed"
            ? copy.materialNextFetch
            : material.status === "manual_only" || !material.form?.body.trim()
              ? copy.materialNextPaste
              : material.form.analysisStatus === "draft"
                ? copy.materialNextReview
                : material.form.analysisStatus === "failed"
                  ? copy.materialNextRetry
                  : material.form.analysisStatus === "processing"
                    ? copy.analysisProcessing
                    : copy.materialNextAnalyze;
        return <article className={material.id === activeMaterialId ? "material-card active" : "material-card"} key={material.id}>
          <div className="material-card-heading">
            <strong>#{index + 1} {material.title}</strong>
            <div className="material-card-statuses">
              <span className={`status-pill status-${material.status}`}>{status}</span>
              <span className={`status-pill status-${reviewState.review_status}`}>{reviewLabel}</span>
              <span className={`status-pill status-${reviewState.approval_status}`}>{approvalLabel}</span>
            </div>
          </div>
          <p>{material.sourceUrl || material.input.slice(0, 140)}</p>
          <p className="material-next-step"><strong>{copy.materialNextStep}：</strong>{nextStep}</p>
          {material.error ? <p className="field-hint">{copy.fetchFailure}</p> : null}
          <div className="action-row">
            {material.status === "failed" ? <button type="button" className="primary-button" onClick={() => onRetry(material)}>{copy.retryFetch}</button> : null}
            {material.status !== "failed" && material.status !== "pending" && material.form ? <button type="button" className="primary-button" onClick={() => onSelect(material)}>{material.status === "manual_only" ? copy.pasteBodyRecovery : copy.selectMaterial}</button> : null}
          </div>
        </article>;
      })}
    </div>
  </section>;
}

function ImportPanel({ copy, mode, value, sourceUrl, isFetching, isHydrated, onModeChange, onValueChange, onSourceUrlChange, onSubmit, onImportFile, onImportError }: {
  copy: Messages["sourceInbox"];
  mode: InputMode;
  value: string;
  sourceUrl: string;
  isFetching: boolean;
  isHydrated: boolean;
  onModeChange: (mode: InputMode) => void;
  onValueChange: (value: string) => void;
  onSourceUrlChange: (value: string) => void;
  onSubmit: () => void;
  onImportFile: (value: string, fileName: string) => void;
  onImportError: (message: string) => void;
}) {
  return (
    <section className="workbench-section import-panel">
      <div className="workbench-section-heading"><h2>{copy.inputTitle}</h2><p>{copy.inputHint}</p></div>
      <div className="input-mode-tabs" role="tablist" aria-label={copy.inputTitle}>
        <button type="button" className={mode === "url" ? "filter-chip active" : "filter-chip"} onClick={() => onModeChange("url")}>{copy.pasteUrl}</button>
        <button type="button" className={mode === "text" ? "filter-chip active" : "filter-chip"} onClick={() => onModeChange("text")}>{copy.pasteText}</button>
      </div>
      {mode === "url" ? (
        <>
          <TextField id="import-url" label={copy.mainInputUrl} value={value} onChange={onValueChange} placeholder={copy.urlPlaceholder} type="url" disabled={!isHydrated} />
          <p className="field-hint">{copy.urlInputHint}</p>
        </>
      ) : (
        <>
          <TextAreaField id="import-body" label={copy.mainInputText} value={value} onChange={onValueChange} placeholder={copy.inputPlaceholder} rows={11} disabled={!isHydrated} />
          <TextField id="import-source-url" label={copy.optionalUrl} optional value={sourceUrl} onChange={onSourceUrlChange} placeholder={copy.urlPlaceholder} type="url" disabled={!isHydrated} />
          <p className="field-hint">{copy.textInputHint} {copy.optionalUrlHint}</p>
        </>
      )}
      <label className={`secondary-button file-button${!isHydrated ? " disabled" : ""}`}>{copy.uploadMaterial}<input disabled={!isHydrated} type="file" accept=".txt,.md,.markdown,.srt,.vtt,text/plain,text/markdown" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) {
          if (file.size > MAX_INTAKE_TEXT_BYTES) onImportError("The text file exceeds 1 MiB. Please paste a shorter excerpt.");
          else void file.text().then((text) => onImportFile(text, file.name)).catch(() => onImportError("Unable to read the UTF-8 text file. Paste the transcript or text instead."));
        }
        event.currentTarget.value = "";
      }} /></label>
      <div className="stage-actions">
        <button type="button" className="primary-button" disabled={!isHydrated || isFetching || !value.trim()} onClick={onSubmit}>
          {isFetching ? copy.fetching : mode === "url" ? copy.extractUrl : copy.makeDraft}
        </button>
      </div>
    </section>
  );
}

function DraftPanel({ copy, form, candidateDate, draftOrigin, sourceParagraphs, intakeEvidenceCandidates, sourceDomain, onUpdate, onDateChange, onSelectEvidence, onRetryFetch, onPasteBody, onAnalyze, isAnalyzing, analysisErrorMessage, evidenceIssueLocations }: {
  copy: Messages["sourceInbox"];
  form: WorkbenchFormState;
  candidateDate: string;
  draftOrigin: DraftOrigin;
  sourceParagraphs: string[];
  intakeEvidenceCandidates: IntakeEvidenceSelection[];
  sourceDomain: string;
  onUpdate: <K extends keyof WorkbenchFormState>(field: K, value: WorkbenchFormState[K]) => void;
  onDateChange: (value: string) => void;
  onSelectEvidence: (value: string, candidate?: IntakeEvidenceSelection) => void;
  onRetryFetch: () => void;
  onPasteBody: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  analysisErrorMessage: string;
  evidenceIssueLocations: ReturnType<typeof summariseAnalysisEvidenceIssueLocations>;
}) {
  const readingStatusCopy = form.analysisStatus === "draft"
    ? copy.readingNeedsReview
    : form.analysisStatus === "processing"
      ? copy.analysisProcessing
      : form.analysisStatus === "failed"
        ? copy.analysisFailedStatus
        : copy.readingRuleDraft;

  return (
    <section className="workbench-section draft-panel">
      <div className="workbench-section-heading"><p className="eyebrow">{copy.draftTitle}</p><h2>{copy.draftTitle}</h2><p>{copy.draftHint}</p></div>
      <section className="radar-reading-card" aria-label={copy.readingTitle}>
        <p className="radar-reading-eyebrow">{copy.readingTitle} · {readingStatusCopy}</p>
        <h3>{form.sourceTitle || copy.readingUntitled}</h3>
        {form.summary ? <p className="radar-reading-lead">{form.summary}</p> : <p className="field-hint">{copy.readingEmptyHint}</p>}
        {lines(form.keyPoints).length ? <div className="radar-reading-group"><strong>{copy.readingKeyPoints}</strong><ul>{lines(form.keyPoints).slice(0, 5).map((point,index)=><li key={index}>{point}</li>)}</ul></div> : null}
        {form.whyItMatters ? <div className="radar-reading-group"><strong>{copy.readingWhy}</strong><p>{form.whyItMatters}</p></div> : null}
        {form.aiPmImplication ? <div className="radar-reading-group"><strong>{copy.readingImplication}</strong><p>{form.aiPmImplication}</p></div> : null}
        <p className="radar-reading-disclaimer">{copy.readingDisclaimer}</p>
        <p className="radar-reading-source-note">{copy.readingCoverageNote}（{form.body.length.toLocaleString()} {copy.readingBodyCharacters}）</p>
        <div className="action-row radar-reading-actions">
          <button type="button" className="secondary-button" onClick={() => {
            const details = document.getElementById("enrichment-fields") as HTMLDetailsElement | null;
            if (!details) return;
            details.open = true;
            details.scrollIntoView({ behavior: "smooth", block: "start" });
          }}>{copy.readingEditSummary}</button>
        </div>
      </section>
      <details className="workbench-details radar-source-settings">
        <summary>{copy.sourceDetailsToggle}</summary>
      <FormSection title={copy.sourceSection} hint={copy.sourceSectionHint}>
        <div className="form-grid">
          <TextField id="source-title" label={copy.sourceTitle} value={form.sourceTitle} onChange={(value) => onUpdate("sourceTitle", value)} />
          <TextField id="source-url" label={copy.sourceUrl} optional value={form.sourceUrl} onChange={(value) => { onUpdate("sourceUrl", value); onUpdate("finalUrl", value); }} type="url" />
          <TextField id="creator" label={copy.creator} optional value={form.creator} onChange={(value) => onUpdate("creator", value)} />
          <TextField id="language" label={copy.language} optional value={form.language} onChange={(value) => onUpdate("language", value)} />
          <TextField id="published-at" label={copy.publishedAt} optional value={form.publishedAt} onChange={(value) => onUpdate("publishedAt", value)} type="date" />
          <TextField id="description" label={copy.description} optional value={form.description} onChange={(value) => onUpdate("description", value)} />
        </div>
        {form.sourceTitle === provisionalTitle(form.body) ? <p className="field-hint">{copy.provisionalTitle}</p> : null}
        {sourceDomain ? <p className="field-hint">{copy.finalUrl}：{sourceDomain}（{copy.domainHint}）</p> : null}
        {draftOrigin === "manual" && form.sourceUrl ? <div className="recovery-actions" role="group" aria-label={copy.recovery}><p className="field-hint">{copy.recoveryHint}</p><div className="action-row"><button type="button" className="secondary-button" onClick={onRetryFetch}>{copy.retryFetch}</button><button type="button" className="secondary-button" onClick={onPasteBody}>{copy.pasteBodyRecovery}</button></div></div> : null}
        {draftOrigin === "extracted" && (!form.creator || !form.publishedAt) ? <p className="field-hint">{copy.partialMetadata}</p> : null}
        <div className="metadata-grid">
          <ReadOnlyMeta label={copy.originalUrl} value={form.originalUrl || "—"} />
          <ReadOnlyMeta label={copy.finalUrl} value={form.finalUrl || form.sourceUrl || "—"} />
          <ReadOnlyMeta label={copy.capturedAt} value={form.capturedAt || "—"} />
          <ReadOnlyMeta label={copy.metadataSource} value={draftOrigin === "extracted" ? copy.extracted : copy.manual} />
        </div>
        <TextAreaField id="source-body" label={copy.body} required hint={copy.bodyHint} value={form.body} onChange={(value) => onUpdate("body", value)} rows={11} />
      </FormSection>

      <FormSection title={copy.evidenceSection} hint={copy.evidenceHint}>
        {intakeEvidenceCandidates.length > 0 ? <div className="source-preview" aria-label="Evidence location candidates">
          <p className="field-hint">Suggested original-language quotes with source locators. Select and verify each quote; not automatically reviewed or approved.</p>
          {intakeEvidenceCandidates.map((candidate) => <button
            type="button"
            className={form.evidenceReference === candidate.exactQuote ? "source-paragraph selected" : "source-paragraph"}
            key={candidate.chunkId}
            onClick={() => onSelectEvidence(candidate.exactQuote, candidate)}
            title={candidate.locator}
          ><strong>{candidate.locator}</strong> · {candidate.exactQuote.slice(0, 240)}</button>)}
        </div> : null}
        <label className="form-field" htmlFor="evidence-picker"><FieldLabel label={copy.selectEvidence} optional={false} /><select id="evidence-picker" value={form.evidenceReference} onChange={(event) => onSelectEvidence(event.target.value)}><option value="">{copy.noEvidenceSelection}</option>{sourceParagraphs.map((paragraph, index) => <option key={`${index}-${paragraph}`} value={paragraph}>#{index + 1} {paragraph.slice(0, 100)}</option>)}</select></label>
        <div className="source-preview" aria-label={copy.sourceTextPreview}>{sourceParagraphs.map((paragraph, index) => <button type="button" className={form.evidenceReference === paragraph ? "source-paragraph selected" : "source-paragraph"} key={`${index}-${paragraph}`} onClick={() => onSelectEvidence(paragraph)}><span>#{index + 1}</span>{paragraph}</button>)}</div>
        <p className="field-hint">{copy.evidencePrefill}</p>
        <div className="form-grid">
          <TextField id="evidence-source" label={copy.evidenceSource} optional value={form.evidenceSource} onChange={(value) => onUpdate("evidenceSource", value)} />
          <TextField id="evidence-timestamp" label={copy.evidenceTimestamp} optional value={form.evidenceTimestamp} onChange={(value) => onUpdate("evidenceTimestamp", value)} />
          <TextAreaField id="evidence-reference" label={copy.evidenceReference} optional placeholder={copy.evidencePlaceholder} value={form.evidenceReference} onChange={(value) => onUpdate("evidenceReference", value)} />
        </div>
      </FormSection>
      </details>

      <section className="workbench-subsection analysis-section" id="analysis-section">
        <div className="workbench-section-heading"><h3>{copy.analysisTitle}</h3><p>{copy.analysisBoundary}</p></div>
        <div className="status-row"><StatusPill label={copy.analysisStatus} value={form.analysisStatus === "draft" ? copy.analysisDraft : form.analysisStatus === "failed" ? copy.analysisFailedStatus : form.analysisStatus === "processing" ? copy.analysisProcessing : copy.analysisNotRequested} tone={form.analysisStatus} />{form.analysisModel ? <span className="field-hint">{form.analysisModel}</span> : null}{form.analysisUsage ? <span className="field-hint">{copy.analysisUsage}: {form.analysisUsage}</span> : null}</div>
        {form.analysisError === "method_points_omitted" ? <p className="warning-message" role="status">{copy.analysisMethodOmitted}</p> : form.analysisError ? <p className="warning-message">{analysisErrorMessage}</p> : null}
        {form.analysisError === "evidence_not_found" ? <div className="field-hint" role="status">
          {evidenceIssueLocations.length > 0 ? <p>{copy.analysisEvidenceLocations}: {evidenceIssueLocations.map((location) => location.kind === "method"
            ? `${copy.analysisEvidenceMethod} #${location.index}`
            : `${copy.analysisEvidenceClaim} #${location.index}, ${copy.analysisEvidenceCitation} #${location.evidenceIndex}`).join(" · ")}</p> : null}
          <p>{copy.analysisEvidenceRecovery}</p>
        </div> : null}
        <div className="action-row"><button type="button" className="primary-button" disabled={isAnalyzing || !form.body.trim() || form.body.length > MAX_ANALYSIS_INPUT_CHARS} onClick={onAnalyze}>{isAnalyzing ? copy.analysisProcessing : copy.analysisButton}</button></div>
        <details className="workbench-details radar-secondary-analysis">
          <summary>{copy.advancedAnalysisToggle}</summary>
        <div className="form-grid">
          <TextAreaField id="source-facts" label={copy.sourceFacts} value={form.sourceFacts} onChange={(value) => onUpdate("sourceFacts", value)} rows={4} />
          <TextAreaField id="method-or-teaching-points" label={copy.methodOrTeachingPoints} value={form.methodOrTeachingPoints} onChange={(value) => onUpdate("methodOrTeachingPoints", value)} rows={4} />
          <TextAreaField id="analysis-inferences" label={copy.analysisInferences} value={form.analysisInferences} onChange={(value) => onUpdate("analysisInferences", value)} rows={4} />
        </div>
        </details>
        {form.claimEvidence.length > 0 ? <section className="claim-evidence-section" aria-label={copy.claimEvidence}>
          <h4>{copy.claimEvidence}</h4>
          <p className="field-hint">{copy.claimEvidenceHint}</p>
          <div className="claim-evidence-list">
            {form.claimEvidence.map((claim, index) => <details className="claim-evidence-item" key={`${index}-${claim.claim}`}>
              <summary>{claim.claim}</summary>
              {claim.evidence.length > 0 ? claim.evidence.map((evidence) => <blockquote key={`${evidence.source}-${evidence.timestamp ?? "none"}-${evidence.text_reference}`}>
                {evidence.text_reference}
                <footer>{evidence.source}{evidence.timestamp ? ` · ${evidence.timestamp}` : ""}</footer>
              </blockquote>) : <p className="field-hint">{copy.claimEvidenceMissing}</p>}
            </details>)}
          </div>
        </section> : null}
      </section>

      <details className="workbench-details" id="enrichment-fields">
        <summary>{copy.enrichmentSection}</summary>
        <p className="field-hint">{copy.enrichmentHint}</p>
        <div className="form-grid">
          <TextAreaField id="key-points" label={copy.keyPoints} value={form.keyPoints} onChange={(value) => onUpdate("keyPoints", value)} />
          <TextAreaField id="key-claims" label={copy.keyClaims} value={form.keyClaims} onChange={(value) => onUpdate("keyClaims", value)} />
          <TextAreaField id="summary" label={copy.summary} value={form.summary} onChange={(value) => onUpdate("summary", value)} />
          <TextAreaField id="why-it-matters" label={copy.whyItMatters} value={form.whyItMatters} onChange={(value) => onUpdate("whyItMatters", value)} />
          <TextAreaField id="business-implication" label={copy.businessImplication} value={form.businessImplication} onChange={(value) => onUpdate("businessImplication", value)} />
          <TextAreaField id="ai-pm-implication" label={copy.aiPmImplication} value={form.aiPmImplication} onChange={(value) => onUpdate("aiPmImplication", value)} />
          <TextAreaField id="video-implication" label={copy.videoImplication} optional value={form.videoImplication} onChange={(value) => onUpdate("videoImplication", value)} />
          <TextAreaField id="content-ideas" label={copy.contentIdeas} value={form.contentIdeas} onChange={(value) => onUpdate("contentIdeas", value)} />
          <TextAreaField id="uncertainties" label={copy.uncertainties} value={form.uncertainties} onChange={(value) => onUpdate("uncertainties", value)} />
          <TextAreaField id="topic-tags" label={copy.topicTags} value={form.topicTags} onChange={(value) => onUpdate("topicTags", value)} />
          <TextAreaField id="trend-tags" label={copy.trendTags} value={form.trendTags} onChange={(value) => onUpdate("trendTags", value)} />
          <TextField id="confidence" label={copy.confidence} optional type="number" min="0" max="1" step="0.1" value={form.confidence} onChange={(value) => onUpdate("confidence", value)} />
          <SelectField id="evidence-grade" label={copy.evidenceGrade} value={form.evidenceGrade} onChange={(value) => onUpdate("evidenceGrade", value as EvidenceGrade)} options={["ungraded", "A", "B", "C"]} />
        </div>
        <div className="checkbox-row">
          <label className="checkbox-label"><input type="checkbox" checked={form.caseCandidate} onChange={(event) => onUpdate("caseCandidate", event.target.checked)} /><span>{copy.caseCandidate}</span></label>
          <fieldset className="library-fieldset"><legend>{copy.libraryTargets}</legend><div className="checkbox-grid">{SOURCE_LIBRARIES.map((library) => <label key={library} className="checkbox-label"><input type="checkbox" checked={form.libraryTargets.includes(library)} onChange={(event) => onUpdate("libraryTargets", event.target.checked ? [...form.libraryTargets, library] : form.libraryTargets.filter((item) => item !== library))} /><span>{library}</span></label>)}</div></fieldset>
        </div>
      </details>

      <details className="workbench-details">
        <summary>{copy.dailySection}</summary>
        <p className="field-hint">{copy.dailyHint}</p>
        <div className="form-grid" id="daily-fields">
          <TextField id="question-title" label={copy.questionTitle} value={form.questionTitle} onChange={(value) => onUpdate("questionTitle", value)} />
          <TextField id="short-title" label={copy.shortTitle} value={form.shortTitle} onChange={(value) => onUpdate("shortTitle", value)} />
          <TextField id="category" label={copy.category} value={form.category} onChange={(value) => onUpdate("category", value)} />
          <TextAreaField id="daily-tags" label={copy.dailyTags} value={form.dailyTags} onChange={(value) => onUpdate("dailyTags", value)} />
          <TextField id="impact-score" label={copy.impactScore} optional type="number" min="1" max="10" value={form.impactScore} onChange={(value) => onUpdate("impactScore", value)} />
          <TextField id="relevance-score" label={copy.relevanceScore} optional type="number" min="1" max="10" value={form.relevanceScore} onChange={(value) => onUpdate("relevanceScore", value)} />
          <TextField id="trust-score" label={copy.trustScore} optional type="number" min="1" max="10" value={form.trustScore} onChange={(value) => onUpdate("trustScore", value)} />
          <TextField id="candidate-date" label={copy.chooseDate} required type="date" value={candidateDate} onChange={onDateChange} />
        </div>
        <p className="field-hint">{copy.jsonKeysHint}</p>
      </details>
    </section>
  );
}

function ReviewPanel({ copy, record, onUpdate, blockers, isReady, reviewStatus, approvalStatus, approvedFingerprint, fingerprint, candidateFileName, sourceRecordFileName, onBack, onMarkReviewed, onReject, onApproveAndDownload, isApprovingCandidate, onApproveSourceForReuse, reusableSourceBlockers, reusableSourceSaved, reusableSourceSaving, reusableSourceError, onDownloadCandidate, onDownloadSourceRecord, onReset }: {
  copy: Messages["sourceInbox"];
  record: SourceRecord;
  onUpdate: <K extends keyof WorkbenchFormState>(field: K, value: WorkbenchFormState[K]) => void;
  blockers: string[];
  isReady: boolean;
  reviewStatus: string;
  approvalStatus: string;
  approvedFingerprint: string | null;
  fingerprint: string;
  candidateFileName: string;
  sourceRecordFileName: string;
  onBack: () => void;
  onMarkReviewed: () => void;
  onReject: () => void;
  onApproveAndDownload: () => void;
  isApprovingCandidate: boolean;
  onApproveSourceForReuse: () => void;
  reusableSourceBlockers: string[];
  reusableSourceSaved: boolean;
  reusableSourceSaving: boolean;
  reusableSourceError: boolean;
  onDownloadCandidate: () => void;
  onDownloadSourceRecord: () => void;
  onReset: () => void;
}) {
  const canMarkReviewed = reviewStatus !== "reviewed";
  const canApproveAndDownload = reviewStatus === "reviewed" && blockers.every((reason) => reason.includes("not explicitly approved"));
  return (
    <section className="workbench-section review-panel" id="review-section">
      <div className="workbench-section-heading"><p className="eyebrow">{copy.reviewTitle}</p><h2>{copy.reviewTitle}</h2><p>{copy.reviewHint}</p></div>
      <div className="radar-review-article">
        <p className="radar-reading-eyebrow">{copy.readingTitle} · {copy.readingNeedsReview}</p>
        <h3>{record.title}</h3>
        <p>{record.summary || copy.readingEmptyHint}</p>
        {record.key_claims.length ? <details className="workbench-details"><summary>{copy.reviewEvidenceToggle} ({record.key_claims.length})</summary>
          <div className="claim-evidence-list">{record.key_claims.map((claim,index)=><div key={index} className="radar-review-claim"><strong>{claim.claim}</strong>{claim.evidence.map((ref,index)=><blockquote key={index}>{ref.text_reference}</blockquote>)}</div>)}</div>
        </details> : null}
      </div>
      <div className="status-panel"><div><strong>{copy.currentState}</strong><div className="status-row"><StatusPill label={copy.reviewStatus} value={reviewStatus === "reviewed" ? copy.reviewed : reviewStatus === "rejected" ? copy.rejected : copy.notReviewed} tone={reviewStatus} /><StatusPill label={copy.approvalStatus} value={approvalStatus === "approved" ? copy.approved : copy.notApproved} tone={approvalStatus} /></div></div><p className="status-boundary">{copy.approvalBoundary}</p></div>
      {approvedFingerprint !== null && approvedFingerprint !== fingerprint ? <p className="warning-message">{copy.editRequired}</p> : null}
      <section className="radar-review-essentials" aria-label={copy.reviewEssentialsTitle}>
        <div><h3>{copy.reviewEssentialsTitle}</h3><p className="field-hint">{copy.reviewEssentialsHint}</p></div>
        <div className="form-grid">
          <div className="radar-source-name-field">
            <TextField id="creator" label={copy.creator} value={record.creator ?? ""} onChange={(value) => onUpdate("creator", value)} />
            {sourceWebsiteName(record.source_url ?? "") && !record.creator
              ? <button type="button" className="secondary-button" onClick={() => onUpdate("creator", sourceWebsiteName(record.source_url ?? ""))}>{copy.fillSourceDomain}</button>
              : null}
            {record.creator && record.creator === sourceWebsiteName(record.source_url ?? "") ? <p className="field-hint">{copy.sourceDomainProvenance}</p> : null}
          </div>
          <SelectField id="evidence-grade" label={copy.evidenceGrade} value={record.evidence_grade} onChange={(value) => onUpdate("evidenceGrade", value as EvidenceGrade)} options={["ungraded", "A", "B", "C"]} />
        </div>
        <p className="field-hint">{copy.reviewGradeHint}</p>
      </section>
      <div className="radar-review-next" role="status">{reviewStatus === "reviewed" ? copy.reviewNextApproval : copy.reviewNextReview}</div>
      <div className="action-row">
        <button type="button" className="secondary-button" onClick={onBack}>{copy.backToEdit}</button>
        <button type="button" className="secondary-button" onClick={onMarkReviewed} disabled={!canMarkReviewed}>{copy.markReviewed}</button>
        <button type="button" className="secondary-button danger-button" onClick={onReject}>{copy.reject}</button>
        <button type="button" className="primary-button" onClick={onApproveAndDownload} disabled={!canApproveAndDownload || isApprovingCandidate}>{isApprovingCandidate ? copy.savingLocally : copy.approveAndDownload}</button>
      </div>
      <details className="workbench-details radar-reuse-optional">
        <summary>{copy.reviewReuseToggle}</summary>
      <section className="workbench-subsection source-library-approval" aria-labelledby="source-library-approval-title">
        <h3 id="source-library-approval-title">{copy.approveForReuse}</h3>
        <p className="field-hint">{copy.reuseApprovalBoundary}</p>
        <p className="field-hint">{copy.reusePrerequisites}</p>
        {reusableSourceBlockers.length > 0 ? <ul className="validation-list">{reusableSourceBlockers.map((reason) => <li key={reason}>{localReusableBlocker(reason, copy)}</li>)}</ul> : null}
        <button type="button" className="secondary-button" onClick={onApproveSourceForReuse} disabled={reviewStatus !== "reviewed" || reusableSourceBlockers.length > 0 || reusableSourceSaved || reusableSourceSaving}>
          {reusableSourceSaving ? copy.savingLocally : reusableSourceSaved ? copy.approved : copy.approveForReuse}
        </button>
        {reusableSourceSaved ? <p className="ready-message" role="status">{copy.reuseSaved}</p> : null}
        {reusableSourceError ? <p className="blocked-message" role="status">{copy.reuseSaveError}</p> : null}
      </section>
      </details>
      <p className="field-hint">{copy.notSaved}</p>
      <div className={isReady ? "ready-message" : "blocked-message"} role="status"><strong>{isReady ? copy.outputReady : copy.outputBlocked}</strong>{!isReady ? <p>{copy.downloadUnavailable}</p> : null}</div>
      {blockers.length > 0 ? <ul className="validation-list">{blockers.map((reason) => <li key={reason}><a href={`#${blockerId(reason)}`}>{formatSourceInboxBlocker(reason, copy.validation, copy.invalidDate)}</a></li>)}</ul> : null}
      <p className="field-hint">{copy.traceHint}</p>
      <div className="action-row">
        <button type="button" className="primary-button" disabled={!isReady} onClick={onDownloadCandidate}>{copy.downloadCandidate}</button>
        <button type="button" className="secondary-button" onClick={onDownloadSourceRecord}>{copy.downloadSourceRecord}</button>
        <button type="button" className="secondary-button" onClick={onReset}>{copy.reset}</button>
      </div>
      <p className="field-hint">{copy.resetHint}</p>
    </section>
  );
}

function FormSection({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <section className="workbench-subsection"><div className="workbench-section-heading"><h3>{title}</h3><p>{hint}</p></div><div className="stack-md">{children}</div></section>;
}

function FieldLabel({ label, required, optional }: { label: string; required?: boolean; optional?: boolean }) {
  const { messages } = useLanguage();
  return <span className="field-label"><span>{label}</span>{required ? <small>*</small> : optional ? <em>{messages.sourceInbox.optional}</em> : null}</span>;
}

function TextField({ id, label, value, onChange, type = "text", required, optional, placeholder, min, max, step, disabled }: { id?: string; label: string; value?: string; onChange: (value: string) => void; type?: string; required?: boolean; optional?: boolean; placeholder?: string; min?: string; max?: string; step?: string; disabled?: boolean }) {
  return <label className="form-field" htmlFor={id}><FieldLabel label={label} required={required} optional={optional} /><input id={id} type={type} required={required} disabled={disabled} value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} min={min} max={max} step={step} /></label>;
}

function TextAreaField({ id, label, value, onChange, hint, required, optional, placeholder, rows = 4, disabled }: { id?: string; label: string; value: string; onChange: (value: string) => void; hint?: string; required?: boolean; optional?: boolean; placeholder?: string; rows?: number; disabled?: boolean }) {
  return <label className="form-field" htmlFor={id}><FieldLabel label={label} required={required} optional={optional} /><textarea id={id} required={required} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} />{hint ? <span className="field-hint">{hint}</span> : null}</label>;
}

function SelectField({ id, label, value, onChange, options, required }: { id?: string; label: string; value: string; onChange: (value: string) => void; options: string[]; required?: boolean }) {
  return <label className="form-field" htmlFor={id}><FieldLabel label={label} required={required} /><select id={id} required={required} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function ReadOnlyMeta({ label, value }: { label: string; value: string }) {
  return <div className="readonly-meta"><strong>{label}</strong><code>{value}</code></div>;
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <span className={`status-pill status-${tone}`}><strong>{label}</strong> {value}</span>;
}
