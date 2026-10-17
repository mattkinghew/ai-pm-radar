import type { SourceRecord } from "./source-inbox.ts";
import {
  handoffContentFingerprint,
  validateHandoffForEntry,
  type BaseHandoff,
  type HandoffType,
} from "./downstream-handoff.ts";
import type { SourceLibraryEntry } from "./source-library.ts";

export const DELIVERY_PACKAGE_VERSION = 1 as const;
export const DELIVERY_CONTRACT_VERSION = 1 as const;
export type DeliveryTarget = BaseHandoff["target_product"];
export type DeliveryState = "packaged" | "exported" | "import_confirmed";

export type DeliveryPackage = {
  package_id: string;
  package_version: typeof DELIVERY_PACKAGE_VERSION;
  contract_version: typeof DELIVERY_CONTRACT_VERSION;
  target_product: DeliveryTarget;
  handoff_type: HandoffType;
  handoff_id: string;
  handoff_fingerprint: string;
  source_record_id: string;
  source_record_fingerprint: string;
  created_at: string;
  manifest: {
    format: "ai-pm-radar.delivery-package";
    package_version: typeof DELIVERY_PACKAGE_VERSION;
    contract_version: typeof DELIVERY_CONTRACT_VERSION;
    created_at: string;
    source_review_status: "reviewed";
    source_approval_status: "approved";
    handoff_status: "approved";
    handoff_reviewed_at: string;
    handoff_approved_at: string;
  };
  source_snapshot: { title: string | null; source_url: string | null; facts: string[] };
  provenance: {
    source_url: string | null;
    source_url_original: string | null;
    source_url_final: string | null;
    captured_at: string;
    access_method: SourceRecord["access_method"];
  };
  source_facts: BaseHandoff["source_facts"];
  evidence_references: BaseHandoff["evidence_references"];
  payload: { derived_analysis: BaseHandoff["derived_analysis"]; human_notes: string };
  package_fingerprint: string;
  // Optional for legacy readback; required by the controlled 1.5D export path.
  security_sha256?: { version: 1; source_sha256: string; handoff_sha256: string; package_sha256: string };
};

export type DeliveryPackageRecord = {
  package: DeliveryPackage;
  state: DeliveryState;
  exported_at: string | null;
  import_confirmed_at: string | null;
};

export type CompatibilityResult = {
  target_product: DeliveryTarget;
  handoff_type: HandoffType;
  compatible: boolean;
  errors: string[];
};

export type ContentOpsIntakePackage = {
  packageType: "content-ops-handoff";
  version: 1;
  sourceSystem: "ai_pm_radar";
  exportedAt: string;
  items: Array<{
    externalId: string;
    kind: "content_candidate";
    title?: string;
    url?: string;
    text: string;
    createdAt: string;
    metadata: { radarDelivery: Record<string, unknown> };
  }>;
};

export const CONSUMER_PROFILES: Record<DeliveryTarget, {
  name: string;
  handoff_type: HandoffType;
  supported_contract_versions: readonly number[];
  required_fields: readonly string[];
}> = {
  content_ops: { name: "Content Ops", handoff_type: "content_candidate", supported_contract_versions: [1], required_fields: ["source_record_id", "source_record_fingerprint", "handoff_id", "handoff_fingerprint", "provenance", "evidence_references", "payload"] },
  cyber_kuma: { name: "Cyber Kuma", handoff_type: "learning_pack", supported_contract_versions: [1], required_fields: ["source_record_id", "source_record_fingerprint", "handoff_id", "handoff_fingerprint", "provenance", "evidence_references", "payload"] },
  storyworld: { name: "Storyworld", handoff_type: "creative_reference", supported_contract_versions: [1], required_fields: ["source_record_id", "source_record_fingerprint", "handoff_id", "handoff_fingerprint", "provenance", "evidence_references", "payload"] },
  diagnostic: { name: "Diagnostic", handoff_type: "case_reference", supported_contract_versions: [1], required_fields: ["source_record_id", "source_record_fingerprint", "handoff_id", "handoff_fingerprint", "provenance", "evidence_references", "payload"] },
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function fingerprint(value: unknown) {
  const input = stableJson(value);
  let hash = BigInt("14695981039346656037");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * BigInt("1099511628211"));
  }
  return hash.toString(16).padStart(16, "0");
}

export function deliveryPackageFingerprint(value: DeliveryPackage) {
  const { package_fingerprint: _fingerprint, security_sha256: _security, ...content } = value;
  return fingerprint(content);
}

export function sourceRecordDeliveryFingerprint(entry: SourceLibraryEntry) {
  return fingerprint(entry.fingerprint);
}

