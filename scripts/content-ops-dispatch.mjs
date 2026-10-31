import { createHash, createHmac } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isIP } from "node:net";

import { validateSourceLibraryEntry } from "../lib/source-library.ts";
import { assertSealedDeliveryPackage } from "../lib/secure-handoff-delivery.ts";
import {
  deliveryPackageStatus, sourceRecordDeliveryFingerprint, validateDeliveryPackageRecord,
} from "../lib/delivery-package.ts";

const RECEIVER_URL = "http://127.0.0.1:4496/api/intake/radar";
const RECEIVER_TIMEOUT_MS = 8_000;
const RECEIVER_MAX_RESPONSE_BYTES = 8_192;
const RECEIVER_STATUS_MAX_RESPONSE_BYTES = 1_000_000;
const BRAND_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,109}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export class ContentOpsDispatchError extends Error {
  constructor(code, status = 422) {
    super(code);
    this.name = "ContentOpsDispatchError";
    this.code = code;
    this.status = status;
  }
}

function configuredBrandIds(env) {
  const raw = typeof env.AI_PM_RADAR_CONTENT_OPS_BRAND_IDS === "string"
    ? env.AI_PM_RADAR_CONTENT_OPS_BRAND_IDS.trim()
    : "";
  if (!raw) return [];
  const values = raw.split(",").map((value) => value.trim());
  if (values.some((value) => !BRAND_ID_PATTERN.test(value)) || new Set(values).size !== values.length) return [];
  return values;
}

async function secretFileIsReady(pathname) {
  if (!pathname) return false;
  try {
    const info = await lstat(pathname);
    return info.isFile() && !info.isSymbolicLink() && (info.mode & 0o077) === 0
      && info.size >= 48 && info.size <= 4096;
  } catch {
    return false;
  }
}

export async function getContentOpsDispatchStatus(env = process.env) {
  const brandIds = configuredBrandIds(env);
  const secretPath = typeof env.AI_PM_RADAR_CONTENT_OPS_SECRET_FILE === "string"
    ? env.AI_PM_RADAR_CONTENT_OPS_SECRET_FILE.trim()
    : "";
  const secretReady = await secretFileIsReady(secretPath);
  const code = !brandIds.length ? "content_ops_brand_allowlist_missing"
    : !secretReady ? "content_ops_secret_file_unavailable"
      : null;
  return {
    configured: code === null,
    brand_ids: code === null ? brandIds : [],
    code,
    receiver: "loopback_only",
  };
}

function publicHttpsSource(value) {
  if (typeof value !== "string" || value.length > 1400) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password
      && !isIP(host) && host !== "localhost" && !host.endsWith(".localhost")
      && !host.endsWith(".local");
  } catch {
    return false;
  }
}

function receiverText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0
    && value.length <= maxLength && !/[<>\x00]/u.test(value);
}

function checkApprovalWindow(approvedAt, now) {
  const approvedMs = Date.parse(approvedAt);
  if (!Number.isFinite(approvedMs)) throw new ContentOpsDispatchError("content_ops_approval_timestamp_invalid");
  const age = now - approvedMs;
  if (age < -5 * 60_000 || age > 24 * 60 * 60_000) {
    throw new ContentOpsDispatchError("content_ops_approval_expired", 409);
  }
}

