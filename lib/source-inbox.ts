export const SOURCE_PLATFORMS = [
  "manual",
  "x",
  "youtube",
  "bilibili",
  "telegram",
] as const;

export type SourcePlatform = (typeof SOURCE_PLATFORMS)[number];

export const SOURCE_LIBRARIES = [
  "trend",
  "case",
  "creator",
  "video_reference",
  "content_idea",
] as const;

export type SourceLibrary = (typeof SOURCE_LIBRARIES)[number];

export const SOURCE_INPUT_KINDS = [
  "manual_url",
  "paste_text",
  "paste_transcript",
  "markdown",
  "txt",
  "srt",
  "vtt",
  "forwarded_content",
] as const;

export type SourceInputKind = (typeof SOURCE_INPUT_KINDS)[number];

export type SourceType =
  | "url"
  | "text"
  | "transcript"
  | "markdown"
  | "txt"
  | "srt"
  | "vtt"
  | "forwarded_content";

export type TranscriptOrigin =
  | "none"
  | "user_pasted"
  | "uploaded_subtitle"
  | "user_owned_media"
  | "official_api"
  | "collector_bot";

export type AccessMethod =
  | "direct_input"
  | "manual_url"
  | "official_api"
  | "collector_bot"
  | "metadata_probe"
  | "manual_fallback";

export type ReviewStatus = "needs_review" | "reviewed" | "rejected";
export type ApprovalStatus = "not_approved" | "approved";
export type EvidenceGrade = "ungraded" | "A" | "B" | "C";

export const SOURCE_RECORD_VERSION = 2;

export type MaterialStatus = "captured" | "needs_manual_input" | "capture_failed";
export type AnalysisStatus = "not_requested" | "processing" | "draft" | "failed";
export type AnalysisProvider = "none" | "openai_responses" | "gemini" | "ollama" | "openrouter";

export type AnalysisUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export type SourceAnalysisState = {
  version: 1;
  status: AnalysisStatus;
  provider: AnalysisProvider;
  model: string | null;
  analyzed_at: string | null;
  input_chars: number;
  usage: AnalysisUsage | null;
  error_code: string | null;
  source_facts: string[];
  inferences: string[];
  use_cases: string[];
  method_or_teaching_points?: string[];
};

export type EvidenceItem = {
  source: string;
  timestamp: string | null;
  text_reference: string;
};

export type KeyClaim = {
  claim: string;
  evidence: EvidenceItem[];
};

export function mergeEditableKeyClaims(
  claimTexts: string[],
  preservedClaims: KeyClaim[],
  sharedEvidence: EvidenceItem[],
): KeyClaim[] {
  const preservedPrimary = preservedClaims.flatMap((claim) => claim.evidence)[0] ?? null;
  const currentPrimary = sharedEvidence[0] ?? null;
  const sharedEvidenceUnchanged = preservedPrimary === null && currentPrimary === null
    || preservedPrimary !== null && currentPrimary !== null
      && preservedPrimary.source === currentPrimary.source
      && preservedPrimary.timestamp === currentPrimary.timestamp
      && preservedPrimary.text_reference === currentPrimary.text_reference;
  return claimTexts.map((claim, index) => {
    const preserved = preservedClaims[index];
    if (sharedEvidenceUnchanged && preserved?.claim === claim) {
      return { claim, evidence: preserved.evidence.map((item) => ({ ...item })) };
    }
    return { claim, evidence: sharedEvidence.map((item) => ({ ...item })) };
  });
}

export type TimestampMarker = {
  label: string;
  start_seconds: number | null;
  end_seconds: number | null;
  text_reference: string | null;
};

export type VisualMoment = {
  description: string;
  timestamp: string | null;
  evidence_text: string | null;
};