export function validateDeliveryPackage(value: unknown): value is DeliveryPackage {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DeliveryPackage>;
  if (item.package_version !== DELIVERY_PACKAGE_VERSION || item.contract_version !== DELIVERY_CONTRACT_VERSION
    || typeof item.package_id !== "string" || !item.package_id
    || !item.target_product || !Object.hasOwn(CONSUMER_PROFILES, item.target_product)
    || !item.handoff_type || !item.handoff_id || !/^[a-f0-9]{16}$/.test(item.handoff_fingerprint ?? "")
    || !item.source_record_id || !/^[a-f0-9]{16}$/.test(item.source_record_fingerprint ?? "")
    || Number.isNaN(Date.parse(item.created_at ?? ""))
    || !item.manifest || item.manifest.format !== "ai-pm-radar.delivery-package"
    || item.manifest.package_version !== item.package_version || item.manifest.contract_version !== item.contract_version
    || item.manifest.created_at !== item.created_at
    || item.manifest.source_review_status !== "reviewed" || item.manifest.source_approval_status !== "approved"
    || item.manifest.handoff_status !== "approved"
    || typeof item.manifest.handoff_reviewed_at !== "string" || typeof item.manifest.handoff_approved_at !== "string"
    || !item.source_snapshot || (item.source_snapshot.title !== null && typeof item.source_snapshot.title !== "string")
    || (item.source_snapshot.source_url !== null && typeof item.source_snapshot.source_url !== "string")
    || !Array.isArray(item.source_snapshot.facts) || item.source_snapshot.facts.some((fact) => typeof fact !== "string")
    || !item.provenance || (item.provenance.source_url !== null && typeof item.provenance.source_url !== "string")
    || (item.provenance.source_url_original !== null && typeof item.provenance.source_url_original !== "string")
    || (item.provenance.source_url_final !== null && typeof item.provenance.source_url_final !== "string")
    || Number.isNaN(Date.parse(item.provenance.captured_at ?? "")) || typeof item.provenance.access_method !== "string"
    || !Array.isArray(item.source_facts) || !Array.isArray(item.evidence_references) || item.evidence_references.length === 0
    || item.evidence_references.some((evidence) => evidence.source_record_id !== item.source_record_id)
    || !item.payload || !item.payload.derived_analysis
    || typeof item.payload.derived_analysis !== "object"
    || typeof item.payload.human_notes !== "string"
    || typeof item.package_fingerprint !== "string") return false;
  const evidenceIds = new Set(item.evidence_references.map((reference) => reference.id));
  if (item.evidence_references.some((reference) => typeof reference.id !== "string" || !reference.id
    || !Number.isInteger(reference.evidence_index) || typeof reference.text_reference !== "string" || !reference.text_reference.trim()
    || typeof reference.source !== "string" || (reference.timestamp !== null && typeof reference.timestamp !== "string"))
    || item.source_facts.some((fact) => typeof fact.text !== "string" || !Array.isArray(fact.evidence_reference_ids) || fact.evidence_reference_ids.length === 0
      || fact.evidence_reference_ids.some((id) => !evidenceIds.has(id)))
    || JSON.stringify(item.source_snapshot.facts) !== JSON.stringify(item.source_facts.map((fact) => fact.text))
    || Number.isNaN(Date.parse(item.manifest.handoff_reviewed_at)) || Number.isNaN(Date.parse(item.manifest.handoff_approved_at))) return false;
  return CONSUMER_PROFILES[item.target_product].handoff_type === item.handoff_type
    && item.package_fingerprint === deliveryPackageFingerprint(item as DeliveryPackage);
}

export function validateConsumerCompatibility(value: unknown): CompatibilityResult {
  const errors: string[] = [];
  const item = value as Partial<DeliveryPackage>;
  const target = item?.target_product;
  const type = item?.handoff_type;
  if (!validateDeliveryPackage(value)) errors.push("Delivery package structure or fingerprint is invalid.");
  if (!target || !Object.hasOwn(CONSUMER_PROFILES, target)) {
    errors.push("Target product has no registered consumer profile.");
    return { target_product: "content_ops", handoff_type: type ?? "content_candidate", compatible: false, errors };
  }
  const profile = CONSUMER_PROFILES[target];
  if (type !== profile.handoff_type) errors.push(`Consumer ${profile.name} does not accept ${String(type)}.`);
  if (!profile.supported_contract_versions.includes(item.contract_version ?? -1)) errors.push(`Consumer ${profile.name} does not support contract version ${String(item.contract_version)}.`);
  for (const field of profile.required_fields) {
    if (field === "provenance" && !item.provenance) errors.push("Required provenance is missing.");
    if (field === "evidence_references" && (!Array.isArray(item.evidence_references) || item.evidence_references.length === 0)) errors.push("At least one evidence reference is required.");
    if (field === "payload" && !item.payload) errors.push("Required payload is missing.");
  }
  if (!item.source_record_id || !item.source_record_fingerprint || !item.handoff_id || !item.handoff_fingerprint) errors.push("Source and handoff identity fields are required.");
  return { target_product: target, handoff_type: type ?? "content_candidate", compatible: errors.length === 0, errors };
}

