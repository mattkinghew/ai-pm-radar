import type { EvidenceItem, SourceRecord } from "./source-inbox.ts";
import { getReusableSourceBlockers, sourceRecordFingerprint, type SourceLibraryEntry } from "./source-library.ts";

export const HANDOFF_SCHEMA_VERSION = 2 as const;

export const HANDOFF_TYPES = [
  "content_candidate",
  "learning_pack",
  "creative_reference",
  "case_reference",
] as const;

export type HandoffType = (typeof HANDOFF_TYPES)[number];
export type HandoffStatus = "draft" | "needs_review" | "approved";

export type HandoffEvidenceReference = {
  id: string;
  source_record_id: string;
  evidence_index: number;
  text_reference: string;
  source: string;
  timestamp: string | null;
};

export type HandoffSourceFact = {
  text: string;
  evidence_reference_ids: string[];
};

export type ContentCandidate = {
  target_audience: string;
  content_angles: string[];
  key_source_backed_claims: string[];
  hooks: string[];
  content_themes: string[];
  suggested_formats: string[];
  platform_considerations: string[];
  unknowns_and_risks: string[];
};

export type LearningPack = {
  learning_objectives: string[];
  concepts: string[];
  definitions: string[];
  examples: string[];
  misconceptions: string[];
  question_seeds: string[];
  difficulty_suggestion: string;
  review_focus: string[];
  unknowns: string[];
};

export type CreativeReference = {
  themes: string[];
  concepts: string[];
  visual_motifs: string[];
  tone: string;
  story_possibilities: string[];
  character_or_worldbuilding_inspiration: string[];
  factual_anchors: string[];
  usage_notes: string[];
  uncertainty: string[];
};

export type CaseReference = {
  source_or_organisation_context: string;
  observed_problem: string;
  workflow: string[];
  pain_points: string[];
  ai_or_automation_opportunities: string[];
  risks: string[];
  dependencies: string[];
  governance_considerations: string[];
  assumptions: string[];
  unknowns: string[];
};

export type HandoffPayloadByType = {
  content_candidate: ContentCandidate;
  learning_pack: LearningPack;
  creative_reference: CreativeReference;
  case_reference: CaseReference;
};

export type BaseHandoff<T extends HandoffType = HandoffType> = {
  id: string;
  type: T;
  schema_version: typeof HANDOFF_SCHEMA_VERSION;
  source_record_id: string;
  source_fingerprint: string;
  created_at: string;
  updated_at: string;
  target_product: "content_ops" | "cyber_kuma" | "storyworld" | "diagnostic";
  source_url: string | null;
  source_provenance: {
    source_url_original: string | null;
    source_url_final: string | null;
    captured_at: string;
    access_method: SourceRecord["access_method"];
  };
  source_facts: HandoffSourceFact[];
  evidence_references: HandoffEvidenceReference[];
  derived_analysis: HandoffPayloadByType[T];
  human_notes: string;
  status: HandoffStatus;
  reviewed_at: string | null;
  approved_at: string | null;
  approval_fingerprint: string | null;
  // Separate SHA-256 approval binding. Legacy records have no seal and require re-approval before export.
  approval_seal_sha256?: string | null;
};

const PRODUCT_BY_TYPE: Record<HandoffType, BaseHandoff["target_product"]> = {
  content_candidate: "content_ops",
  learning_pack: "cyber_kuma",
  creative_reference: "storyworld",
  case_reference: "diagnostic",
};

function stableHandoffId(sourceId: string, type: HandoffType, createdAt: string) {
  let hash = 2166136261;
  const seed = `${sourceId}:${type}:${createdAt}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `handoff_${type}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableFingerprint(value: unknown) {
  const input = JSON.stringify(value);
  let hash = BigInt("14695981039346656037");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * BigInt("1099511628211"));
  }
  return hash.toString(16).padStart(16, "0");
}

export function handoffContentFingerprint(handoff: BaseHandoff) {
  const {
    status: _status,
    reviewed_at: _reviewedAt,
    approved_at: _approvedAt,
    approval_fingerprint: _approvalFingerprint,
    approval_seal_sha256: _approvalSeal,
    updated_at: _updatedAt,
    ...content
  } = handoff;
  return stableFingerprint(content);
}

export function migrateHandoff(value: unknown): BaseHandoff | null {
  if (!value || typeof value !== "object") return null;
  const handoff = value as Partial<BaseHandoff> & { schema_version?: number };
  if (handoff.schema_version === HANDOFF_SCHEMA_VERSION) return handoff as BaseHandoff;
  if (handoff.schema_version !== 1) return null;
  const migrated: BaseHandoff = {
    ...(handoff as BaseHandoff),
    schema_version: HANDOFF_SCHEMA_VERSION,
    status: handoff.status === "approved" ? "needs_review" : handoff.status as HandoffStatus,
    reviewed_at: handoff.reviewed_at ?? (handoff.status === "approved" ? handoff.approved_at ?? null : null),
    approved_at: null,
    approval_fingerprint: null,
    approval_seal_sha256: null,
  };
  return migrated;
}

