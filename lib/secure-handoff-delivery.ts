/**
 * Phase 1.5D controlled delivery boundary.
 *
 * This does not replace the legacy 16-hex fingerprints used for local IDs,
 * deterministic fixtures and v1 consumer compatibility. It adds a separate
 * SHA-256 seal bound to the current SourceRecord and approved Handoff payload.
 * Legacy approvals/packages remain readable but cannot pass this export gate.
 *
 * This is integrity/staleness checking, NOT a cryptographic proof of reviewer
 * identity: an untrusted actor able to rewrite both payload and local seal
 * needs a separate authenticated approval event / server-side authorization.
 */
import { assertApprovalIntegrity, createApprovalSeal } from "./approval-integrity.ts";
import {
  approveHandoff, validateHandoffForEntry,
  type BaseHandoff, type HandoffType,
} from "./downstream-handoff.ts";
import {
  createDeliveryPackage, deliveryPackageStatus, validateDeliveryPackage,
  type DeliveryPackage,
  type DeliveryPackageRecord,
} from "./delivery-package.ts";
import type { SourceLibraryEntry } from "./source-library.ts";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function approvedHandoffPayload(entry: SourceLibraryEntry, handoff: BaseHandoff) {
  const { approval_seal_sha256: _seal, ...unsignedHandoff } = handoff;
  return {
    contract: "ai-pm-radar.handoff-approval.sha256.v1",
    sourceRecord: entry.source_record,
    sourceLibraryFingerprint: entry.fingerprint,
    handoff: unsignedHandoff,
  };
}

/** Called only after the user intentionally approves a separately reviewed handoff. */
export async function approveHandoffWithSeal<T extends HandoffType>(
  handoff: BaseHandoff<T>, entry: SourceLibraryEntry, approvedAt?: string,
): Promise<BaseHandoff<T>> {
  const approved = approveHandoff(handoff, entry, approvedAt);
  const approval_seal_sha256 = await createApprovalSeal(approvedHandoffPayload(entry, approved));
  return { ...approved, approval_seal_sha256 };
}

export async function assertSealedHandoff(handoff: BaseHandoff, entry: SourceLibraryEntry): Promise<void> {
  if (handoff.status !== "approved" || !validateHandoffForEntry(handoff, entry)) {
    throw new Error("Handoff source, evidence, or human approval is no longer valid.");
  }
  if (!SHA256_PATTERN.test(handoff.approval_seal_sha256 ?? "")) {
    throw new Error("Legacy or unsealed handoff requires a new human review and approval before export.");
  }
  await assertApprovalIntegrity(approvedHandoffPayload(entry, handoff), handoff.approval_seal_sha256);
}

function unsignedPackage(item: DeliveryPackage) {
  const { security_sha256: _security, ...content } = item;
  return content;
}

/** Build an immutable portable delivery snapshot after verifying current human approval. */
export async function createSealedDeliveryPackage(
  entry: SourceLibraryEntry, handoff: BaseHandoff, createdAt?: string,
): Promise<DeliveryPackage> {
  await assertSealedHandoff(handoff, entry);
  const item = createDeliveryPackage(entry, handoff, createdAt);
  const source_sha256 = await createApprovalSeal(entry.source_record);
  const handoff_sha256 = handoff.approval_seal_sha256!;
  const package_sha256 = await createApprovalSeal(unsignedPackage(item));
  return {
    ...item,
    security_sha256: { version: 1, source_sha256, handoff_sha256, package_sha256 },
  };
}

/** Rebuild every protected byte at export time, including the SourceRecord and evidence. */
export async function assertSealedDeliveryPackage(
  record: DeliveryPackageRecord, entry: SourceLibraryEntry,
): Promise<void> {
  const item = record.package;
  if (!validateDeliveryPackage(item) || deliveryPackageStatus(record, entry) === "outdated") {
    throw new Error("DeliveryPackage is invalid or refers to an outdated source/handoff.");
  }
  const handoff = entry.downstream_handoffs.find((candidate) => candidate.id === item.handoff_id);
  if (!handoff) throw new Error("Approved handoff is missing from the Source Library.");
  await assertSealedHandoff(handoff, entry);
  const security = item.security_sha256;
  if (!security || security.version !== 1
    || !SHA256_PATTERN.test(security.source_sha256)
    || !SHA256_PATTERN.test(security.handoff_sha256)
    || !SHA256_PATTERN.test(security.package_sha256)) {
    throw new Error("Legacy DeliveryPackage requires a new SHA-256-sealed package before export.");
  }
  await assertApprovalIntegrity(entry.source_record, security.source_sha256);
  if (security.handoff_sha256 !== handoff.approval_seal_sha256) {
    throw new Error("Approved handoff revision no longer matches this DeliveryPackage.");
  }
  await assertApprovalIntegrity(unsignedPackage(item), security.package_sha256);
}