export function createDeliveryPackage(entry: SourceLibraryEntry, handoff: BaseHandoff, createdAt = new Date().toISOString()): DeliveryPackage {
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("Package creation time must be a valid date.");
  if (!validateHandoffForEntry(handoff, entry) || handoff.status !== "approved"
    || handoff.approval_fingerprint !== handoffContentFingerprint(handoff)) {
    throw new Error("Only a currently approved handoff linked to this approved SourceRecord can be packaged.");
  }
  const normalizedCreatedAt = new Date(createdAt).toISOString();
  const record = entry.source_record;
  const base = {
    package_version: DELIVERY_PACKAGE_VERSION,
    contract_version: DELIVERY_CONTRACT_VERSION,
    target_product: handoff.target_product,
    handoff_type: handoff.type,
    handoff_id: handoff.id,
    handoff_fingerprint: handoffContentFingerprint(handoff),
    source_record_id: record.id,
    source_record_fingerprint: sourceRecordDeliveryFingerprint(entry),
    created_at: normalizedCreatedAt,
    manifest: {
      format: "ai-pm-radar.delivery-package" as const,
      package_version: DELIVERY_PACKAGE_VERSION,
      contract_version: DELIVERY_CONTRACT_VERSION,
      created_at: normalizedCreatedAt,
      source_review_status: "reviewed" as const,
      source_approval_status: "approved" as const,
      handoff_status: "approved" as const,
      handoff_reviewed_at: handoff.reviewed_at!,
      handoff_approved_at: handoff.approved_at!,
    },
    source_snapshot: {
      title: record.title,
      source_url: record.source_url,
      facts: handoff.source_facts.map((fact) => fact.text),
    },
    provenance: {
      source_url: record.source_url,
      source_url_original: record.source_url_original ?? record.source_url,
      source_url_final: record.source_url_final ?? record.source_url,
      captured_at: record.captured_at,
      access_method: record.access_method,
    },
    source_facts: structuredClone(handoff.source_facts),
    evidence_references: structuredClone(handoff.evidence_references),
    payload: { derived_analysis: structuredClone(handoff.derived_analysis), human_notes: handoff.human_notes },
  };
  const packageId = `delivery_${handoff.type}_${fingerprint(base)}`;
  const withoutFingerprint = { package_id: packageId, ...base };
  const deliveryPackage: DeliveryPackage = { ...withoutFingerprint, package_fingerprint: fingerprint(withoutFingerprint) };
  const compatibility = validateConsumerCompatibility(deliveryPackage);
  if (!compatibility.compatible) throw new Error(compatibility.errors.join(" "));
  return deliveryPackage;
}

export function toContentOpsIntakePackage(item: DeliveryPackage): ContentOpsIntakePackage {
  const compatibility = validateConsumerCompatibility(item);
  if (!compatibility.compatible || item.target_product !== "content_ops" || item.handoff_type !== "content_candidate") {
    throw new Error("Only a compatible content_candidate package can be converted for Content Ops intake.");
  }
  return {
    packageType: "content-ops-handoff",
    version: 1,
    sourceSystem: "ai_pm_radar",
    exportedAt: item.created_at,
    items: [{
      externalId: item.package_id,
      kind: "content_candidate",
      ...(item.source_snapshot.title ? { title: item.source_snapshot.title } : {}),
      ...(item.provenance.source_url ? { url: item.provenance.source_url } : {}),
      text: JSON.stringify({ source_facts: item.source_facts, derived_analysis: item.payload.derived_analysis, human_notes: item.payload.human_notes }, null, 2),
      createdAt: item.created_at,
      metadata: { radarDelivery: {
        package_id: item.package_id,
        package_version: item.package_version,
        contract_version: item.contract_version,
        package_fingerprint: item.package_fingerprint,
        // Receiver can retain these as audit metadata; independent trust validation is a separate gate.
        ...(item.security_sha256 ? { source_sha256: item.security_sha256.source_sha256,
          handoff_sha256: item.security_sha256.handoff_sha256,
          package_sha256: item.security_sha256.package_sha256 } : {}),
        source_record_id: item.source_record_id,
        source_record_fingerprint: item.source_record_fingerprint,
        handoff_id: item.handoff_id,
        handoff_fingerprint: item.handoff_fingerprint,
        provenance: item.provenance,
        evidence_references: item.evidence_references,
        source_approval: item.manifest.source_approval_status,
        handoff_reviewed_at: item.manifest.handoff_reviewed_at,
        handoff_approved_at: item.manifest.handoff_approved_at,
      } },
    }],
  };
}

