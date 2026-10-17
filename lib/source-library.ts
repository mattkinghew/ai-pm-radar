import { findAnalysisEvidence, sourceTextForAnalysis } from "./ai-analysis.ts";
import { validateSourceRecord, type SourceRecord } from "./source-inbox.ts";
import { handoffContentFingerprint, migrateHandoff, validateHandoffForEntry, type BaseHandoff } from "./downstream-handoff.ts";
import { sourceRecordDeliveryFingerprint, validateDeliveryPackageRecord, type DeliveryPackageRecord } from "./delivery-package.ts";
import type { ResearchBriefDraft } from "./research-runtime.ts";
import { validateIntelligenceAssessment, type IntelligenceAssessment } from "./intelligence-routing.ts";

export const SOURCE_LIBRARY_VERSION = 4 as const;
export const LEGACY_SOURCE_LIBRARY_VERSION = 1 as const;
export const PREVIOUS_SOURCE_LIBRARY_VERSION = 2 as const;
export const DELIVERY_SOURCE_LIBRARY_VERSION = 3 as const;

export type SourceLibraryHandoff = {
  kind: "research_brief";
  artifact_id: string;
  created_at: string;
};

export type SourceLibraryEntry = {
  version: typeof SOURCE_LIBRARY_VERSION;
  source_record: SourceRecord;
  fingerprint: string;
  approved_at: string;
  handoffs: SourceLibraryHandoff[];
  research_briefs: Array<{ artifact_id: string; created_at: string; brief: ResearchBriefDraft }>;
  downstream_handoffs: BaseHandoff[];
  delivery_packages: DeliveryPackageRecord[];
  intelligence_assessments: IntelligenceAssessment[];
};

export type LegacySourceLibraryEntry = Omit<SourceLibraryEntry, "version" | "downstream_handoffs"> & {
  version: typeof LEGACY_SOURCE_LIBRARY_VERSION;
  downstream_handoffs?: never;
};

export function sourceRecordFingerprint(record: SourceRecord) {
  const { review_status: _reviewStatus, approval_status: _approvalStatus, ...content } = record;
  return JSON.stringify(content);
}