function evidenceIdentity(sourceId: string, evidence: EvidenceItem, index: number) {
  return `${sourceId}:e${index}`;
}

function emptyPayload<T extends HandoffType>(type: T): HandoffPayloadByType[T] {
  const payloads: HandoffPayloadByType = {
    content_candidate: {
      target_audience: "", content_angles: [], key_source_backed_claims: [], hooks: [], content_themes: [],
      suggested_formats: [], platform_considerations: [], unknowns_and_risks: ["Unknown — not assessed"],
    },
    learning_pack: {
      learning_objectives: [], concepts: [], definitions: [], examples: [], misconceptions: [], question_seeds: [],
      difficulty_suggestion: "", review_focus: [], unknowns: ["Unknown — not assessed"],
    },
    creative_reference: {
      themes: [], concepts: [], visual_motifs: [], tone: "", story_possibilities: [],
      character_or_worldbuilding_inspiration: [], factual_anchors: [], usage_notes: [], uncertainty: ["Unknown — not assessed"],
    },
    case_reference: {
      source_or_organisation_context: "", observed_problem: "", workflow: [], pain_points: [],
      ai_or_automation_opportunities: [], risks: [], dependencies: [], governance_considerations: [], assumptions: ["Unknown — not assessed"], unknowns: ["Unknown — not assessed"],
    },
  };
  return payloads[type] as HandoffPayloadByType[T];
}

export function createHandoffDraft<T extends HandoffType>(
  entry: SourceLibraryEntry,
  type: T,
  createdAt = new Date().toISOString(),
): BaseHandoff<T> {
  if (!isValidApprovedEntry(entry)) throw new Error("Only an approved, reusable SourceRecord can create an official handoff.");
  if (!HANDOFF_TYPES.includes(type)) throw new Error("Unsupported handoff type.");
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("Handoff creation time must be a valid date.");

  const record = entry.source_record;
  const evidence = collectEvidence(record);
  const evidenceReferences = evidence.map((item, index) => ({
    id: evidenceIdentity(record.id, item, index),
    source_record_id: record.id,
    evidence_index: index,
    text_reference: item.text_reference,
    source: item.source,
    timestamp: item.timestamp,
  }));
  const referencesByText = new Map<string, string[]>();
  evidenceReferences.forEach((reference) => {
    const found = referencesByText.get(reference.text_reference) ?? [];
    found.push(reference.id);
    referencesByText.set(reference.text_reference, found);
  });

  const created = new Date(createdAt).toISOString();
  return {
    id: stableHandoffId(record.id, type, created),
    type,
    schema_version: HANDOFF_SCHEMA_VERSION,
    source_record_id: record.id,
    source_fingerprint: entry.fingerprint,
    created_at: created,
    updated_at: created,
    target_product: PRODUCT_BY_TYPE[type],
    source_url: record.source_url,
    source_provenance: {
      source_url_original: record.source_url_original ?? record.source_url,
      source_url_final: record.source_url_final ?? record.source_url,
      captured_at: record.captured_at,
      access_method: record.access_method,
    },
    source_facts: record.key_claims.map((claim) => ({
      text: claim.claim,
      evidence_reference_ids: [...new Set(claim.evidence.flatMap((item) => referencesByText.get(item.text_reference) ?? []))],
    })),
    evidence_references: evidenceReferences,
    derived_analysis: emptyPayload(type),
    human_notes: "",
    status: "draft",
    reviewed_at: null,
    approved_at: null,
    approval_fingerprint: null,
    approval_seal_sha256: null,
  };
}

function collectEvidence(record: SourceRecord) {
  const seen = new Set<string>();
  const result: EvidenceItem[] = [];
  for (const item of [...record.evidence, ...record.key_claims.flatMap((claim) => claim.evidence)]) {
    const key = JSON.stringify([item.source, item.timestamp, item.text_reference]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...item });
  }
  return result;
}

function isValidApprovedEntry(entry: SourceLibraryEntry) {
  return entry.source_record.review_status === "reviewed"
    && entry.source_record.approval_status === "approved"
    && entry.fingerprint === sourceRecordFingerprint(entry.source_record)
    && getReusableSourceBlockers(entry.source_record).length === 0;
}

function expectedPayloadKeys(type: HandoffType) {
  return Object.keys(emptyPayload(type)) as Array<keyof HandoffPayloadByType[typeof type]>;
}