export function validateDeliveryPackageRecord(value: unknown): value is DeliveryPackageRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<DeliveryPackageRecord>;
  if (!validateDeliveryPackage(record.package) || !["packaged", "exported", "import_confirmed"].includes(record.state ?? "")
    || (record.exported_at !== null && (typeof record.exported_at !== "string" || Number.isNaN(Date.parse(record.exported_at))))
    || (record.import_confirmed_at !== null && (typeof record.import_confirmed_at !== "string" || Number.isNaN(Date.parse(record.import_confirmed_at))))) return false;
  if (record.state === "packaged" && (record.exported_at !== null || record.import_confirmed_at !== null)) return false;
  if (record.state === "exported" && (!record.exported_at || record.import_confirmed_at !== null)) return false;
  return record.state !== "import_confirmed" || Boolean(record.exported_at && record.import_confirmed_at);
}

export function deliveryPackageStatus(record: DeliveryPackageRecord, entry: SourceLibraryEntry): "outdated" | DeliveryState {
  const handoff = entry.downstream_handoffs.find((candidate) => candidate.id === record.package.handoff_id);
  if (sourceRecordDeliveryFingerprint(entry) !== record.package.source_record_fingerprint || !handoff
    || handoffContentFingerprint(handoff) !== record.package.handoff_fingerprint) return "outdated";
  return record.state;
}

export function markDeliveryPackageExported(record: DeliveryPackageRecord, exportedAt = new Date().toISOString()): DeliveryPackageRecord {
  if (!validateDeliveryPackageRecord(record) || Number.isNaN(Date.parse(exportedAt))) throw new Error("Delivery package export state is invalid.");
  if (record.state === "import_confirmed") return record;
  return { ...record, state: "exported", exported_at: new Date(exportedAt).toISOString(), import_confirmed_at: null };
}

export function confirmDeliveryPackageImported(record: DeliveryPackageRecord, confirmedAt = new Date().toISOString()): DeliveryPackageRecord {
  if (!validateDeliveryPackageRecord(record) || !record.exported_at || Number.isNaN(Date.parse(confirmedAt))) throw new Error("A package must be explicitly exported before import confirmation.");
  return { ...record, state: "import_confirmed", import_confirmed_at: new Date(confirmedAt).toISOString() };
}

export function deliveryPackageToMarkdown(item: DeliveryPackage) {
  if (!validateDeliveryPackage(item)) throw new Error("Invalid delivery package cannot be exported.");
  return [
    `# ${item.handoff_type} delivery package`, "",
    `- Package ID: ${item.package_id}`,
    `- Package version: ${item.package_version}`,
    `- Contract version: ${item.contract_version}`,
    `- Target: ${item.target_product}`,
    `- Created: ${item.created_at}`,
    `- Package fingerprint: ${item.package_fingerprint}`,
    `- SourceRecord: ${item.source_record_id} (${item.source_record_fingerprint})`,
    `- Handoff: ${item.handoff_id} (${item.handoff_fingerprint})`,
    `- Source title: ${item.source_snapshot.title ?? "Unknown"}`,
    `- Source URL: ${item.provenance.source_url ?? "Unknown"}`,
    `- Original URL: ${item.provenance.source_url_original ?? "Unknown"}`,
    `- Final URL: ${item.provenance.source_url_final ?? "Unknown"}`,
    `- Captured at: ${item.provenance.captured_at}`,
    `- Access method: ${item.provenance.access_method}`, "",
    "## Source facts",
    ...item.source_facts.map((fact) => `- ${fact.text} (evidence: ${fact.evidence_reference_ids.join(", ")})`), "",
    "## Evidence references (locatable does not mean verified)",
    ...item.evidence_references.map((reference) => `- ${reference.id}: “${reference.text_reference}” — ${reference.source}${reference.timestamp ? ` (${reference.timestamp})` : ""}`), "",
    "## Derived analysis (not source facts)", "```json",
    JSON.stringify(item.payload, null, 2), "```", "",
  ].join("\n");
}
