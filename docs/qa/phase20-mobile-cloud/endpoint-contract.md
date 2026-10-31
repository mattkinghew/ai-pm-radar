# Existing Synthetic Source Sync Contract

Source: `experiments/phase15-source-sync/service.mjs`, `schema.sql`, `experiments/phase13-one-article/worker.mjs`, and `pilot-ui/app.js`.

## Authentication and routing

- Worker requires Cloudflare Access context and validates the normalized email against a configured Owner hash before serving the pilot UI or API. No client-provided `owner_sub` is trusted.
- The browser API is same-origin under `/api/source-sync/v1/`; POST/PUT/DELETE reject cross-origin requests and the Worker serves this pilot only when `CLOUD_ACCESS_REQUIRED=true`, `SOURCE_SYNC_ENABLED=true`, `SOURCE_SYNC_SYNTHETIC_ONLY=true`, and `SYNC_DB` is bound.
- The current synthetic config also keeps `PILOT_REAL_UPLOAD_ENABLED=false`, `PILOT_CONTROLLED_COMMIT_ENABLED=false`, and `REAL_SOURCE_SYNC_ENABLED=false`.

## Operations

| Request | Behavior |
|---|---|
| `GET /api/source-sync/v1/capabilities` | Reports synthetic-only, Owner-scoped limits and explicit disabled real sources |
| `GET /api/source-sync/v1/fixtures` | Returns only fixed synthetic fixtures/allowlisted variants |
| `GET /api/source-sync/v1/records` | Lists active rows for verified Owner only |
| `GET /api/source-sync/v1/records/{sourceId}` | Reads current record, verifies stored JSON SHA and owner scope |
| `GET /api/source-sync/v1/records/{sourceId}/history` | Reads immutable revision metadata |
| `POST /api/source-sync/v1/records` | Creates only an exact allowlisted synthetic SourceRecord after local JSON backup/hash verification and explicit fixture attestations; starts `needs_review` / `not_approved` |
| `PUT /api/source-sync/v1/records/{sourceId}` | Requires expected revision + SHA and same allowlisted record; atomic CAS; changed state remains unapproved |
| `DELETE /api/source-sync/v1/records/{sourceId}` | Requires exact source ID, expected revision and explicit confirmation; active rows cascade; D1 Time Travel residual may remain |

Limits in code: 80 KB record, five active records per Owner, eight revisions per record, seven-day TTL that edits do not extend. Evidence is checked against source text. The pilot is synthetic-only and is not suitable for arbitrary URL/text capture.

## Retry and conflict semantics

- Create uses a unique `(owner_sub, source_id)` key; duplicate create returns HTTP 409, so retries cannot create a second row. It does **not** currently return the original success receipt idempotently. A client recovering from a lost response must read the Owner-scoped list/item and reconcile the existing source before another create.
- Update uses expected revision and SHA; stale or racing update returns HTTP 409 without appending duplicate revision/event rows. UI requires refresh and manual difference handling.
- Every changed revision is unapproved. No review/approval is inherited from client JSON.

The production `radar.lamlab.cc` app does not expose this endpoint in the observed source or mobile origin allowlist. The `lib/cloud-sync-capability-gate.ts` rejects synthetic-only capability and does not execute network requests.

## Phase 2.0 local protected gateway implementation (not deployed)

`experiments/phase20-cloud-source/service.mjs` adds a separate Worker route contract for general SourceRecord drafts. The Worker authenticates the request first using the existing exact Owner Access identity path; this module receives only the resulting server-derived `cf_<email-hash>` owner key. It reads only the dedicated `CLOUD_SOURCE_DB` binding and never uses `DB` or synthetic `SYNC_DB`.

All real-source operations are disabled unless all are present: `CLOUD_ACCESS_REQUIRED=true`, `CLOUD_SOURCE_SYNC_ENABLED=true`, `CLOUD_SOURCE_SYNC_SYNTHETIC_ONLY=false`, `PURGE_JOB_ENABLED=true`, `CLOUD_SOURCE_PURGE_SCHEDULE_CONFIGURED=true`, and a dedicated `CLOUD_SOURCE_DB`. The purge-schedule flag is an explicit operator attestation that the Worker cron is configured; it must be checked against the deployed schedule before activation. No Wrangler binding, live D1, Access policy or same-origin production route was configured in this local implementation. With flags absent, capabilities report `enabled=false`, `synthetic_only=true`, `real_sources_opt_in=false`, and all reads/writes other than that capability response fail closed.

When separately provisioned and enabled, the intended routes are:

| Request | Behavior |
|---|---|
| `GET /api/cloud/capabilities` | Reports the exact versioned contract; real opt-in is true only when all server gates and the dedicated D1 binding exist |
| `GET /api/cloud/records` | Lists current non-expired heads for the verified Owner only |
| `GET /api/cloud/records/{sourceId}` | Reads current SourceRecord and rechecks its canonical SHA-256 fingerprint |
| `GET /api/cloud/records/{sourceId}/history` | Reads immutable revision metadata for that Owner/source |
| `POST /api/cloud/records` | Requires a valid captured SourceRecord, non-empty source text, exact evidence references when supplied, verified-backup and source-specific rights/retention attestations; starts `needs_review` / `not_approved` |
| `PUT /api/cloud/records/{sourceId}` | Requires expected revision + fingerprint and the same source-specific attestations; compare-and-swap; resets review/approval |

Writes require exact same-origin `Origin` and `Sec-Fetch-Site: same-origin`. D1 uses bound statements, Owner-scoped composite keys, append-only revisions/events, a 80 KB record cap, five active records, eight revisions, and a non-extending seven-day retention deadline. No delete route is exposed in this minimum gateway. Worker scheduled cleanup is also behind the existing purge job flag and the separate real-source enablement gates.

The schema shape currently reuses `experiments/phase15-source-sync/schema.sql` only in local SQLite tests. That file is still marked simulation-only: **do not apply it to any existing or live D1**. Provisioning a dedicated database, reviewing/creating its schema, Access route/audience, same-origin production route, UI integration, backup/restore and remote acceptance all remain a separate approval and deployment step. The production app remains local IndexedDB only; these endpoints are not presently reachable at `radar.lamlab.cc`.
