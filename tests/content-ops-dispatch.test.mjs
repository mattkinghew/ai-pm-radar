import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { normaliseSourceInput } from "../lib/source-inbox.ts";
import { createSourceLibraryEntry, appendDownstreamHandoff, appendDeliveryPackage } from "../lib/source-library.ts";
import { createHandoffDraft, markHandoffReviewed } from "../lib/downstream-handoff.ts";
import { createSealedDeliveryPackage, approveHandoffWithSeal } from "../lib/secure-handoff-delivery.ts";
import { confirmDeliveryPackageImported, validateDeliveryPackageRecord } from "../lib/delivery-package.ts";
import { checkContentOpsImportStatus, dispatchApprovedContentOpsCandidate, getContentOpsDispatchStatus } from "../scripts/content-ops-dispatch.mjs";

const sourceUrl = "https://example.org/synthetic-research";
const signingKey = "SYNTHETIC_ONLY_SHARED_RECEIVER_SECRET_WITH_MORE_THAN_48_CHARACTERS";
const brandId = "demo-brand-ai-pm";

async function fixture({ factCount = 3, approvedAgoMs = 30_000 } = {}) {
  const now = Date.now();
  const capturedAt = new Date(now - 60_000).toISOString();
  const approvedAt = new Date(now - approvedAgoMs).toISOString();
  const evidenceTexts = [
    "Synthetic statement alpha is supported by its exact quotation.",
    "Synthetic statement beta is supported by its exact quotation.",
    "Synthetic statement gamma is supported by its exact quotation.",
  ].slice(0, factCount);
  const rawText = evidenceTexts.join(" ");
  const record = normaliseSourceInput({
    value: rawText,
    kind: "paste_text",
    sourceUrl,
    title: "Synthetic approved source",
    capturedAt,
  }, { now: capturedAt }).record;
  const evidence = evidenceTexts.map((text) => ({ source: sourceUrl, text_reference: text, timestamp: null }));
  const approvedSource = {
    ...record,
    summary: "Synthetic source summary.",
    evidence,
    key_claims: evidenceTexts.map((text, index) => ({
      claim: `Synthetic source fact ${index + 1}.`,
      evidence: [evidence[index]],
    })),
    review_status: "reviewed",
    approval_status: "approved",
  };
  const library = createSourceLibraryEntry(approvedSource, capturedAt);
  const draft = createHandoffDraft(library, "content_candidate", capturedAt);
  const reviewed = markHandoffReviewed(draft, new Date(now - approvedAgoMs - 1_000).toISOString());
  const approved = await approveHandoffWithSeal(reviewed, library, approvedAt);
  const linked = appendDownstreamHandoff(library, approved);
  const packageValue = await createSealedDeliveryPackage(linked, approved, new Date(now - 20_000).toISOString());
  const packageRecord = {
    package: packageValue,
    state: "packaged",
    exported_at: null,
    import_confirmed_at: null,
  };
  const withPackage = appendDeliveryPackage(linked, packageRecord);
  const minimalEntry = {
    ...withPackage,
    handoffs: [],
    research_briefs: [],
    downstream_handoffs: [approved],
    delivery_packages: [packageRecord],
    intelligence_assessments: [],
  };
  return {
    now,
    input: {
      library_entry: minimalEntry,
      delivery_package_record: packageRecord,
      target_brand_id: brandId,
    },
  };
}

async function withSecret(t, value = signingKey) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "radar-content-ops-dispatch-"));
  const secretPath = path.join(directory, "synthetic-receiver-secret");
  await writeFile(secretPath, value, { mode: 0o600 });
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    AI_PM_RADAR_CONTENT_OPS_SECRET_FILE: secretPath,
    AI_PM_RADAR_CONTENT_OPS_BRAND_IDS: brandId,
  };
}

function verifySignature(payload) {
  const contentHash = createHash("sha256").update(JSON.stringify({
    title: payload.title,
    source: payload.source,
    summary: payload.summary,
  })).digest("hex");
  const signed = [payload.sourceId, payload.sourceSha256, payload.targetBrandId, payload.approvedAt, contentHash].join("\n");
  return createHmac("sha256", signingKey).update(signed).digest("hex");
}

