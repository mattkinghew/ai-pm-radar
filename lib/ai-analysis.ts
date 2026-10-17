import type {
  AnalysisUsage,
  SourceAnalysisState,
  SourceRecord,
} from "./source-inbox.ts";

export const AI_ANALYSIS_VERSION = 1 as const;
export const MAX_ANALYSIS_INPUT_CHARS = 30_000;

export type AnalysisEvidence = {
  source: string;
  timestamp: string;
  text_reference: string;
};

export type ScoreSuggestion = {
  value: number;
  rationale: string;
};

export type AIAnalysisDraft = {
  summary: string;
  why_it_matters: string;
  source_facts: string[];
  key_points: string[];
  method_or_teaching_points: string[];
  key_claims: Array<{ claim: string; evidence: AnalysisEvidence[] }>;
  business_implication: string;
  ai_pm_implication: string;
  use_cases: string[];
  content_ideas: string[];
  uncertainties: string[];
  suggested_title: string;
  question_title: string;
  short_title: string;
  category: string;
  daily_tags: string[];
  tags: string[];
  confidence: number;
  impact_score: ScoreSuggestion;
  relevance_score: ScoreSuggestion;
  trust_score: ScoreSuggestion;
};

export type AnalysisValidationResult =
  | { valid: true }
  | { valid: false; issues: string[] };

export type AnalysisSourceSnapshot = {
  source_id: string;
  source_version: string;
  text: string;
};

function normaliseEvidenceText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalisedTextWithSourceMap(value: string) {
  const parts: Array<{ text: string; start: number; end: number }> = [];
  for (const match of value.matchAll(/\S+/gu)) {
    const text = match[0];
    const start = match.index ?? 0;
    parts.push({ text, start, end: start + text.length });
  }
  const text = parts.map((part) => part.text).join(" ");
  const sourceRanges: Array<{ start: number; end: number }> = [];
  parts.forEach((part, index) => {
    if (index > 0) {
      const previous = parts[index - 1];
      sourceRanges.push({ start: previous.end, end: part.start });
    }
    for (let offset = 0; offset < part.text.length;) {
      const character = part.text[offset];
      const characterLength = character.codePointAt(0)! > 0xffff ? 2 : 1;
      for (let unit = 0; unit < characterLength; unit += 1) {
        sourceRanges.push({ start: part.start + offset, end: part.start + offset + characterLength });
      }
      offset += characterLength;
    }
  });
  return { text, sourceRanges };
}

export function findAnalysisEvidence(sourceText: string, reference: string) {
  const body = normalisedTextWithSourceMap(sourceText);
  const evidenceText = normaliseEvidenceText(reference);
  if (!evidenceText) return null;
  const normalisedStart = body.text.indexOf(evidenceText);
  if (normalisedStart < 0) return null;
  const normalisedEnd = normalisedStart + evidenceText.length;
  const startRange = body.sourceRanges[normalisedStart];
  const endRange = body.sourceRanges[normalisedEnd - 1];
  if (!startRange || !endRange) return null;
  return {
    source_start: startRange.start,
    source_end: endRange.end,
    text_reference: sourceText.slice(startRange.start, endRange.end),
  };
}

export function summariseAnalysisEvidenceIssueLocations(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ kind: "claim" | "method"; index: number; evidenceIndex?: number }>;
  const locations: Array<{ kind: "claim" | "method"; index: number; evidenceIndex?: number }> = [];
  for (const issue of value) {
    if (!issue || typeof issue !== "object" || typeof issue.path !== "string") continue;
    const method = /^\$\.method_or_teaching_points\[(\d+)\]$/.exec(issue.path);
    const claim = /^\$\.key_claims\[(\d+)\]\.evidence\[(\d+)\]\.text_reference$/.exec(issue.path);
    if (method) locations.push({ kind: "method", index: Number(method[1]) + 1 });
    if (claim) locations.push({ kind: "claim", index: Number(claim[1]) + 1, evidenceIndex: Number(claim[2]) + 1 });
  }
  return locations.slice(0, 6);
}

export function sourceTextForAnalysis(record: SourceRecord) {
  return record.transcript || record.raw_text || "";
}