function validateCandidate(input, allowedBrandIds, now, requireFreshApproval = true) {
  const entry = input?.library_entry;
  const record = input?.delivery_package_record;
  const brandId = input?.target_brand_id;
  if (!BRAND_ID_PATTERN.test(brandId ?? "") || !allowedBrandIds.includes(brandId)) {
    throw new ContentOpsDispatchError("content_ops_brand_not_allowed", 403);
  }
  if (!validateSourceLibraryEntry(entry) || !validateDeliveryPackageRecord(record)
    || record.package.target_product !== "content_ops"
    || record.package.handoff_type !== "content_candidate"
    || record.package.source_record_id !== entry.source_record.id
    || record.package.source_record_fingerprint !== sourceRecordDeliveryFingerprint(entry)) {
    throw new ContentOpsDispatchError("content_ops_candidate_invalid", 409);
  }
  if (deliveryPackageStatus(record, entry) === "outdated") {
    throw new ContentOpsDispatchError("content_ops_candidate_outdated", 409);
  }
  const handoff = entry.downstream_handoffs.find((item) => item.id === record.package.handoff_id);
  if (!handoff || handoff.status !== "approved" || entry.source_record.review_status !== "reviewed"
    || entry.source_record.approval_status !== "approved") {
    throw new ContentOpsDispatchError("content_ops_approval_required", 409);
  }
  if (typeof entry.source_record.id !== "string" || !entry.source_record.id.trim() || entry.source_record.id.length > 100
    || !receiverText(entry.source_record.title, 240)
    || !publicHttpsSource(record.package.provenance.source_url)
    || !SHA256_PATTERN.test(record.package.security_sha256?.source_sha256 ?? "")) {
    throw new ContentOpsDispatchError("content_ops_required_metadata_missing", 422);
  }
  const summary = handoff.source_facts.map((fact) => fact.text);
  if (summary.length !== 3 || !summary.every((item) => receiverText(item, 600))) {
    throw new ContentOpsDispatchError("content_ops_requires_three_source_facts", 422);
  }
  if (requireFreshApproval) checkApprovalWindow(record.package.manifest.handoff_approved_at, now);
  return { entry, record, brandId, summary, handoff };
}

async function readSecret(secretPath) {
  let file;
  try {
    file = await open(secretPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o077) !== 0 || info.size < 48 || info.size > 4096) {
      throw new ContentOpsDispatchError("content_ops_secret_file_unavailable", 503);
    }
    const value = (await file.readFile({ encoding: "utf8" })).trim();
    if (Buffer.byteLength(value) < 48 || Buffer.byteLength(value) > 4096) {
      throw new ContentOpsDispatchError("content_ops_secret_file_unavailable", 503);
    }
    return value;
  } catch (error) {
    if (error instanceof ContentOpsDispatchError) throw error;
    throw new ContentOpsDispatchError("content_ops_secret_file_unavailable", 503);
  } finally {
    await file?.close().catch(() => {});
  }
}

function receiverError(status) {
  if (status === 401) return new ContentOpsDispatchError("content_ops_receiver_auth_rejected", 502);
  if (status === 409) return new ContentOpsDispatchError("content_ops_receiver_conflict", 409);
  if (status === 422) return new ContentOpsDispatchError("content_ops_receiver_rejected", 422);
  if (status === 429 || status >= 500) return new ContentOpsDispatchError("content_ops_receiver_temporarily_unavailable", 503);
  return new ContentOpsDispatchError("content_ops_receiver_unexpected_response", 502);
}

export async function dispatchApprovedContentOpsCandidate(input, {
  env = process.env,
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  const status = await getContentOpsDispatchStatus(env);
  if (!status.configured) throw new ContentOpsDispatchError(status.code, 503);
  const candidate = validateCandidate(input, status.brand_ids, now);
  await assertSealedDeliveryPackage(candidate.record, candidate.entry);

  const secretPath = env.AI_PM_RADAR_CONTENT_OPS_SECRET_FILE.trim();
  const secret = await readSecret(secretPath);
  const approvedAt = candidate.record.package.manifest.handoff_approved_at;
  const unsigned = {
    title: candidate.entry.source_record.title,
    source: candidate.record.package.provenance.source_url,
    summary: candidate.summary,
  };
  const sourceSha256 = candidate.record.package.security_sha256.source_sha256;
  const signedContentHash = createHash("sha256").update(JSON.stringify(unsigned)).digest("hex");
  const approvalSignature = createHmac("sha256", secret).update([
    candidate.entry.source_record.id,
    sourceSha256,
    candidate.brandId,
    approvedAt,
    signedContentHash,
  ].join("\n")).digest("hex");
  const payload = {
    ...unsigned,
    targetBrandId: candidate.brandId,
    sourceId: candidate.entry.source_record.id,
    sourceSha256,
    approvedAt,
    approvalSignature,
  };
  if (Buffer.byteLength(JSON.stringify(payload)) > 16_000) {
    throw new ContentOpsDispatchError("content_ops_payload_too_large", 413);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECEIVER_TIMEOUT_MS);
  timeout.unref?.();
  let response;
  try {
    response = await fetchImpl(RECEIVER_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ContentOpsDispatchError("content_ops_receiver_timeout", 504);
    }
    throw new ContentOpsDispatchError("content_ops_receiver_temporarily_unavailable", 503);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status !== 200) throw receiverError(response.status);
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new ContentOpsDispatchError("content_ops_receiver_unexpected_response", 502);
  }
  let body;
  try {
    const text = await response.text();
    if (Buffer.byteLength(text) > RECEIVER_MAX_RESPONSE_BYTES) throw new Error("oversized");
    body = JSON.parse(text);
  } catch {
    throw new ContentOpsDispatchError("content_ops_receiver_unexpected_response", 502);
  }
  if (body?.success !== true || !/^radar-draft-[a-f0-9]{24}$/u.test(body.draftId ?? "")
    || typeof body.receivedAt !== "string" || !Number.isFinite(Date.parse(body.receivedAt))
    || typeof body.replayed !== "boolean") {
    throw new ContentOpsDispatchError("content_ops_receiver_unexpected_response", 502);
  }
  return {
    version: 1,
    receiver: "content_ops",
    draft_id: body.draftId,
    target_brand_id: candidate.brandId,
    received_at: new Date(body.receivedAt).toISOString(),
    replayed: body.replayed,
    source_record_id: candidate.entry.source_record.id,
    package_fingerprint: candidate.record.package.package_fingerprint,
    source_sha256: sourceSha256,
  };
}