export function validateHandoff(value: unknown): value is BaseHandoff {
  if (!value || typeof value !== "object") return false;
  const handoff = value as Partial<BaseHandoff>;
  if (!HANDOFF_TYPES.includes(handoff.type as HandoffType)
    || handoff.schema_version !== HANDOFF_SCHEMA_VERSION
    || typeof handoff.id !== "string" || !handoff.id
    || typeof handoff.source_record_id !== "string" || !handoff.source_record_id
    || typeof handoff.source_fingerprint !== "string" || !handoff.source_fingerprint
    || Number.isNaN(Date.parse(handoff.created_at ?? ""))
    || Number.isNaN(Date.parse(handoff.updated_at ?? ""))
    || (handoff.reviewed_at !== null && (typeof handoff.reviewed_at !== "string" || Number.isNaN(Date.parse(handoff.reviewed_at))))
    || (handoff.approved_at !== null && (typeof handoff.approved_at !== "string" || Number.isNaN(Date.parse(handoff.approved_at))))
    || (handoff.source_url !== null && typeof handoff.source_url !== "string")
    || !handoff.source_provenance || typeof handoff.source_provenance !== "object"
    || (handoff.source_provenance.source_url_original !== null && typeof handoff.source_provenance.source_url_original !== "string")
    || (handoff.source_provenance.source_url_final !== null && typeof handoff.source_provenance.source_url_final !== "string")
    || Number.isNaN(Date.parse(handoff.source_provenance.captured_at ?? ""))
    || typeof handoff.source_provenance.access_method !== "string"
    || !["draft", "needs_review", "approved"].includes(handoff.status as string)
    || !Array.isArray(handoff.source_facts)
    || !Array.isArray(handoff.evidence_references)
    || !handoff.derived_analysis || typeof handoff.derived_analysis !== "object"
    || typeof handoff.human_notes !== "string") return false;

  if (handoff.approval_fingerprint !== null && typeof handoff.approval_fingerprint !== "string") return false;
  if (handoff.approval_seal_sha256 != null && !/^[a-f0-9]{64}$/.test(handoff.approval_seal_sha256)) return false;

  const type = handoff.type as HandoffType;
  if (handoff.target_product !== PRODUCT_BY_TYPE[type]) return false;
  const payload = handoff.derived_analysis as Record<string, unknown>;
  const allowedKeys = expectedPayloadKeys(type) as string[];
  if (Object.keys(payload).some((key) => !allowedKeys.includes(key))) return false;
  if (allowedKeys.some((key) => {
    const item = payload[key];
    return typeof item !== "string" && (!Array.isArray(item) || item.some((value) => typeof value !== "string"));
  })) return false;
  if (handoff.source_facts.some((fact) => !fact || typeof fact.text !== "string" || !Array.isArray(fact.evidence_reference_ids))) return false;
  if (handoff.evidence_references.some((reference) => !reference
    || typeof reference.id !== "string"
    || reference.source_record_id !== handoff.source_record_id
    || !Number.isInteger(reference.evidence_index)
    || typeof reference.text_reference !== "string"
    || typeof reference.source !== "string"
    || (reference.timestamp !== null && typeof reference.timestamp !== "string"))) return false;
  if (handoff.source_facts.some((fact) => fact.evidence_reference_ids.some((id) => !handoff.evidence_references?.some((reference) => reference.id === id)))) return false;
  if (handoff.status === "approved" && (!handoff.reviewed_at || !handoff.approved_at || handoff.approval_fingerprint !== handoffContentFingerprint(handoff as BaseHandoff))) return false;
  if (handoff.status === "needs_review" && (!handoff.reviewed_at || handoff.approved_at !== null || handoff.approval_fingerprint !== null)) return false;
  if (handoff.status === "draft" && (handoff.reviewed_at !== null || handoff.approved_at !== null || handoff.approval_fingerprint !== null)) return false;
  return true;
}

export function validateHandoffForEntry(handoff: BaseHandoff, entry: SourceLibraryEntry) {
  if (!validateHandoff(handoff)) return false;
  if (!isValidApprovedEntry(entry)) return false;
  if (handoff.source_record_id !== entry.source_record.id || handoff.source_fingerprint !== entry.fingerprint) return false;
  const expected = createHandoffDraft(entry, handoff.type, handoff.created_at);
  return handoff.id === expected.id
    && handoff.target_product === expected.target_product
    && handoff.source_url === expected.source_url
    && JSON.stringify(handoff.source_provenance) === JSON.stringify(expected.source_provenance)
    && JSON.stringify(handoff.source_facts) === JSON.stringify(expected.source_facts)
    && JSON.stringify(handoff.evidence_references) === JSON.stringify(expected.evidence_references);
}