test("dispatch stays disabled until an exact Brand allowlist and private secret file are configured", async () => {
  assert.deepEqual(await getContentOpsDispatchStatus({}), {
    configured: false,
    brand_ids: [],
    code: "content_ops_brand_allowlist_missing",
    receiver: "loopback_only",
  });
  assert.equal((await getContentOpsDispatchStatus({
    AI_PM_RADAR_CONTENT_OPS_BRAND_IDS: "*",
    AI_PM_RADAR_CONTENT_OPS_SECRET_FILE: "/not/read/or/reported",
  })).configured, false);
});

test("signed server dispatch follows the Receiver HMAC contract and stores a receipt distinct from import confirmation", async (t) => {
  const { input, now } = await fixture();
  const env = await withSecret(t);
  let requestPayload;
  const receipt = await dispatchApprovedContentOpsCandidate(input, {
    env,
    now,
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://127.0.0.1:4496/api/intake/radar");
      assert.equal(options.method, "POST");
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.authorization, `Bearer ${signingKey}`);
      requestPayload = JSON.parse(options.body);
      assert.equal(requestPayload.approvalSignature, verifySignature(requestPayload));
      assert.deepEqual(requestPayload.summary, [
        "Synthetic source fact 1.",
        "Synthetic source fact 2.",
        "Synthetic source fact 3.",
      ]);
      return Response.json({
        success: true,
        draftId: "radar-draft-0123456789abcdef01234567",
        receivedAt: new Date(now).toISOString(),
        replayed: false,
      });
    },
  });
  assert.deepEqual(receipt, {
    version: 1,
    receiver: "content_ops",
    draft_id: "radar-draft-0123456789abcdef01234567",
    target_brand_id: brandId,
    received_at: new Date(now).toISOString(),
    replayed: false,
    source_record_id: input.library_entry.source_record.id,
    package_fingerprint: input.delivery_package_record.package.package_fingerprint,
    source_sha256: input.delivery_package_record.package.security_sha256.source_sha256,
  });
  assert.equal(Object.hasOwn(requestPayload, "review_status"), false);
  assert.equal(Object.hasOwn(requestPayload, "approval_status"), false);
  const storedReceipt = { ...input.delivery_package_record, receiver_receipt: receipt };
  assert.equal(validateDeliveryPackageRecord(storedReceipt), true);
  assert.equal(storedReceipt.state, "packaged");
  assert.equal(storedReceipt.import_confirmed_at, null);
  assert.equal(validateDeliveryPackageRecord({ ...storedReceipt, receiver_receipt: { ...receipt, source_sha256: "0".repeat(64) } }), false);
});

test("unapproved, changed, stale, wrong-Brand and incomplete candidates never call the Receiver", async (t) => {
  const env = await withSecret(t);
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return Response.json({}); };
  const valid = await fixture();
  const unapproved = structuredClone(valid.input);
  unapproved.library_entry.source_record.approval_status = "not_approved";
  await assert.rejects(dispatchApprovedContentOpsCandidate(unapproved, { env, fetchImpl }), { code: "content_ops_candidate_invalid" });

  const wrongBrand = structuredClone(valid.input);
  wrongBrand.target_brand_id = "another-brand";
  await assert.rejects(dispatchApprovedContentOpsCandidate(wrongBrand, { env, fetchImpl }), { code: "content_ops_brand_not_allowed" });

  const stale = await fixture({ approvedAgoMs: 25 * 60 * 60_000 });
  await assert.rejects(dispatchApprovedContentOpsCandidate(stale.input, { env, fetchImpl, now: stale.now }), { code: "content_ops_approval_expired" });

  const incomplete = await fixture({ factCount: 2 });
  await assert.rejects(dispatchApprovedContentOpsCandidate(incomplete.input, { env, fetchImpl, now: incomplete.now }), { code: "content_ops_requires_three_source_facts" });
  assert.equal(calls, 0);
});