export type SourceRecord = {
  record_version: typeof SOURCE_RECORD_VERSION;
  id: string;
  platform: SourcePlatform;
  source_type: SourceType;
  source_url: string | null;
  source_url_original?: string | null;
  source_url_final?: string | null;
  collection?: SourceCollectionProvenance;
  creator: string | null;
  title: string | null;
  description: string | null;
  published_at: string | null;
  captured_at: string;
  language: string;
  raw_text: string;
  transcript: string | null;
  transcript_origin: TranscriptOrigin;
  access_method: AccessMethod;
  summary: string | null;
  key_points: string[];
  key_claims: KeyClaim[];
  timestamps: TimestampMarker[];
  visual_moments: VisualMoment[];
  story_patterns: string[];
  style_features: string[];
  why_it_matters: string | null;
  business_implication: string | null;
  ai_pm_implication: string | null;
  video_implication: string | null;
  content_ideas: string[];
  case_candidate: boolean;
  library_targets: SourceLibrary[];
  trend_tags: string[];
  topic_tags: string[];
  confidence: number;
  evidence_grade: EvidenceGrade;
  evidence: EvidenceItem[];
  uncertainties: string[];
  rights_note: string;
  material_status: MaterialStatus;
  analysis: SourceAnalysisState;
  review_status: ReviewStatus;
  approval_status: ApprovalStatus;
};

export type AdapterCapabilities = {
  metadata_supported: boolean;
  text_supported: boolean;
  transcript_supported: boolean;
  media_supported: boolean;
  auth_required: boolean;
  manual_fallback: boolean;
};

export type AdapterContext = {
  now?: string;
  env?: Record<string, string | undefined>;
};

export type AdapterAvailability = {
  status: "enabled" | "disabled" | "manual_only";
  reason?: string;
};

export type SourceAdapterResult = {
  record: SourceRecord;
  adapter: string;
  fallback_used: boolean;
  warnings: string[];
  fallback_options: string[];
};

export type SourceInput = {
  value: string;
  kind?: SourceInputKind;
  fileName?: string;
  capturedText?: string;
  accessMethod?: AccessMethod;
  sourceUrl?: string;
  originalSourceUrl?: string;
  finalSourceUrl?: string;
  platform?: SourcePlatform;
  creator?: string;
  title?: string;
  description?: string;
  publishedAt?: string;
  capturedAt?: string;
  language?: string;
  transcriptOrigin?: TranscriptOrigin;
  collection?: SourceCollectionProvenance;
};

export type SourceCollectionProvenance = {
  version: 1;
  feed_url: string;
  source_id: string;
  item_id: string;
  content_kind: "metadata" | "summary" | "feed_content";
  discovered_at: string;
  feed_updated_at: string | null;
};

export type SubtitleCue = {
  start: string;
  end: string;
  text: string;
};

export type SourceAdapter = {
  name: string;
  platform: SourcePlatform;
  stability: "stable" | "experimental";
  capabilities: AdapterCapabilities;
  canHandle: (input: SourceInput) => boolean;
  availability: (context?: AdapterContext) => AdapterAvailability;
  adapt: (input: SourceInput, context?: AdapterContext) => SourceAdapterResult;
};

export const MANUAL_FALLBACK_OPTIONS = [
  "Paste transcript",
  "Paste text",
  "Upload subtitle",
  "Add notes",
] as const;