export async function checkContentOpsImportStatus(input, {
  env = process.env,
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  const status = await getContentOpsDispatchStatus(env);
  if (!status.configured) throw new ContentOpsDispatchError(status.code, 503);
  const candidate = validateCandidate(input, status.brand_ids, now, false);
  const receipt = candidate.record.receiver_receipt;
  if (!receipt || receipt.receiver !== "content_ops" || receipt.target_brand_id !== candidate.brandId
    || receipt.source_record_id !== candidate.entry.source_record.id
    || receipt.package_fingerprint !== candidate.record.package.package_fingerprint
    || receipt.source_sha256 !== candidate.record.package.security_sha256?.source_sha256) {
    throw new ContentOpsDispatchError("content_ops_receiver_receipt_missing", 409);
  }
  await assertSealedDeliveryPackage(candidate.record, candidate.entry);
  const secret = await readSecret(env.AI_PM_RADAR_CONTENT_OPS_SECRET_FILE.trim());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECEIVER_TIMEOUT_MS);
  timeout.unref?.();
  let response;
  try {
    response = await fetchImpl(RECEIVER_URL, {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${secret}` },
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new ContentOpsDispatchError("content_ops_receiver_timeout", 504);
    throw new ContentOpsDispatchError("content_ops_receiver_temporarily_unavailable", 503);
  } finally {
    clearTimeout(timeout);
  }
  if (response.status !== 200) throw receiverError(response.status);
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new ContentOpsDispatchError("content_ops_receiver_unexpected_response", 502);
  }
  let body;
  try {
    const text = await response.text();
    if (Buffer.byteLength(text) > RECEIVER_STATUS_MAX_RESPONSE_BYTES) throw new Error("oversized");
    body = JSON.parse(text);
  } catch {
    throw new ContentOpsDispatchError("content_ops_receiver_unexpected_response", 502);
  }
  if (!Array.isArray(body?.drafts) || body.drafts.length > 100) {
    throw new ContentOpsDispatchError("content_ops_receiver_unexpected_response", 502);
  }
  const matches = body.drafts.filter((draft) => draft?.id === receipt.draft_id);
  if (matches.length === 0) return { status: "not_found", draft_id: receipt.draft_id };
  if (matches.length !== 1) throw new ContentOpsDispatchError("content_ops_receiver_identity_mismatch", 409);
  const [draft] = matches;
  if (draft.sourceId !== receipt.source_record_id || draft.sourceSha256 !== receipt.source_sha256
    || draft.targetBrandId !== receipt.target_brand_id || draft.title !== candidate.entry.source_record.title
    || draft.source !== candidate.record.package.provenance.source_url
    || !Array.isArray(draft.summary) || JSON.stringify(draft.summary) !== JSON.stringify(candidate.summary)
    || !["draft", "imported"].includes(draft.status)) {
    throw new ContentOpsDispatchError("content_ops_receiver_identity_mismatch", 409);
  }
  return {
    status: draft.status,
    draft_id: receipt.draft_id,
    target_brand_id: receipt.target_brand_id,
    verified_at: new Date(now).toISOString(),
  };
}