test("receiver failures, malformed receipts and timeout are mapped without exposing response bodies", async (t) => {
  const { input, now } = await fixture();
  const env = await withSecret(t);
  await assert.rejects(dispatchApprovedContentOpsCandidate(input, {
    env, now, fetchImpl: async () => new Response("private receiver details", { status: 409 }),
  }), { code: "content_ops_receiver_conflict", status: 409 });
  await assert.rejects(dispatchApprovedContentOpsCandidate(input, {
    env, now, fetchImpl: async () => Response.json({ success: true, draftId: "bad", receivedAt: "bad", replayed: false }),
  }), { code: "content_ops_receiver_unexpected_response", status: 502 });
  await assert.rejects(dispatchApprovedContentOpsCandidate(input, {
    env, now, fetchImpl: async () => { throw Object.assign(new Error("synthetic timeout"), { name: "AbortError" }); },
  }), { code: "content_ops_receiver_timeout", status: 504 });
});

test("Receiver import readback is source/Brand bound and alone permits import confirmation", async (t) => {
  const { input, now } = await fixture();
  const env = await withSecret(t);
  const receipt = await dispatchApprovedContentOpsCandidate(input, {
    env, now,
    fetchImpl: async () => Response.json({ success: true, draftId: "radar-draft-0123456789abcdef01234567", receivedAt: new Date(now).toISOString(), replayed: false }),
  });
  const withReceipt = structuredClone(input);
  withReceipt.delivery_package_record.receiver_receipt = receipt;
  const sourceFacts = withReceipt.delivery_package_record.package.source_facts.map((fact) => fact.text);
  const receiverDraft = {
    id: receipt.draft_id,
    sourceId: receipt.source_record_id,
    sourceSha256: receipt.source_sha256,
    targetBrandId: brandId,
    title: withReceipt.library_entry.source_record.title,
    source: withReceipt.delivery_package_record.package.provenance.source_url,
    summary: sourceFacts,
    status: "imported",
  };
  const imported = await checkContentOpsImportStatus(withReceipt, {
    env,
    now: now + 26 * 60 * 60_000,
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, "GET");
      assert.equal(options.headers.authorization, `Bearer ${signingKey}`);
      return Response.json({ drafts: [receiverDraft] });
    },
  });
  assert.deepEqual(imported, {
    status: "imported",
    draft_id: receipt.draft_id,
    target_brand_id: brandId,
    verified_at: new Date(now + 26 * 60 * 60_000).toISOString(),
  });
  assert.equal(validateDeliveryPackageRecord({
    ...withReceipt.delivery_package_record,
    state: "import_confirmed",
    import_confirmed_at: imported.verified_at,
  }), false);
  assert.throws(() => confirmDeliveryPackageImported(withReceipt.delivery_package_record, imported.verified_at), /Receiver import readback/u);
  const confirmed = confirmDeliveryPackageImported({
    ...withReceipt.delivery_package_record,
    receiver_import_verified_at: imported.verified_at,
  }, imported.verified_at);
  assert.equal(validateDeliveryPackageRecord(confirmed), true);
  assert.equal(confirmed.state, "import_confirmed");

  const pending = await checkContentOpsImportStatus(withReceipt, {
    env, now,
    fetchImpl: async () => Response.json({ drafts: [{ ...receiverDraft, status: "draft" }] }),
  });
  assert.equal(pending.status, "draft");
  const missing = await checkContentOpsImportStatus(withReceipt, {
    env, now,
    fetchImpl: async () => Response.json({ drafts: [] }),
  });
  assert.equal(missing.status, "not_found");
  await assert.rejects(checkContentOpsImportStatus(withReceipt, {
    env, now,
    fetchImpl: async () => Response.json({ drafts: [{ ...receiverDraft, sourceSha256: "f".repeat(64) }] }),
  }), { code: "content_ops_receiver_identity_mismatch" });
});
