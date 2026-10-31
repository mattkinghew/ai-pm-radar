/**
 * Phase 2.0 local implementation of the protected SourceRecord gateway.
 * Uses a dedicated CLOUD_SOURCE_DB binding; it never accesses SYNC_DB or DB.
 * The real-source flag is OFF unless explicitly provisioned and enabled.
 */
import { validateSourceRecord } from "../../lib/source-inbox.ts";
import { findAnalysisEvidence, sourceTextForAnalysis } from "../../lib/ai-analysis.ts";
import { toCanonicalBytes } from "../../lib/approval-integrity.ts";

const enc = new TextEncoder();
const ID = /^src_[0-9a-f]{32}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const MAX_ITEM_BYTES = 80_000;
const MAX_ARTICLES = 5;
const MAX_REVISIONS = 8;
const MAX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const respond = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
  },
});
const fail = (code, status = 400, extra = {}) => respond({ ok: false, code, ...extra }, status);
const query = (db, sql, ...args) => db.prepare(sql).bind(...args);

async function digest(value) {
  const bytes = value instanceof Uint8Array ? value : enc.encode(value);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameOrigin(request) {
  const url = new URL(request.url);
  return request.headers.get("origin") === url.origin
    && request.headers.get("sec-fetch-site") === "same-origin";
}

async function readJson(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("content_type_required");
  }
  const length = request.headers.get("content-length");
  if (length && (!Number.isSafeInteger(Number(length)) || Number(length) > MAX_ITEM_BYTES + 5_000)) {
    throw new Error("payload_too_large");
  }
  const text = await request.text();
  if (enc.encode(text).byteLength > MAX_ITEM_BYTES + 5_000) throw new Error("payload_too_large");
  let value;
  try { value = JSON.parse(text); } catch { throw new Error("invalid_json"); }
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("invalid_json");
  return value;
}

function enabled(env) {
  return env.CLOUD_ACCESS_REQUIRED === "true"
    && env.CLOUD_SOURCE_SYNC_ENABLED === "true"
    && env.CLOUD_SOURCE_SYNC_SYNTHETIC_ONLY === "false"
    && env.PURGE_JOB_ENABLED === "true"
    && env.CLOUD_SOURCE_PURGE_SCHEDULE_CONFIGURED === "true"
    && Boolean(env.CLOUD_SOURCE_DB);
}

function capabilities(isEnabled) {
  return {
    api_version: 1,
    source_record_version: 2,
    source_library_version: 4,
    access_enforced: true,
    synthetic_only: !isEnabled,
    expected_revision_required: true,
    real_sources_opt_in: isEnabled,
    human_approval_required: true,
    enabled: isEnabled,
    max_record_bytes: MAX_ITEM_BYTES,
    max_articles: MAX_ARTICLES,
    max_revisions: MAX_REVISIONS,
    max_retention_days: 7,
    approval_inherited: false,
  };
}

async function canonical(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !ID.test(raw.id ?? "")) return null;
  const record = { ...raw, review_status: "needs_review", approval_status: "not_approved" };
  if (validateSourceRecord(record).length || record.material_status !== "captured"
    || record.analysis?.status === "processing") return null;
  const source = sourceTextForAnalysis(record);
  if (!source.trim()) return null;
  const references = [
    ...(record.evidence ?? []),
    ...(record.key_claims ?? []).flatMap((claim) => claim.evidence ?? []),
  ];
  if (!references.every((item) => item?.text_reference && findAnalysisEvidence(source, item.text_reference))) {
    return null;
  }
  const bytes = enc.encode(JSON.stringify(record));
  if (bytes.byteLength > MAX_ITEM_BYTES) return null;
  const { review_status: _review, approval_status: _approval, ...fingerprinted } = record;
  return {
    record,
    payload: new TextDecoder().decode(bytes),
    fingerprint: await digest(toCanonicalBytes(fingerprinted)),
    bytes: bytes.byteLength,
  };
}

function validAuthorization(value, sourceId, fingerprint) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join("|") === [
      "backup_verified", "content_sha256", "rights_confirmed", "seven_day_retention_accepted",
      "source_id", "time_travel_residual_acknowledged",
    ].sort().join("|")
    && value.source_id === sourceId && value.content_sha256 === fingerprint
    && value.backup_verified === true && value.rights_confirmed === true
    && value.seven_day_retention_accepted === true
    && value.time_travel_residual_acknowledged === true);
}

