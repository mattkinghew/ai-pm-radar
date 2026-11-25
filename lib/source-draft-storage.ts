export const SOURCE_DRAFT_STORAGE_VERSION = 1 as const;

export type PersistedSourceDrafts<T> = {
  version: typeof SOURCE_DRAFT_STORAGE_VERSION;
  saved_at: string;
  items: T[];
};

export function serializeSourceDrafts<T>(items: T[], savedAt = new Date().toISOString()) {
  return JSON.stringify({
    version: SOURCE_DRAFT_STORAGE_VERSION,
    saved_at: savedAt,
    items,
  });
}

export function parseSourceDrafts<T>(value: string): PersistedSourceDrafts<T> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("Draft backup must be a JSON object.");
  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== SOURCE_DRAFT_STORAGE_VERSION) throw new Error("Unsupported draft backup version.");
  if (!Array.isArray(candidate.items)) throw new Error("Draft backup items must be an array.");
  if (typeof candidate.saved_at !== "string" || Number.isNaN(Date.parse(candidate.saved_at))) {
    throw new Error("Draft backup saved_at must be an ISO date.");
  }
  return candidate as PersistedSourceDrafts<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isOptionalNullableString(record: Record<string, unknown>, key: string): boolean {
  return !Object.prototype.hasOwnProperty.call(record, key) || record[key] === null || typeof record[key] === "string";
}

const FORM_STRING_FIELDS = [
  "sourceTitle", "sourceUrl", "originalUrl", "finalUrl", "creator", "description", "publishedAt", "capturedAt", "language", "body",
  "evidenceSource", "evidenceTimestamp", "evidenceReference", "keyPoints", "keyClaims", "summary", "whyItMatters", "businessImplication",
  "aiPmImplication", "videoImplication", "contentIdeas", "uncertainties", "topicTags", "trendTags", "confidence", "questionTitle",
  "shortTitle", "category", "dailyTags", "impactScore", "relevanceScore", "trustScore", "sourceFacts", "methodOrTeachingPoints",
  "analysisInferences", "analysisError", "analysisModel", "analysisAnalyzedAt", "analysisUsage",
] as const;

function isEvidenceItem(value: unknown): boolean {
  return isRecord(value)
    && typeof value.source === "string"
    && (value.timestamp === null || typeof value.timestamp === "string")
    && typeof value.text_reference === "string";
}

function isCollectionProvenance(value: unknown): boolean {
  return isRecord(value)
    && value.version === 1
    && typeof value.feed_url === "string"
    && typeof value.source_id === "string"
    && typeof value.item_id === "string"
    && (value.content_kind === "metadata" || value.content_kind === "summary" || value.content_kind === "feed_content")
    && typeof value.discovered_at === "string"
    && (value.feed_updated_at === null || typeof value.feed_updated_at === "string");
}

function isWorkbenchForm(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  for (const key of FORM_STRING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(value, key) && typeof value[key] !== "string") return false;
  }
  const enums: Record<string, readonly string[]> = {
    evidenceGrade: ["ungraded", "A", "B", "C"],
    analysisStatus: ["not_requested", "processing", "draft", "failed"],
    analysisProvider: ["none", "openai_responses", "gemini", "ollama", "openrouter"],
    accessMethod: ["direct_input", "manual_url", "official_api", "collector_bot", "metadata_probe", "manual_fallback"],
    sourceKind: ["paste_text", "markdown", "txt", "srt", "vtt"],
  };
  for (const [key, values] of Object.entries(enums)) {
    if (Object.prototype.hasOwnProperty.call(value, key) && !values.includes(String(value[key]))) return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, "claimEvidence")
    && (!Array.isArray(value.claimEvidence) || !value.claimEvidence.every((claim) => isRecord(claim)
      && typeof claim.claim === "string" && Array.isArray(claim.evidence) && claim.evidence.every(isEvidenceItem)))) return false;
  if (Object.prototype.hasOwnProperty.call(value, "libraryTargets")
    && (!Array.isArray(value.libraryTargets) || !value.libraryTargets.every((target) => ["trend", "case", "creator", "video_reference", "content_idea"].includes(String(target))))) return false;
  if (Object.prototype.hasOwnProperty.call(value, "caseCandidate") && typeof value.caseCandidate !== "boolean") return false;
  if (Object.prototype.hasOwnProperty.call(value, "collection") && !isCollectionProvenance(value.collection)) return false;
  return true;
}

function isMaterialCard(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id || typeof value.input !== "string") return false;
  if (!(value.status === "pending" || value.status === "captured" || value.status === "manual_only" || value.status === "failed")) return false;
  if (typeof value.title !== "string" || typeof value.sourceUrl !== "string" || typeof value.error !== "string") return false;
  if (value.form !== null && !isWorkbenchForm(value.form)) return false;
  for (const key of ["reviewedFingerprint", "approvedFingerprint", "approvalSeal", "rejectedFingerprint"]) {
    if (!isOptionalNullableString(value, key)) return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, "researchImport")
    && (!isRecord(value.researchImport)
      || typeof value.researchImport.source_version !== "string"
      || typeof value.researchImport.result_version !== "number"
      || typeof value.researchImport.imported_fingerprint !== "string")) return false;
  return true;
}

export function isWorkbenchDraftItem<T>(value: T): value is T & Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (!(value.stage === "import" || value.stage === "draft" || value.stage === "review")) return false;
  if (!(value.inputMode === "url" || value.inputMode === "text")) return false;
  if (typeof value.inputValue !== "string" || typeof value.candidateDate !== "string" || !isWorkbenchForm(value.form)) return false;
  if (!Array.isArray(value.materials)) return false;
  if (value.activeMaterialId !== undefined && value.activeMaterialId !== null && typeof value.activeMaterialId !== "string") return false;
  for (const key of ["reviewedFingerprint", "approvedFingerprint", "approvalSeal", "rejectedFingerprint"]) {
    if (!isOptionalNullableString(value, key)) return false;
  }
  return value.materials.every(isMaterialCard);
}