function sourceTextVersion(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v1-${(hash >>> 0).toString(16)}-${value.length}`;
}

export function createAnalysisSourceSnapshot(record: SourceRecord): AnalysisSourceSnapshot {
  const text = sourceTextForAnalysis(record);
  return { source_id: record.id, source_version: sourceTextVersion(text), text };
}

export function isAnalysisSourceSnapshotCurrent(record: SourceRecord, snapshot: AnalysisSourceSnapshot) {
  const current = createAnalysisSourceSnapshot(record);
  return current.source_id === snapshot.source_id
    && current.source_version === snapshot.source_version
    && current.text === snapshot.text;
}

function hasStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasScoreSuggestion(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const suggestion = value as Record<string, unknown>;
  return typeof suggestion.value === "number"
    && suggestion.value >= 1
    && suggestion.value <= 10
    && typeof suggestion.rationale === "string"
    && suggestion.rationale.trim().length > 0;
}

function reportUnexpectedKeys(value: Record<string, unknown>, allowed: string[], path: string, issues: string[]) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push(`AI output field ${path}.${key} is not allowed.`);
  }
}

export function validateAIAnalysisDraft(draft: unknown, sourceText: string): AnalysisValidationResult {
  const issues: string[] = [];
  if (!draft || typeof draft !== "object") {
    return { valid: false, issues: ["AI output is not an object."] };
  }

  const value = draft as Record<string, unknown>;
  const stringFields = [
    "summary",
    "why_it_matters",
    "business_implication",
    "ai_pm_implication",
    "suggested_title",
    "question_title",
    "short_title",
    "category",
  ];
  const arrayFields = ["source_facts", "key_points", "method_or_teaching_points", "use_cases", "content_ideas", "uncertainties", "tags", "daily_tags"];
  reportUnexpectedKeys(value, [...stringFields, ...arrayFields, "key_claims", "confidence", "impact_score", "relevance_score", "trust_score"], "$", issues);
  for (const field of stringFields) {
    if (typeof value[field] !== "string") issues.push(`AI output field ${field} must be text.`);
  }

  if (Array.isArray(value.method_or_teaching_points)) {
    for (const [index, point] of value.method_or_teaching_points.entries()) {
      if (typeof point === "string" && point.trim() && !findAnalysisEvidence(sourceText, point)) {
        issues.push(`AI output method_or_teaching_points[${index}] does not exist in the source.`);
      }
    }
  }
  for (const field of arrayFields) {
    if (!hasStringArray(value[field])) issues.push(`AI output field ${field} must be a string array.`);
  }
  if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) {
    issues.push("AI output confidence must be between 0 and 1.");
  }
  for (const field of ["impact_score", "relevance_score", "trust_score"]) {
    if (value[field] && typeof value[field] === "object") {
      reportUnexpectedKeys(value[field] as Record<string, unknown>, ["value", "rationale"], `$.${field}`, issues);
    }
    if (!hasScoreSuggestion(value[field])) issues.push(`AI output field ${field} must include a 1-10 value and rationale.`);
  }

  if (!Array.isArray(value.key_claims)) {
    issues.push("AI output key_claims must be an array.");
  } else {
    for (const [index, claim] of value.key_claims.entries()) {
      if (!claim || typeof claim !== "object") {
        issues.push(`AI output key_claims[${index}] is invalid.`);
        continue;
      }
      const item = claim as Record<string, unknown>;
      reportUnexpectedKeys(item, ["claim", "evidence"], `$.key_claims[${index}]`, issues);
      if (typeof item.claim !== "string" || !item.claim.trim()) {
        issues.push(`AI output key_claims[${index}] has no claim text.`);
      }
      if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
        issues.push(`AI output key_claims[${index}] has no evidence.`);
        continue;
      }
      for (const [evidenceIndex, evidence] of item.evidence.entries()) {
        if (!evidence || typeof evidence !== "object") {
          issues.push(`AI output key_claims[${index}].evidence[${evidenceIndex}] is invalid.`);
          continue;
        }
        const itemEvidence = evidence as Record<string, unknown>;
        reportUnexpectedKeys(itemEvidence, ["source", "timestamp", "text_reference"], `$.key_claims[${index}].evidence[${evidenceIndex}]`, issues);
        if (typeof itemEvidence.source !== "string" || !itemEvidence.source.trim()) {
          issues.push(`AI output key_claims[${index}] evidence has no source.`);
        }
        if (typeof itemEvidence.text_reference !== "string" || !itemEvidence.text_reference.trim()) {
          issues.push(`AI output key_claims[${index}] evidence has no text reference.`);
        } else if (!findAnalysisEvidence(sourceText, itemEvidence.text_reference)) {
          issues.push(`AI output evidence at $.key_claims[${index}].evidence[${evidenceIndex}].text_reference does not exist in the source.`);
        }
        if (typeof itemEvidence.timestamp !== "string") {
          issues.push(`AI output key_claims[${index}] evidence timestamp must be text.`);
        }
      }
    }
  }

  return issues.length > 0 ? { valid: false, issues } : { valid: true };
}

export function canonicaliseAIAnalysisEvidence(draft: AIAnalysisDraft, sourceText: string): AIAnalysisDraft {
  return {
    ...draft,
    method_or_teaching_points: draft.method_or_teaching_points.map((point) => findAnalysisEvidence(sourceText, point)?.text_reference ?? point),
    key_claims: draft.key_claims.map((claim) => ({
      ...claim,
      evidence: claim.evidence.map((item) => {
        const match = findAnalysisEvidence(sourceText, item.text_reference);
        return match ? { ...item, text_reference: match.text_reference } : item;
      }),
    })),
  };
}

export function applyAIAnalysisDraft(
  record: SourceRecord,
  draft: AIAnalysisDraft,
  metadata: {
    provider: "openai_responses" | "gemini";
    model: string;
    analyzedAt: string;
    usage: AnalysisUsage | null;
  },
): SourceRecord {
  const validation = validateAIAnalysisDraft(draft, sourceTextForAnalysis(record));
  if (!validation.valid) {
    throw new Error(validation.issues.join(" "));
  }
  const canonicalDraft = canonicaliseAIAnalysisEvidence(draft, sourceTextForAnalysis(record));
  const evidence = canonicalDraft.key_claims.flatMap((claim) => claim.evidence.map((item) => ({
    source: item.source,
    timestamp: item.timestamp.trim() || null,
    text_reference: item.text_reference,
  })));
  const uniqueEvidence = evidence.filter((item, index, all) =>
    all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item)) === index,
  );
  const analysis: SourceAnalysisState = {
    version: AI_ANALYSIS_VERSION,
    status: "draft",
    provider: metadata.provider,
    model: metadata.model,
    analyzed_at: metadata.analyzedAt,
    input_chars: sourceTextForAnalysis(record).length,
    usage: metadata.usage,
    error_code: null,
    source_facts: canonicalDraft.source_facts,
    inferences: [canonicalDraft.business_implication, canonicalDraft.ai_pm_implication, ...canonicalDraft.use_cases],
    use_cases: canonicalDraft.use_cases,
    method_or_teaching_points: canonicalDraft.method_or_teaching_points.map((point) => findAnalysisEvidence(sourceTextForAnalysis(record), point)?.text_reference ?? point),
  };
  return {
    ...record,
    summary: canonicalDraft.summary,
    why_it_matters: canonicalDraft.why_it_matters,
    key_points: canonicalDraft.key_points,
    key_claims: canonicalDraft.key_claims.map((claim) => ({
      claim: claim.claim,
      evidence: claim.evidence.map((item) => ({
        source: item.source,
        timestamp: item.timestamp.trim() || null,
        text_reference: item.text_reference,
      })),
    })),
    business_implication: canonicalDraft.business_implication,
    ai_pm_implication: canonicalDraft.ai_pm_implication,
    content_ideas: canonicalDraft.content_ideas,
    uncertainties: canonicalDraft.uncertainties,
    confidence: canonicalDraft.confidence,
    evidence_grade: "ungraded",
    evidence: uniqueEvidence,
    analysis,
    review_status: "needs_review",
    approval_status: "not_approved",
  };
}

export function markAnalysisFailed(record: SourceRecord, code: string): SourceRecord {
  return {
    ...record,
    analysis: {
      ...record.analysis,
      status: "failed",
      provider: record.analysis.provider,
      error_code: code,
      analyzed_at: null,
    },
    review_status: "needs_review",
    approval_status: "not_approved",
  };
}