export function updateHandoff<T extends HandoffType>(
  handoff: BaseHandoff<T>,
  updates: { derived_analysis?: BaseHandoff<T>["derived_analysis"]; human_notes?: string },
  updatedAt = new Date().toISOString(),
): BaseHandoff<T> {
  if (Number.isNaN(Date.parse(updatedAt))) throw new Error("Handoff update time must be a valid date.");
  const updated = {
    ...handoff,
    ...(updates.derived_analysis ? { derived_analysis: structuredClone(updates.derived_analysis) } : {}),
    ...(updates.human_notes !== undefined ? { human_notes: updates.human_notes } : {}),
    updated_at: new Date(updatedAt).toISOString(),
    status: "draft" as const,
    reviewed_at: null,
    approved_at: null,
    approval_fingerprint: null,
    approval_seal_sha256: null,
  };
  if (!validateHandoff(updated)) throw new Error("Edited handoff does not match its versioned schema.");
  return updated;
}

export function markHandoffReviewed<T extends HandoffType>(handoff: BaseHandoff<T>, reviewedAt = new Date().toISOString()) {
  if (Number.isNaN(Date.parse(reviewedAt))) throw new Error("Handoff review time must be a valid date.");
  const reviewed = { ...handoff, status: "needs_review" as const, reviewed_at: new Date(reviewedAt).toISOString(), approved_at: null, updated_at: new Date(reviewedAt).toISOString() };
  if (!validateHandoff(reviewed)) throw new Error("Handoff is invalid and cannot enter review.");
  return reviewed;
}

export function approveHandoff<T extends HandoffType>(handoff: BaseHandoff<T>, entry: SourceLibraryEntry, approvedAt = new Date().toISOString()) {
  if (handoff.status !== "needs_review" || !handoff.reviewed_at) throw new Error("Handoff must be separately reviewed before approval.");
  if (!validateHandoffForEntry(handoff, entry)) throw new Error("Handoff source or evidence references no longer match the approved SourceRecord.");
  if (Number.isNaN(Date.parse(approvedAt))) throw new Error("Handoff approval time must be a valid date.");
  const approvedBase = { ...handoff, status: "approved" as const, approved_at: new Date(approvedAt).toISOString(), updated_at: new Date(approvedAt).toISOString(), approval_fingerprint: null, approval_seal_sha256: null };
  const approved = { ...approvedBase, approval_fingerprint: handoffContentFingerprint(approvedBase) };
  if (!validateHandoffForEntry(approved, entry)) throw new Error("Approved handoff failed contract validation.");
  return approved;
}

export function handoffToMarkdown(handoff: BaseHandoff) {
  if (!validateHandoff(handoff) || handoff.status !== "approved") throw new Error("Only an approved handoff can be exported as an official package.");
  const lines = [
    `# ${handoff.type}`,
    "",
    `- Handoff ID: ${handoff.id}`,
    `- Schema version: ${handoff.schema_version}`,
    `- Target: ${handoff.target_product}`,
    `- Status: ${handoff.status}`,
    `- SourceRecord ID: ${handoff.source_record_id}`,
    `- Source fingerprint: ${handoff.source_fingerprint}`,
    `- Source URL: ${handoff.source_url ?? "Unknown"}`,
    `- Original URL: ${handoff.source_provenance.source_url_original ?? "Unknown"}`,
    `- Final URL: ${handoff.source_provenance.source_url_final ?? "Unknown"}`,
    `- Captured at: ${handoff.source_provenance.captured_at}`,
    `- Access method: ${handoff.source_provenance.access_method}`,
    `- Created at: ${handoff.created_at}`,
    `- Updated at: ${handoff.updated_at}`,
    `- Reviewed at: ${handoff.reviewed_at ?? "Not reviewed"}`,
    `- Approved at: ${handoff.approved_at ?? "Not approved"}`,
    "",
    "## Source-backed facts",
    ...handoff.source_facts.map((fact) => `- ${fact.text}\n  - Evidence refs: ${fact.evidence_reference_ids.join(", ") || "None"}`),
    "",
    "## Evidence references",
    ...handoff.evidence_references.map((reference) => `- ${reference.id}: “${reference.text_reference}” — ${reference.source}${reference.timestamp ? ` (${reference.timestamp})` : ""}`),
    "",
    "## Derived analysis (not source facts)",
    ...Object.entries(handoff.derived_analysis).flatMap(([key, value]) => [
      `### ${key}`,
      ...(Array.isArray(value) ? value.map((item) => `- ${item}`) : [String(value || "Unknown")]),
      "",
    ]),
    "## Human notes",
    handoff.human_notes || "None",
    "",
  ];
  return lines.join("\n");
}

export function exportHandoffJson(handoff: BaseHandoff) {
  if (!validateHandoff(handoff) || handoff.status !== "approved") throw new Error("Only an approved handoff can be exported as an official package.");
  return JSON.stringify(handoff, null, 2);
}