const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const URL_LIKE_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;
const RIGHTS_NOTE =
  "Rights and reuse permissions not assessed; review before publishing or repurposing.";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value) || !HTTP_URL_PATTERN.test(value.trim())) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function toStableId(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `src_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function getEnvironment(context?: AdapterContext) {
  return context?.env ?? (typeof process === "undefined" ? {} : process.env);
}

function parseTimestamp(value: string) {
  const match = value.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);

  if (minutes > 59 || seconds > 59) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function toSeconds(value: string) {
  const parsed = parseTimestamp(value);
  return parsed === null ? null : Number(parsed.toFixed(3));
}

export function parseSubtitle(content: string, format?: "srt" | "vtt") {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const cues: SubtitleCue[] = [];
  let index = 0;

  while (index < lines.length) {
    const current = lines[index].trim();

    if (!current || (format === "vtt" && current === "WEBVTT")) {
      index += 1;
      continue;
    }

    if (format === "vtt" && /^(NOTE|STYLE|REGION)\b/i.test(current)) {
      index += 1;
      while (index < lines.length && lines[index].trim() !== "") {
        index += 1;
      }
      continue;
    }

    let timestampLine = current;
    if (!timestampLine.includes("-->") && lines[index + 1]?.includes("-->")) {
      index += 1;
      timestampLine = lines[index].trim();
    }

    const timestampMatch = timestampLine.match(
      /^([^\s]+)\s+-->\s+([^\s]+)(?:\s+.*)?$/,
    );

    if (!timestampMatch) {
      index += 1;
      continue;
    }

    const textLines: string[] = [];
    index += 1;
    while (index < lines.length && lines[index].trim() !== "") {
      textLines.push(lines[index].trim());
      index += 1;
    }

    const text = textLines.join(" ").replace(/<[^>]+>/g, "").trim();
    if (text) {
      cues.push({
        start: timestampMatch[1],
        end: timestampMatch[2],
        text,
      });
    }
  }

  return {
    cues,
    text: cues.map((cue) => cue.text).join(" "),
  };
}

export function detectPlatformFromUrl(value: string | null | undefined): SourcePlatform {
  if (!isValidHttpUrl(value)) {
    return "manual";
  }

  const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");

  if (hostname === "x.com" || hostname === "twitter.com") {
    return "x";
  }

  if (hostname === "youtube.com" || hostname === "youtu.be" || hostname.endsWith(".youtube.com")) {
    return "youtube";
  }

  if (hostname === "bilibili.com" || hostname === "b23.tv" || hostname.endsWith(".bilibili.com")) {
    return "bilibili";
  }

  if (hostname === "t.me" || hostname === "telegram.me" || hostname.endsWith(".telegram.org")) {
    return "telegram";
  }

  return "manual";
}

export function detectInputKind(value: string, fileName?: string): SourceInputKind {
  const extension = fileName?.toLowerCase().split(".").pop();

  if (extension === "srt" || extension === "vtt" || extension === "md" || extension === "markdown" || extension === "txt") {
    return extension === "md" || extension === "markdown" ? "markdown" : extension;
  }

  if (isValidHttpUrl(value)) {
    return "manual_url";
  }

  if (/^\s*WEBVTT(?:\s|$)/i.test(value)) {
    return "vtt";
  }

  if (/^\s*(?:\d+\s*\n)?\s*\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->\s+/m.test(value)) {
    return "srt";
  }

  if (/^\s*#\s+.+/m.test(value)) {
    return "markdown";
  }

  return "paste_text";
}

export type SourceEntryMode = "url" | "text";

/**
 * Selects the initial collection mode without discarding mixed input.
 * A URL batch is only treated as URL input when every non-empty line is a
 * valid HTTP(S) URL; any other content stays available as text for review.
 */
export function detectSourceEntryMode(value: string): SourceEntryMode {
  const entries = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return entries.length > 0 && entries.every((entry) => isValidHttpUrl(entry)) ? "url" : "text";
}

function sourceTypeFor(kind: SourceInputKind): SourceType {
  if (kind === "manual_url") {
    return "url";
  }

  if (kind === "paste_text") {
    return "text";
  }

  if (kind === "paste_transcript") {
    return "transcript";
  }

  return kind;
}

function defaultTranscriptOrigin(kind: SourceInputKind): TranscriptOrigin {
  if (kind === "srt" || kind === "vtt") {
    return "uploaded_subtitle";
  }

  if (kind === "paste_transcript") {
    return "user_pasted";
  }

  return "none";
}

function titleFromMarkdown(value: string) {
  return value.match(/^\s*#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function buildSourceRecord(
  input: SourceInput,
  context: AdapterContext | undefined,
  overrides: {
    accessMethod?: AccessMethod;
    fallbackReason?: string;
  } = {},
): SourceAdapterResult {
  const value = typeof input.value === "string" ? input.value : String(input.value ?? "");
  const kind = input.kind ?? detectInputKind(value, input.fileName);
  const capturedAtCandidate = input.capturedAt ?? context?.now ?? new Date().toISOString();
  const capturedAt = Number.isNaN(Date.parse(capturedAtCandidate))
    ? new Date().toISOString()
    : new Date(capturedAtCandidate).toISOString();
  const suppliedUrl = input.sourceUrl ?? (kind === "manual_url" ? value.trim() : null);
  const originalSourceUrl = input.originalSourceUrl ?? suppliedUrl;
  const finalSourceUrl = input.finalSourceUrl ?? suppliedUrl;
  const sourceUrl = isValidHttpUrl(finalSourceUrl) ? finalSourceUrl.trim() : null;
  const platform = input.platform ?? detectPlatformFromUrl(sourceUrl);
  const subtitle = kind === "srt" || kind === "vtt" ? parseSubtitle(value, kind) : null;
  const transcript =
    kind === "paste_transcript" || subtitle
      ? subtitle?.text ?? value.trim()
      : null;
  const rawText = input.capturedText ?? (kind === "manual_url" ? input.description ?? "" : value);
  const publishedAt = input.publishedAt && !Number.isNaN(Date.parse(input.publishedAt))
    ? new Date(input.publishedAt).toISOString()
    : null;
  const warnings: string[] = [];

  if (!value.trim()) {
    warnings.push("Input is empty; record created for review but cannot be enriched yet.");
  }

  if ((kind === "manual_url" || input.sourceUrl) && !sourceUrl) {
    warnings.push("Source URL is invalid or unavailable; use a manual fallback with notes or text.");
  }

  if ((kind === "srt" || kind === "vtt") && subtitle && subtitle.cues.length === 0) {
    warnings.push("Subtitle file contains no parseable cues; review the file or paste the transcript.");
  }

  if (input.publishedAt && !publishedAt) {
    warnings.push("Published time is invalid and was left empty for manual review.");
  }

  if (overrides.fallbackReason) {
    warnings.push(overrides.fallbackReason);
  }

  const seed = [platform, kind, sourceUrl ?? "", value, input.title ?? ""].join("|");
  const adapter = input.accessMethod ?? (overrides.fallbackReason ? "manual_fallback" : overrides.accessMethod ?? "direct_input");
  const record: SourceRecord = {
    record_version: SOURCE_RECORD_VERSION,
    id: toStableId(seed),
    platform,
    source_type: sourceTypeFor(kind),
    source_url: sourceUrl,
    source_url_original: isValidHttpUrl(originalSourceUrl) ? originalSourceUrl.trim() : null,
    source_url_final: sourceUrl,
    collection: input.collection,
    creator: input.creator?.trim() || null,
    title: input.title?.trim() || (kind === "markdown" ? titleFromMarkdown(value) : null),
    description: input.description?.trim() || null,
    published_at: publishedAt,
    captured_at: capturedAt,
    language: input.language?.trim() || "und",
    raw_text: rawText,
    transcript,
    transcript_origin: transcript ? input.transcriptOrigin ?? defaultTranscriptOrigin(kind) : "none",
    access_method: adapter,
    summary: null,
    key_points: [],
    key_claims: [],
    timestamps: subtitle
      ? subtitle.cues.map((cue) => ({
          label: cue.text.slice(0, 80),
          start_seconds: toSeconds(cue.start),
          end_seconds: toSeconds(cue.end),
          text_reference: cue.text,
        }))
      : [],
    visual_moments: [],
    story_patterns: [],
    style_features: [],
    why_it_matters: null,
    business_implication: null,
    ai_pm_implication: null,
    video_implication: null,
    content_ideas: [],
    case_candidate: false,
    library_targets: [],
    trend_tags: [],
    topic_tags: [],
    confidence: 0,
    evidence_grade: "ungraded",
    evidence: [],
    uncertainties: [],
    rights_note: RIGHTS_NOTE,
    material_status: rawText.trim() || transcript ? "captured" : "needs_manual_input",
    analysis: {
      version: 1,
      status: "not_requested",
      provider: "none",
      model: null,
      analyzed_at: null,
      input_chars: 0,
      usage: null,
      error_code: null,
      source_facts: [],
      inferences: [],
      use_cases: [],
      method_or_teaching_points: [],
    },
    review_status: "needs_review",
    approval_status: "not_approved",
  };

  return {
    record,
    adapter: platform,
    fallback_used: Boolean(overrides.fallbackReason),
    warnings,
    fallback_options: [...MANUAL_FALLBACK_OPTIONS],
  };
}

function makeAdapter(
  definition: Omit<SourceAdapter, "adapt"> & {
    fallbackReason?: (context?: AdapterContext) => string | null;
  },
): SourceAdapter {
  return {
    ...definition,
    adapt(input, context) {
      const reason = definition.fallbackReason?.(context) ?? null;
      return buildSourceRecord(input, context, {
        accessMethod: reason ? "manual_fallback" : undefined,
        fallbackReason: reason ?? undefined,
      });
    },
  };
}

export const manualAdapter = makeAdapter({
  name: "Manual Input Adapter",
  platform: "manual",
  stability: "stable",
  capabilities: {
    metadata_supported: true,
    text_supported: true,
    transcript_supported: true,
    media_supported: false,
    auth_required: false,
    manual_fallback: true,
  },
  canHandle: () => true,
  availability: () => ({ status: "enabled" }),
});

export const xAdapter = makeAdapter({
  name: "X Official API Adapter",
  platform: "x",
  stability: "stable",
  capabilities: {
    metadata_supported: true,
    text_supported: true,
    transcript_supported: false,
    media_supported: false,
    auth_required: true,
    manual_fallback: true,
  },
  canHandle: (input) => (input.platform ?? detectPlatformFromUrl(input.sourceUrl ?? input.value)) === "x",
  availability: (context) =>
    getEnvironment(context).X_BEARER_TOKEN
      ? { status: "enabled" }
      : { status: "disabled", reason: "X_BEARER_TOKEN is not configured; manual fallback remains available." },
  fallbackReason: (context) =>
    getEnvironment(context).X_BEARER_TOKEN
      ? null
      : "X official API adapter is disabled because credentials are unavailable; input preserved for manual fallback.",
});

export const telegramAdapter = makeAdapter({
  name: "Telegram Collector Bot Adapter",
  platform: "telegram",
  stability: "stable",
  capabilities: {
    metadata_supported: true,
    text_supported: true,
    transcript_supported: true,
    media_supported: true,
    auth_required: true,
    manual_fallback: true,
  },
  canHandle: (input) =>
    (input.platform ?? detectPlatformFromUrl(input.sourceUrl ?? input.value)) === "telegram" ||
    input.kind === "forwarded_content",
  availability: (context) =>
    getEnvironment(context).TELEGRAM_BOT_TOKEN
      ? { status: "enabled" }
      : { status: "disabled", reason: "TELEGRAM_BOT_TOKEN is not configured; use forwarded content or manual fallback." },
  fallbackReason: (context) =>
    getEnvironment(context).TELEGRAM_BOT_TOKEN
      ? null
      : "Telegram collector bot is not configured; arbitrary public-channel scraping is not supported.",
});

export const youtubeAdapter = makeAdapter({
  name: "YouTube Metadata Adapter",
  platform: "youtube",
  stability: "stable",
  capabilities: {
    metadata_supported: true,
    text_supported: true,
    transcript_supported: true,
    media_supported: false,
    auth_required: false,
    manual_fallback: true,
  },
  canHandle: (input) => (input.platform ?? detectPlatformFromUrl(input.sourceUrl ?? input.value)) === "youtube",
  availability: () => ({ status: "manual_only", reason: "Metadata and user-supplied descriptions/transcripts only in P0." }),
});

export const bilibiliAdapter = makeAdapter({
  name: "Bilibili Metadata Adapter",
  platform: "bilibili",
  stability: "experimental",
  capabilities: {
    metadata_supported: true,
    text_supported: true,
    transcript_supported: true,
    media_supported: false,
    auth_required: false,
    manual_fallback: true,
  },
  canHandle: (input) => (input.platform ?? detectPlatformFromUrl(input.sourceUrl ?? input.value)) === "bilibili",
  availability: () => ({ status: "manual_only", reason: "Safe URL metadata and user-supplied transcript/subtitle only in P0." }),
});

export const sourceAdapters: SourceAdapter[] = [
  xAdapter,
  telegramAdapter,
  youtubeAdapter,
  bilibiliAdapter,
  manualAdapter,
];

export function getAdapterForInput(input: SourceInput) {
  return sourceAdapters.find((adapter) => adapter.canHandle(input)) ?? manualAdapter;
}

export function normaliseSourceInput(input: SourceInput, context?: AdapterContext): SourceAdapterResult {
  const kind = input.kind ?? detectInputKind(input.value, input.fileName);
  return getAdapterForInput({ ...input, kind }).adapt({ ...input, kind }, context);
}

export const normalizeSourceInput = normaliseSourceInput;

export function validateSourceInput(input: SourceInput) {
  const issues: string[] = [];
  const value = typeof input.value === "string" ? input.value : "";
  const kind = input.kind ?? detectInputKind(value, input.fileName);

  if (!isNonEmptyString(value)) {
    issues.push("Input value must be a non-empty string.");
  }

  if (!SOURCE_INPUT_KINDS.includes(kind)) {
    issues.push(`Unsupported source input kind: ${String(kind)}.`);
  }

  if ((kind === "manual_url" || input.sourceUrl) && !isValidHttpUrl(input.sourceUrl ?? value)) {
    issues.push("Source URL must be a valid http or https URL.");
  }

  return issues;
}

export function validateSourceRecord(record: SourceRecord) {
  const issues: string[] = [];

  if (!isNonEmptyString(record.id)) {
    issues.push("id must be a non-empty string.");
  }

  if (record.record_version !== SOURCE_RECORD_VERSION) {
    issues.push(`record_version must be ${SOURCE_RECORD_VERSION}.`);
  }

  if (!("captured" === record.material_status || "needs_manual_input" === record.material_status || "capture_failed" === record.material_status)) {
    issues.push("material_status is invalid.");
  }

  if (!record.analysis || record.analysis.version !== 1) {
    issues.push("analysis must use version 1.");
  } else if (!("not_requested" === record.analysis.status || "processing" === record.analysis.status || "draft" === record.analysis.status || "failed" === record.analysis.status)) {
    issues.push("analysis.status is invalid.");
  }

  if (!SOURCE_PLATFORMS.includes(record.platform)) {
    issues.push(`Unsupported platform: ${String(record.platform)}.`);
  }

  if (record.source_url !== null && !isValidHttpUrl(record.source_url)) {
    issues.push("source_url must be null or a valid http/https URL.");
  }

  for (const field of ["source_url_original", "source_url_final"] as const) {
    const value = record[field];
    if (value !== undefined && value !== null && !isValidHttpUrl(value)) {
      issues.push(`${field} must be null or a valid http/https URL.`);
    }
  }

  if (record.collection) {
    if (record.collection.version !== 1 || !isValidHttpUrl(record.collection.feed_url)) {
      issues.push("collection provenance must contain a valid feed URL and version 1.");
    }
    if (!isNonEmptyString(record.collection.source_id) || !isNonEmptyString(record.collection.item_id)) {
      issues.push("collection provenance must contain source_id and item_id.");
    }
    if (Number.isNaN(Date.parse(record.collection.discovered_at))) {
      issues.push("collection.discovered_at must be a valid ISO date.");
    }
  }

  if (Number.isNaN(Date.parse(record.captured_at))) {
    issues.push("captured_at must be a valid ISO date.");
  }

  if (record.confidence < 0 || record.confidence > 1 || !Number.isFinite(record.confidence)) {
    issues.push("confidence must be a number between 0 and 1.");
  }

  if (!isNonEmptyString(record.rights_note)) {
    issues.push("rights_note must explain the reuse review boundary.");
  }

  if ((record.review_status as string) === "verified") {
    issues.push("review_status cannot be verified; human review must remain explicit.");
  }

  if (!(["needs_review", "reviewed", "rejected"] as string[]).includes(record.review_status)) {
    issues.push("review_status must be needs_review, reviewed, or rejected.");
  }

  if (!(["not_approved", "approved"] as string[]).includes(record.approval_status)) {
    issues.push("approval_status must be not_approved or approved.");
  }

  for (const evidence of record.evidence) {
    if (!isNonEmptyString(evidence.source)) {
      issues.push("Every evidence item must contain a source.");
    }
    if (!isNonEmptyString(evidence.text_reference)) {
      issues.push("Every evidence item must contain a text_reference.");
    }
  }

  for (const claim of record.key_claims) {
    if (!isNonEmptyString(claim.claim)) {
      issues.push("Every key claim must contain claim text.");
    }
    if (claim.evidence.length === 0) {
      issues.push(`Key claim lacks provenance: ${claim.claim || "[empty claim]"}.`);
    }
    for (const evidence of claim.evidence) {
      if (!isNonEmptyString(evidence.source) || !isNonEmptyString(evidence.text_reference)) {
        issues.push(`Key claim has incomplete provenance: ${claim.claim || "[empty claim]"}.`);
      }
    }
  }

  return issues;
}
