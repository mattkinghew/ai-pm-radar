# AI PM Radar v2.1 — Phase 1.2A Source Contract and Cloud Migration Dry Run
Date: 2026-10-15 HKT
Status: LOCAL CANDIDATE / AUTOMATED QA PASS / CLOUD SYNC INTEGRATION PENDING
Owner Phase 1.1 verdict: Owner stated PASS (includes previously requested Mac-off test by their report). Earlier screenshots and remote D1 queries prove encrypted Access-protected Mac/iPhone entry and independent cloud writes, but the assistant did not independently observe the device shutdown; treat the user-reported acceptance as Owner evidence, not instrumented lab evidence.

## Primary Outcome
Build reliable migration preconditions for the current SourceRecord v2, Source Library v4 and pre-existing Source Inbox workbench backups, without risking old human approvals or cloud data. NO real import, NOT a production or hosted Preview release.

## New source and tests
- lib/cloud-sync-contract.ts: candidate immutable SourceRecord revision model keyed by source ID, current server revision, content fingerprint SHA256 using existing Source Library content contract, explicit review, daily candidate and Source Library reuse approvals as independent per-record events, append-only revision/event history, compare-and-swap 409 model and edit/reject invalidation. SourceRecord binary approval_status stays not_approved in cloud state until an explicitly scoped, approved snapshot is requested, preventing daily approval from implying reuse.
- lib/cloud-migration-preflight.ts: strict, read-only local inspection of explicitly supplied Source Inbox draft backups (version 1) and Source Library backups (version 1/v4 entries). 16 MiB/file and 1000 item safety guards, duplicate-ID detection, invalid entries/quarantine, old workbench-level global approval fingerprint quarantine, no automatic migration of approvals. Returns ONLY aggregate counts and issue codes, never raw text, URLs, emails or SourceRecord IDs. cloud_upload_allowed is *always false*.
- experiments/cloudflare-sync-spike/schema-v12.sql: NEW normalized candidate D1 SQL schema (four tables: per-owner source heads; immutable source revisions; immutable review/approval events; immutable approved Library v4 snapshots). Composite owner/ID and revision FKs, explicit constraints, immutability triggers, indexes. IMPORTANT: D1 has no PostgreSQL RLS; trusted API must enforce verified owner on EVERY query. This schema was executed in ephemeral local Wrangler D1 only, NOT on remote APAC D1 or existing synthetic preview.
- components/CloudMigrationPreflight.tsx and app/cloud-migration-preview/page.tsx: locally rendered file-input-only preview with downloadable metadata-only manifest. Browser never posts source text to a network. The page does not expose upload or migration buttons and has noindex metadata. Existing production UI and protected Preview not updated.
- tests/cloud-sync-contract.test.ts: 11 contract + backup tests, including two approval scopes, per-record isolation, immutable histories, stale rev rejection, bad evidence and migration leak protection.
- tests/cloud-d1-schema.test.mjs: 7 SQL tests covering CAS, two-owner isolation, FKs, immutable history, invalid SQL payload rejection. Integrated both test files in package.json test script, no new dependencies.
- Browser QA screenshot: docs/cloud-migration/evidence/phase12-dryrun-synthetic-390.png (fictional input only).

## Validation / Evidence
- Phase 1.2 contract test 11/11 PASS; D1 schema SQLite test 7/7 PASS; actual local Wrangler D1 schema applied, four normalized tables verified.
- npm test full suite 143/143 PASS; npm run typecheck PASS; validate:data and validate:daily PASS; isolated npm run build:mobile PASS with /cloud-migration-preview static page, no production build replaced.
- Synthetic file-pickers / dry-run E2E Playwright Chromium PASS at viewport 390,768,1280: both draft+library fixtures counted, ambiguous legacy global approvals surfaced, metadata-only manifest downloaded/readback verified to contain NO synthetic source text, URL or record IDs; no horizontal overflow and no JS errors.
- QA initially caught a race when two file inputs were changed rapidly at desktop width; fixed by reading current input.files from refs at click rather than stale React state. After fix all three viewport/browser tests passed.

## Important limits / gates
- New cloud contract model and normalized schema are NOT YET wired into the hosted Phase 1.1 Worker, real SourceInboxWorkbench, Source Library browser storage or Mac/iPhone sync client. Phase 1.2B must implement authenticated API/database transactions, idempotency, owner scoping, per-SourceRecord status in actual UI, and 409 conflict choices with tested migrations.
- Existing remote D1 radar-phase11-synthetic-20261014 remains unchanged. No migrations, user data import, scheduled jobs, Gemini, DNS, Access policy, secrets, billing, production deployment, or Git commit/push.
- The preflight counts structurally recognizable drafts, not validated fully constructed SourceRecord v2. Current workbench form must be converted with versioned id mapping and evidence checking before upload. Legacy global approvals are ambiguous and require human review, NEVER assumed valid.
- Existing Source Library v4 may contain immutable downstream handoffs and delivery packages; do not mutate their fingerprints, reuse approvals or import status when copying.
- D1 immutability triggers block UPDATE/DELETE of revisions/events and Library snapshots; build an explicit retention/privacy/backup policy before real data upload. Old snapshots should be recoverable, but right-to-delete needs an authorized procedure.
- Evidence text-location checking is not semantic fact verification; owner still must inspect key claims. Human Evidence Grade remains manually set.
- Cloudflare Workers Free CPU/latency/storage quotas and real iPhone performance are not measured with full record payloads in this slice.
- Browser-generated IndexedDB backup export files are owned by Owner; assistant did NOT access Chrome profile data or upload any real files.

## Phase 1.2B Suggested Next Gate
1. Protected Preview only: add v1.2 API endpoints under separate /api/cloud/* namespace and new D1 tables without touching existing Phase 1.1 synthetic data, with two-user deny matrix and atomic expectedRevision 409.
2. Use synthetic full SourceRecord v2 and Source Library v4 to test independent review/reuse/daily approvals, cross-device save/edit/reload, immutable events, idempotence and actual Cloudflare Free CPU usage.
3. Owner dry-runs actual exported backups LOCALLY (explicitly selecting files), reviews metadata-only manifest and resolves ambiguous approvals; no source upload before a distinct Owner GO on real data migration.
4. Implement opt-in, per-item cloud save/read with fallback to local IndexedDB, conflict UI, no silent overwrites; keep Mac production local until iPhone acceptance and Cutover GO.
5. Never publish to Daily data automatically; source reuse and daily approval remain separate.