export function sourceLibraryArtifactId(entry: Pick<SourceLibraryEntry, "source_record" | "fingerprint">) {
  let hash = 2166136261;
  for (let index = 0; index < entry.fingerprint.length; index += 1) {
    hash ^= entry.fingerprint.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `research-brief-${entry.source_record.id}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function getReusableSourceBlockers(record: SourceRecord) {
  const blockers = validateSourceRecord(record).map((issue) => `SourceRecord invalid: ${issue}`);
  const sourceText = sourceTextForAnalysis(record);
  if (record.review_status !== "reviewed") blockers.push("SourceRecord must be human reviewed.");
  if (record.approval_status !== "approved") blockers.push("SourceRecord must be explicitly approved for reuse.");
  if (record.analysis.status === "processing") blockers.push("SourceRecord analysis is still processing.");
  if (record.material_status !== "captured" || !sourceText.trim()) blockers.push("SourceRecord needs captured source text or transcript.");
  if (record.evidence.length === 0) blockers.push("SourceRecord needs at least one evidence reference.");
  if (record.key_claims.length === 0) blockers.push("SourceRecord needs at least one reviewed claim.");

  const evidenceItems = [...record.evidence, ...record.key_claims.flatMap((claim) => claim.evidence)];
  for (const [index, evidence] of evidenceItems.entries()) {
    if (!findAnalysisEvidence(sourceText, evidence.text_reference)) {
      blockers.push(`Evidence reference ${index + 1} cannot be located in the captured source.`);
    }
  }
  if (record.key_claims.some((claim) => claim.evidence.length === 0)) {
    blockers.push("Every reviewed claim needs at least one evidence reference.");
  }
  return [...new Set(blockers)];
}

export function createSourceLibraryEntry(record: SourceRecord, approvedAt: string): SourceLibraryEntry {
  if (Number.isNaN(Date.parse(approvedAt))) throw new Error("Source library approval time must be a valid date.");
  const blockers = getReusableSourceBlockers(record);
  if (blockers.length > 0) throw new Error(blockers.join(" "));
  return {
    version: SOURCE_LIBRARY_VERSION,
    source_record: structuredClone(record),
    fingerprint: sourceRecordFingerprint(record),
    approved_at: new Date(approvedAt).toISOString(),
    handoffs: [],
    research_briefs: [],
    downstream_handoffs: [],
    delivery_packages: [],
    intelligence_assessments: [],
  };
}

export function migrateSourceLibraryEntry(value: unknown): SourceLibraryEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<SourceLibraryEntry> & { downstream_handoffs?: unknown[] };
  const version = (value as { version?: unknown }).version;
  if (version === LEGACY_SOURCE_LIBRARY_VERSION) {
    return {
      ...entry,
      version: SOURCE_LIBRARY_VERSION,
      downstream_handoffs: [],
      delivery_packages: [],
      intelligence_assessments: [],
    } as SourceLibraryEntry;
  }
  if (version === PREVIOUS_SOURCE_LIBRARY_VERSION) {
    if (!Array.isArray(entry.downstream_handoffs)) return null;
    const migratedHandoffs = entry.downstream_handoffs.map(migrateHandoff);
    if (migratedHandoffs.some((handoff) => !handoff)) return null;
    return {
      ...entry,
      version: SOURCE_LIBRARY_VERSION,
      downstream_handoffs: migratedHandoffs as BaseHandoff[],
      delivery_packages: [],
      intelligence_assessments: [],
    } as SourceLibraryEntry;
  }
  if (version === DELIVERY_SOURCE_LIBRARY_VERSION) {
    if (!Array.isArray(entry.downstream_handoffs) || !Array.isArray(entry.delivery_packages)) return null;
    return { ...entry, version: SOURCE_LIBRARY_VERSION, intelligence_assessments: [] } as SourceLibraryEntry;
  }
  if (version !== SOURCE_LIBRARY_VERSION || !Array.isArray(entry.downstream_handoffs)
    || !Array.isArray(entry.delivery_packages) || !Array.isArray(entry.intelligence_assessments)) return null;
  return entry as SourceLibraryEntry;
}

function hasAssessmentArtifactsInEntry(entry: SourceLibraryEntry) {
  return entry.intelligence_assessments.every((assessment) => assessment.routeRecommendations.every((recommendation) => {
    const artifactId = recommendation.decision.createdArtifactId;
    if (!artifactId) return true;

    const route = recommendation.decision.selectedRoute;
    if (!route || !["accepted", "overridden"].includes(recommendation.decision.status)) return false;
    if (route === "research_brief") {
      return entry.research_briefs.some((item) => item.artifact_id === artifactId
        && item.brief.source_record_id === entry.source_record.id)
        && entry.handoffs.some((handoff) => handoff.kind === "research_brief" && handoff.artifact_id === artifactId);
    }
    return entry.downstream_handoffs.some((handoff) => handoff.id === artifactId && handoff.type === route);
  }));
}

export function validateSourceLibraryEntry(value: unknown): value is SourceLibraryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = migrateSourceLibraryEntry(value);
  if (!entry) return false;
  try {
    return entry.version === SOURCE_LIBRARY_VERSION
      && typeof entry.approved_at === "string"
      && !Number.isNaN(Date.parse(entry.approved_at))
      && typeof entry.fingerprint === "string"
      && Boolean(entry.source_record)
      && entry.source_record?.review_status === "reviewed"
      && entry.source_record?.approval_status === "approved"
      && sourceRecordFingerprint(entry.source_record as SourceRecord) === entry.fingerprint
      && getReusableSourceBlockers(entry.source_record as SourceRecord).length === 0
      && Array.isArray(entry.handoffs)
      && Array.isArray(entry.research_briefs)
      && Array.isArray(entry.downstream_handoffs)
      && entry.downstream_handoffs.every((handoff) => validateHandoffForEntry(handoff, entry))
      && Array.isArray(entry.delivery_packages)
      && entry.delivery_packages.every((item) => validateDeliveryPackageRecord(item) && item.package.source_record_id === entry.source_record.id)
      && Array.isArray(entry.intelligence_assessments)
      && new Set(entry.intelligence_assessments.map((assessment) => assessment.id)).size === entry.intelligence_assessments.length
      && entry.intelligence_assessments.every((assessment) => validateIntelligenceAssessment(assessment, entry.source_record.id, entry.fingerprint))
      && hasAssessmentArtifactsInEntry(entry);
  } catch {
    return false;
  }
}

export function appendResearchBriefHandoff(
  entry: SourceLibraryEntry,
  artifactId: string,
  createdAt: string,
  brief: ResearchBriefDraft,
): SourceLibraryEntry {
  const normalizedEntry = migrateSourceLibraryEntry(entry);
  if (!normalizedEntry || !validateSourceLibraryEntry(normalizedEntry)) throw new Error("Only a valid approved SourceRecord can enter a Research Brief.");
  if (!artifactId.trim() || Number.isNaN(Date.parse(createdAt))) throw new Error("Research Brief handoff metadata is invalid.");
  if (brief.source_record_id !== normalizedEntry.source_record.id) throw new Error("Research Brief must reference the approved SourceRecord.");
  if (normalizedEntry.handoffs.some((handoff) => handoff.artifact_id === artifactId)) return normalizedEntry;
  const created = new Date(createdAt).toISOString();
  return {
    ...normalizedEntry,
    handoffs: [...normalizedEntry.handoffs, { kind: "research_brief", artifact_id: artifactId, created_at: created }],
    research_briefs: [...normalizedEntry.research_briefs, { artifact_id: artifactId, created_at: created, brief }],
  };
}

export function appendDownstreamHandoff(entry: SourceLibraryEntry, handoff: BaseHandoff) {
  if (!validateSourceLibraryEntry(entry)) throw new Error("Only a valid approved SourceRecord can store a downstream handoff.");
  if (!validateHandoffForEntry(handoff, entry)) throw new Error("Handoff must preserve this SourceRecord's identity and evidence.");
  const index = entry.downstream_handoffs.findIndex((existing) => existing.id === handoff.id);
  const downstreamHandoffs = [...entry.downstream_handoffs];
  if (index === -1) downstreamHandoffs.push(handoff);
  else downstreamHandoffs[index] = handoff;
  return { ...entry, downstream_handoffs: downstreamHandoffs };
}

export function appendDeliveryPackage(entry: SourceLibraryEntry, packageRecord: DeliveryPackageRecord) {
  if (!validateSourceLibraryEntry(entry) || !validateDeliveryPackageRecord(packageRecord)) throw new Error("Only a valid package can be added to an approved SourceRecord.");
  if (packageRecord.package.source_record_id !== entry.source_record.id || packageRecord.package.source_record_fingerprint !== sourceRecordDeliveryFingerprint(entry)) {
    throw new Error("Delivery package must retain this SourceRecord identity.");
  }
  const handoff = entry.downstream_handoffs.find((item) => item.id === packageRecord.package.handoff_id);
  if (!handoff || handoffContentFingerprint(handoff) !== packageRecord.package.handoff_fingerprint) throw new Error("Delivery package must reference the current approved handoff snapshot.");
  if (entry.delivery_packages.some((item) => item.package.package_id === packageRecord.package.package_id)) return entry;
  return { ...entry, delivery_packages: [...entry.delivery_packages, packageRecord] };
}

export function upsertIntelligenceAssessment(entry: SourceLibraryEntry, assessment: IntelligenceAssessment): SourceLibraryEntry {
  if (!validateSourceLibraryEntry(entry)
    || !validateIntelligenceAssessment(assessment, entry.source_record.id, entry.fingerprint)) {
    throw new Error("Intelligence assessment must match a valid approved SourceRecord fingerprint.");
  }
  const assessments = [...entry.intelligence_assessments];
  const index = assessments.findIndex((item) => item.id === assessment.id);
  if (index === -1) assessments.push(assessment);
  else assessments[index] = assessment;
  return { ...entry, intelligence_assessments: assessments };
}

export function updateDeliveryPackageRecord(entry: SourceLibraryEntry, updated: DeliveryPackageRecord) {
  if (!validateSourceLibraryEntry(entry)) throw new Error("Delivery package lifecycle update is invalid.");
  const index = entry.delivery_packages.findIndex((item) => item.package.package_id === updated.package.package_id);
  if (index < 0) throw new Error("Delivery package does not exist in this SourceRecord history.");
  if (JSON.stringify(entry.delivery_packages[index]?.package) !== JSON.stringify(updated.package)) throw new Error("Delivery package snapshots are immutable.");
  if (!validateDeliveryPackageRecord(updated)) throw new Error("Delivery package lifecycle update is invalid.");
  const deliveryPackages = [...entry.delivery_packages];
  deliveryPackages[index] = updated;
  return { ...entry, delivery_packages: deliveryPackages };
}

export function mergeSourceLibraryEntry(current: SourceLibraryEntry, incoming: SourceLibraryEntry) {
  if (!validateSourceLibraryEntry(current) || !validateSourceLibraryEntry(incoming)
    || sourceLibraryEntryKey(current) !== sourceLibraryEntryKey(incoming)) {
    throw new Error("Only backups of the same approved SourceRecord can be merged.");
  }
  const mergeById = <T extends { artifact_id: string }>(left: T[], right: T[]) => {
    const merged = new Map(left.map((item) => [item.artifact_id, item]));
    for (const item of right) if (!merged.has(item.artifact_id)) merged.set(item.artifact_id, item);
    return [...merged.values()];
  };
  const merged = {
    ...current,
    handoffs: mergeById(current.handoffs, incoming.handoffs),
    research_briefs: mergeById(current.research_briefs, incoming.research_briefs),
    intelligence_assessments: [
      ...current.intelligence_assessments,
      ...incoming.intelligence_assessments.filter((assessment) => !current.intelligence_assessments.some((existing) => existing.id === assessment.id)),
    ],
    downstream_handoffs: [
      ...current.downstream_handoffs,
      ...incoming.downstream_handoffs.filter((item) => !current.downstream_handoffs.some((existing) => existing.id === item.id)),
    ],
    delivery_packages: [
      ...current.delivery_packages,
      ...incoming.delivery_packages.filter((item) => !current.delivery_packages.some((existing) => existing.package.package_id === item.package.package_id)),
    ],
  };
  if (!validateSourceLibraryEntry(merged)) throw new Error("Merged library backup does not pass contract validation.");
  return merged;
}

export function sourceLibraryEntryKey(entry: Pick<SourceLibraryEntry, "source_record" | "fingerprint">) {
  return `${entry.source_record.id}:${entry.fingerprint}`;
}
