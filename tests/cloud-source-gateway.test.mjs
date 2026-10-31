import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { normaliseSourceInput } from "../lib/source-inbox.ts";
import { createApprovalSeal } from "../lib/approval-integrity.ts";
import { acknowledgeCloudSync, decideCloudSync, newCloudBinding, prepareWorkbenchSource } from "../lib/cloud-workbench-sync.ts";
import { planExplicitCloudWrite, requireCloudCapabilities } from "../lib/cloud-sync-capability-gate.ts";
import { handleCloudSource, purgeCloudSource } from "../experiments/phase20-cloud-source/service.mjs";
import worker from "../experiments/phase13-one-article/worker.mjs";

const OWNER_EMAIL = "synthetic-owner@example.invalid";
const owner = `cf_${createHash("sha256").update(OWNER_EMAIL).digest("hex")}`;
const otherOwner = `cf_${createHash("sha256").update("other@example.invalid").digest("hex")}`;
const origin = "https://radar.example.invalid";
const sourceId = "src_0123456789abcdef0123456789abcdef";

function fixture(text = "Synthetic trial: Staff requested a clearer intake form.") {
  const record = normaliseSourceInput({
    value: text,
    kind: "paste_text",
    title: "Synthetic intake test",
    sourceUrl: "https://example.invalid/intake",
    capturedAt: "2026-10-30T00:00:00.000Z",
  }, { now: "2026-10-30T00:00:00.000Z" }).record;
  return { ...record, id: sourceId, review_status: "reviewed", approval_status: "approved" };
}