async function current(db, owner, id) {
  return query(db,
    "SELECT source_id,current_revision,content_sha256,created_at,purge_due_at FROM sync_documents WHERE owner_sub=? AND source_id=?",
    owner, id).first();
}

async function readRecord(db, owner, head) {
  const row = await query(db,
    "SELECT content_sha256,source_record_json FROM sync_revisions WHERE owner_sub=? AND source_id=? AND revision=?",
    owner, head.source_id, head.current_revision).first();
  if (!row || row.content_sha256 !== head.content_sha256) return null;
  let record;
  try { record = JSON.parse(row.source_record_json); } catch { return null; }
  const prepared = await canonical(record);
  return prepared?.fingerprint === head.content_sha256 ? prepared.record : null;
}

function ownerValid(owner) { return typeof owner === "string" && /^cf_[a-f0-9]{64}$/.test(owner); }

export async function handleCloudSource(request, env, owner) {
  if (!ownerValid(owner) || env.CLOUD_ACCESS_REQUIRED !== "true") return fail("unauthenticated", 401);
  const url = new URL(request.url);
  const path = url.pathname;
  const isEnabled = enabled(env);
  if (request.method === "GET" && path === "/api/cloud/capabilities") {
    return respond(capabilities(isEnabled));
  }
  if (!isEnabled) return fail("cloud_source_sync_disabled", 403);
  if (!sameOrigin(request)) return fail("same_origin_required", 403);

  const db = env.CLOUD_SOURCE_DB;
  if (request.method === "GET" && path === "/api/cloud/records") {
    const rows = await query(db,
      "SELECT source_id,current_revision,content_sha256,created_at,purge_due_at FROM sync_documents WHERE owner_sub=? AND purge_due_at>? ORDER BY updated_at DESC LIMIT ?",
      owner, new Date().toISOString(), MAX_ARTICLES).all();
    return respond({ records: rows.results ?? [] });
  }

  const match = path.match(/^\/api\/cloud\/records\/(src_[0-9a-f]{32})(?:\/(history))?$/);
  if (match && request.method === "GET") {
    const id = match[1];
    const head = await current(db, owner, id);
    if (!head) return fail("not_found", 404);
    if (Date.parse(head.purge_due_at) <= Date.now()) return fail("expired", 410);
    if (match[2]) {
      const rows = await query(db,
        "SELECT revision,content_sha256,updated_at FROM sync_revisions WHERE owner_sub=? AND source_id=? ORDER BY revision",
        owner, id).all();
      return respond({ source_id: id, current_revision: head.current_revision, revisions: rows.results ?? [] });
    }
    const record = await readRecord(db, owner, head);
    if (!record) return fail("revision_integrity_failed", 503);
    return respond({ source_id: id, revision: head.current_revision, fingerprint: head.content_sha256,
      created_at: head.created_at, purge_due_at: head.purge_due_at, record });
  }

  if (request.method !== "POST" && request.method !== "PUT") return fail("not_found", 404);
  let body;
  try { body = await readJson(request); } catch (error) { return fail(error.message, 400); }
  const isCreate = request.method === "POST" && path === "/api/cloud/records";
  const itemMatch = path.match(/^\/api\/cloud\/records\/(src_[0-9a-f]{32})$/);
  if (!isCreate && !(request.method === "PUT" && itemMatch)) return fail("not_found", 404);
  const prepared = await canonical(body.record);
  if (!prepared) return fail("invalid_source_record", 422);
  const id = prepared.record.id;
  if ((isCreate && body.source_id !== id) || (itemMatch && itemMatch[1] !== id)) return fail("source_identity_mismatch", 422);
  const expectedFields = isCreate
    ? ["authorization", "record", "source_id"]
    : ["authorization", "expectedRevision", "expectedSha256", "record"];
  if (Object.keys(body).sort().join("|") !== expectedFields.sort().join("|")) return fail("unexpected_fields", 422);
  if (!validAuthorization(body.authorization, id, prepared.fingerprint)) return fail("per_source_backup_and_consent_required", 403);

  if (isCreate) {
    const count = await query(db,
      "SELECT count(*) AS n FROM sync_documents WHERE owner_sub=? AND purge_due_at>?",
      owner, new Date().toISOString()).first();
    if (count?.n >= MAX_ARTICLES) return fail("article_quota_exceeded", 409);
    const now = new Date();
    const at = now.toISOString();
    const expires = new Date(now.getTime() + MAX_RETENTION_MS).toISOString();
    try {
      const result = await db.batch([
        query(db, "INSERT INTO sync_documents SELECT ?,?,1,?,?,?,? WHERE (SELECT COUNT(*) FROM sync_documents WHERE owner_sub=? AND purge_due_at>?)<?",
          owner, id, prepared.fingerprint, at, at, expires, owner, at, MAX_ARTICLES),
        query(db, "INSERT INTO sync_revisions SELECT ?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM sync_documents WHERE owner_sub=? AND source_id=? AND current_revision=1 AND content_sha256=?)",
          owner, id, 1, prepared.fingerprint, prepared.payload, at, owner, id, prepared.fingerprint),
        query(db, "INSERT INTO sync_events SELECT ?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM sync_documents WHERE owner_sub=? AND source_id=? AND current_revision=1 AND content_sha256=?)",
          owner, id, 1, "created", at, owner, id, prepared.fingerprint),
      ]);
      if (result[0].meta.changes !== 1) return fail("article_quota_exceeded", 409);
      if (result[1].meta.changes !== 1 || result[2].meta.changes !== 1) return fail("revision_integrity_failed", 503);
    } catch (error) {
      if (/constraint|unique/i.test(String(error))) return fail("article_already_exists", 409);
      throw error;
    }
    return respond({ created: true, source_id: id, revision: 1, fingerprint: prepared.fingerprint,
      purge_due_at: expires, review_status: "needs_review", approval_status: "not_approved" }, 201);
  }

  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1
    || !DIGEST.test(body.expectedSha256 ?? "")) return fail("revision_required", 422);
  const head = await current(db, owner, id);
  if (!head) return fail("not_found", 404);
  if (Date.parse(head.purge_due_at) <= Date.now()) return fail("expired", 410);
  if (head.current_revision !== body.expectedRevision || head.content_sha256 !== body.expectedSha256) {
    return fail("revision_conflict", 409, { current_revision: head.current_revision });
  }
  if (head.current_revision >= MAX_REVISIONS) return fail("revision_limit", 409);
  if (prepared.fingerprint === head.content_sha256) return fail("no_changes", 409);
  const next = head.current_revision + 1;
  const at = new Date().toISOString();
  const result = await db.batch([
    query(db, "UPDATE sync_documents SET current_revision=?,content_sha256=?,updated_at=? WHERE owner_sub=? AND source_id=? AND current_revision=? AND content_sha256=? AND purge_due_at>?",
      next, prepared.fingerprint, at, owner, id, head.current_revision, head.content_sha256, at),
    query(db, "INSERT INTO sync_revisions SELECT ?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM sync_documents WHERE owner_sub=? AND source_id=? AND current_revision=? AND content_sha256=?)",
      owner, id, next, prepared.fingerprint, prepared.payload, at, owner, id, next, prepared.fingerprint),
    query(db, "INSERT INTO sync_events SELECT ?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM sync_documents WHERE owner_sub=? AND source_id=? AND current_revision=? AND content_sha256=?)",
      owner, id, next, "edited", at, owner, id, next, prepared.fingerprint),
  ]);
  if (result[0].meta.changes !== 1) return fail("revision_conflict", 409);
  if (result[1].meta.changes !== 1 || result[2].meta.changes !== 1) return fail("revision_integrity_failed", 503);
  const latest = await current(db, owner, id);
  if (!latest || latest.current_revision !== next || latest.content_sha256 !== prepared.fingerprint
    || latest.purge_due_at !== head.purge_due_at || !await readRecord(db, owner, latest)) {
    return fail("post_write_integrity_failed", 503);
  }
  return respond({ updated: true, source_id: id, revision: next, fingerprint: prepared.fingerprint,
    purge_due_at: head.purge_due_at, review_status: "needs_review", approval_status: "not_approved" });
}

export async function purgeCloudSource(env, at) {
  if (!enabled(env)) return { purged: 0, disabled: true };
  const result = await query(env.CLOUD_SOURCE_DB, "DELETE FROM sync_documents WHERE purge_due_at<=?", at).run();
  return { purged: result.meta.changes, disabled: false };
}