function database() {
  const connection = new DatabaseSync(":memory:");
  connection.exec("PRAGMA foreign_keys=ON");
  connection.exec(readFileSync(new URL("../experiments/phase15-source-sync/schema.sql", import.meta.url), "utf8"));
  const db = {
    prepare(sql) {
      const make = (args) => {
        const statement = connection.prepare(sql);
        return {
          first: async () => statement.get(...args) ?? null,
          all: async () => ({ results: statement.all(...args) }),
          run: async () => ({ meta: { changes: Number(statement.run(...args).changes) } }),
        };
      };
      return { bind: (...args) => make(args), ...make([]) };
    },
    async batch(statements) {
      const output = [];
      connection.exec("BEGIN IMMEDIATE");
      try {
        for (const statement of statements) output.push(await statement.run());
        connection.exec("COMMIT");
        return output;
      } catch (error) {
        connection.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { connection, db };
}

function enabledEnv(db) {
  return {
    CLOUD_ACCESS_REQUIRED: "true",
    CLOUD_SOURCE_SYNC_ENABLED: "true",
    CLOUD_SOURCE_SYNC_SYNTHETIC_ONLY: "false",
    PURGE_JOB_ENABLED: "true",
    CLOUD_SOURCE_PURGE_SCHEDULE_CONFIGURED: "true",
    CLOUD_SOURCE_DB: db,
    SOURCE_SYNC_ENABLED: "true",
    SOURCE_SYNC_SYNTHETIC_ONLY: "true",
  };
}

function request(path, method = "GET", body, headers = {}) {
  return new Request(origin + path, {
    method,
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function call(env, path, method = "GET", body, who = owner, headers = {}) {
  const response = await handleCloudSource(request(path, method, body, headers), env, who);
  return { status: response.status, data: await response.json() };
}

async function prepared(record) {
  const cloudRecord = { ...record, review_status: "needs_review", approval_status: "not_approved" };
  const { review_status: _review, approval_status: _approval, ...payload } = cloudRecord;
  const fingerprint = await createApprovalSeal(payload);
  return {
    record,
    source_id: sourceId,
    authorization: {
      source_id: sourceId,
      content_sha256: fingerprint,
      backup_verified: true,
      rights_confirmed: true,
      seven_day_retention_accepted: true,
      time_travel_residual_acknowledged: true,
    },
  };
}

test("real-source gateway is disabled without dedicated opt-in binding and never touches synthetic DB", async () => {
  const { connection, db } = database();
  const env = { ...enabledEnv(db), CLOUD_SOURCE_SYNC_ENABLED: "false", CLOUD_SOURCE_DB: undefined };
  const cap = await call(env, "/api/cloud/capabilities");
  assert.equal(cap.status, 200);
  assert.equal(cap.data.enabled, false);
  assert.equal(cap.data.synthetic_only, true);
  assert.equal(cap.data.real_sources_opt_in, false);
  const denied = await call(env, "/api/cloud/records", "POST", await prepared(fixture()));
  assert.equal(denied.status, 403);
  for (const patch of [
    { PURGE_JOB_ENABLED: "false" },
    { CLOUD_SOURCE_PURGE_SCHEDULE_CONFIGURED: undefined },
  ]) {
    const state = { ...enabledEnv(db), ...patch };
    assert.equal((await call(state, "/api/cloud/capabilities")).data.enabled, false);
    assert.equal((await call(state, "/api/cloud/records", "POST", await prepared(fixture()))).status, 403);
  }
  assert.equal(connection.prepare("SELECT count(*) AS n FROM sync_documents").get().n, 0);
  connection.close();
});

test("unauthenticated owner and non-same-origin mutations are rejected", async () => {
  const { connection, db } = database();
  const env = enabledEnv(db);
  assert.equal((await call(env, "/api/cloud/capabilities", "GET", undefined, null)).status, 401);
  assert.equal((await call(env, "/api/cloud/records", "GET", undefined, otherOwner)).data.records.length, 0);
  const body = await prepared(fixture());
  const crossOrigin = await call(env, "/api/cloud/records", "POST", body, owner, { origin: "https://attacker.example" });
  assert.equal(crossOrigin.status, 403);
  assert.equal(connection.prepare("SELECT count(*) AS n FROM sync_documents").get().n, 0);
  connection.close();
});

test("capabilities advertise the exact fail-closed client contract only when opted in", async () => {
  const { connection, db } = database();
  const response = await call(enabledEnv(db), "/api/cloud/capabilities");
  assert.deepEqual({
    api_version: response.data.api_version,
    source_record_version: response.data.source_record_version,
    source_library_version: response.data.source_library_version,
    access_enforced: response.data.access_enforced,
    synthetic_only: response.data.synthetic_only,
    expected_revision_required: response.data.expected_revision_required,
    real_sources_opt_in: response.data.real_sources_opt_in,
    human_approval_required: response.data.human_approval_required,
  }, {
    api_version: 1,
    source_record_version: 2,
    source_library_version: 4,
    access_enforced: true,
    synthetic_only: false,
    expected_revision_required: true,
    real_sources_opt_in: true,
    human_approval_required: true,
  });
  connection.close();
});

test("create/read is Owner-scoped, exact-evidence checked, and resets review and approval", async () => {
  const { connection, db } = database();
  const env = enabledEnv(db);
  const record = fixture();
  const evidence = { source: record.source_url, timestamp: null, text_reference: "Staff requested a clearer intake form." };
  record.evidence = [evidence];
  record.key_claims = [{ claim: "Staff requested a clearer form.", evidence: [evidence] }];
  const body = await prepared(record);
  const created = await call(env, "/api/cloud/records", "POST", body);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.review_status, "needs_review");
  assert.equal(created.data.approval_status, "not_approved");
  const read = await call(env, `/api/cloud/records/${sourceId}`);
  assert.equal(read.status, 200);
  assert.equal(read.data.record.raw_text, record.raw_text);
  assert.equal(read.data.record.review_status, "needs_review");
  assert.equal((await call(env, `/api/cloud/records/${sourceId}`, "GET", undefined, otherOwner)).status, 404);
  const invalid = fixture();
  invalid.id = "src_1123456789abcdef0123456789abcdef";
  invalid.evidence = [{ source: "x", timestamp: null, text_reference: "not present in source" }];
  const badBody = await prepared(invalid);
  badBody.source_id = invalid.id;
  badBody.authorization.source_id = invalid.id;
  assert.equal((await call(env, "/api/cloud/records", "POST", badBody)).status, 422);
  connection.close();
});

test("revision compare-and-swap blocks stale edits and changed content remains unapproved", async () => {
  const { connection, db } = database();
  const env = enabledEnv(db);
  const first = await prepared(fixture());
  const created = await call(env, "/api/cloud/records", "POST", first);
  assert.equal(created.status, 201);
  const editedRecord = fixture("Synthetic trial: Staff requested a clearer intake form. A shorter form reduced fictional test errors.");
  const edit = await prepared(editedRecord);
  const changed = await call(env, `/api/cloud/records/${sourceId}`, "PUT", {
    expectedRevision: 1,
    expectedSha256: created.data.fingerprint,
    record: editedRecord,
    authorization: edit.authorization,
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.data));
  assert.equal(changed.data.revision, 2);
  assert.equal(changed.data.review_status, "needs_review");
  assert.equal(changed.data.approval_status, "not_approved");
  const stale = await call(env, `/api/cloud/records/${sourceId}`, "PUT", {
    expectedRevision: 1,
    expectedSha256: created.data.fingerprint,
    record: editedRecord,
    authorization: edit.authorization,
  });
  assert.equal(stale.status, 409);
  const history = await call(env, `/api/cloud/records/${sourceId}/history`);
  assert.deepEqual(history.data.revisions.map((item) => item.revision), [1, 2]);
  connection.close();
});

test("Worker rejects requests before cloud routes when Access identity is absent", async () => {
  const noAccess = await worker.fetch(new Request(origin + "/api/cloud/capabilities"), {
    CLOUD_ACCESS_REQUIRED: "true",
    OWNER_EMAIL_SHA256: "a".repeat(64),
  }, {});
  assert.equal(noAccess.status, 401);
  assert.deepEqual(await noAccess.json(), { code: "unauthenticated" });
});

test("authenticated Worker routes capabilities and draft writes only to CLOUD_SOURCE_DB", async () => {
  const { connection, db } = database();
  const env = {
    ...enabledEnv(db),
    OWNER_EMAIL_SHA256: createHash("sha256").update(OWNER_EMAIL).digest("hex"),
    DB: null,
    SYNC_DB: null,
  };
  const ctx = { access: { getIdentity: async () => ({ email: OWNER_EMAIL }) } };
  const capRequest = request("/api/cloud/capabilities");
  const cap = await worker.fetch(capRequest, env, ctx);
  assert.equal(cap.status, 200);
  assert.equal((await cap.json()).enabled, true);
  const body = await prepared(fixture());
  const createRequest = request("/api/cloud/records", "POST", body);
  const created = await worker.fetch(createRequest, env, ctx);
  assert.equal(created.status, 201);
  const ids = connection.prepare("SELECT DISTINCT source_id FROM sync_documents").all().map((row) => row.source_id);
  assert.deepEqual(ids, [sourceId]);
  connection.close();
});

test("browser sync plan round-trips through the authenticated Worker and verifies the exact readback", async () => {
  const { connection, db } = database();
  const env = {
    ...enabledEnv(db),
    OWNER_EMAIL_SHA256: createHash("sha256").update(OWNER_EMAIL).digest("hex"),
    DB: null,
    SYNC_DB: null,
  };
  const ctx = { access: { getIdentity: async () => ({ email: OWNER_EMAIL }) } };
  const capabilityResponse = await worker.fetch(request("/api/cloud/capabilities"), env, ctx);
  const capabilityData = await capabilityResponse.json();
  const capabilities = requireCloudCapabilities(origin, origin + "/api/cloud/capabilities", capabilityData);
  const evidence = { source: "https://example.invalid/intake", timestamp: null,
    text_reference: "Staff requested a clearer intake form." };
  const source = { ...fixture(), evidence: [evidence],
    key_claims: [{ claim: "Staff requested a clearer intake form.", evidence: [evidence] }] };
  const binding = newCloudBinding("material-e2e", sourceId);
  const preparedRecord = await prepareWorkbenchSource(source, binding);
  assert.deepEqual(preparedRecord.blockers, []);
  const decision = decideCloudSync({ binding, localFingerprint: preparedRecord.fingerprint,
    localBlockers: preparedRecord.blockers, remote: null });
  const requestedAt = "2026-10-30T00:00:00.000Z";
  const plan = await planExplicitCloudWrite({
    record: preparedRecord.record,
    binding,
    localFingerprint: preparedRecord.fingerprint,
    approxBytes: preparedRecord.approx_bytes,
    decision,
    capabilities,
    consent: {
      granted: true,
      cloud_source_id: sourceId,
      local_fingerprint: preparedRecord.fingerprint,
      verified_local_backup: true,
      rights_confirmed: true,
      seven_day_retention_accepted: true,
      time_travel_residual_accepted: true,
      requested_at: requestedAt,
    },
    now: requestedAt,
  });
  const createdResponse = await worker.fetch(request(plan.path, plan.method, plan.body), env, ctx);
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201, JSON.stringify(created));
  const readResponse = await worker.fetch(request("/api/cloud/records/" + sourceId), env, ctx);
  const read = await readResponse.json();
  assert.equal(readResponse.status, 200);
  assert.equal(read.fingerprint, preparedRecord.fingerprint);
  assert.equal(read.record.raw_text, preparedRecord.record.raw_text);
  assert.deepEqual(read.record.evidence, preparedRecord.record.evidence);
  assert.deepEqual(read.record.key_claims, preparedRecord.record.key_claims);
  const acknowledged = acknowledgeCloudSync(binding, {
    source_id: read.source_id, revision: read.revision, fingerprint: read.fingerprint,
  }, requestedAt);
  assert.equal(acknowledged.last_remote_revision, 1);
  assert.equal(read.record.review_status, "needs_review");
  assert.equal(read.record.approval_status, "not_approved");
  assert.equal(connection.prepare("SELECT count(*) AS n FROM sync_documents").get().n, 1);
  connection.close();
});

test("retention purge is independently gated and removes expired rows only from the dedicated DB", async () => {
  const { connection, db } = database();
  const env = enabledEnv(db);
  const created = await call(env, "/api/cloud/records", "POST", await prepared(fixture()));
  assert.equal(created.status, 201);
  const disabled = await purgeCloudSource({ ...env, CLOUD_SOURCE_PURGE_SCHEDULE_CONFIGURED: "false" }, "9999-01-01T00:00:00.000Z");
  assert.deepEqual(disabled, { purged: 0, disabled: true });
  connection.prepare("UPDATE sync_documents SET purge_due_at=? WHERE source_id=?").run("2020-01-01T00:00:00.000Z", sourceId);
  const result = await purgeCloudSource(env, "2026-10-30T00:00:00.000Z");
  assert.deepEqual(result, { purged: 1, disabled: false });
  assert.equal(connection.prepare("SELECT count(*) AS n FROM sync_revisions").get().n, 0);
  connection.close();
});
