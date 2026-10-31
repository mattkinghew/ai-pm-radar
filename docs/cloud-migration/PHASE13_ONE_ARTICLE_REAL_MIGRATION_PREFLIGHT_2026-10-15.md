# AI PM Radar — Phase 1.3 One-article Real Data Migration Pilot
Date: 2026-10-15 HKT
STATUS: GATE 0 LOCAL PREFLIGHT PASS; OWNER ARTICLE SELECTION AND REAL CLOUD UPLOAD BLOCKED.
Official production, private IndexedDB and Cloudflare synthetic Preview remain unchanged. No real article was read or transferred.

## Purpose and authorization boundary
The Owner requested GO Phase 1.3, but did not designate a particular Source Inbox article. No article can be guessed or migrated without its identity, upload rights, consent and final single-record approval. The existing Cloudflare Worker enforces SYNTHETIC_ONLY and the existing D1 holds only synthetic QA; keep them unchanged.

## Findings
1. Existing Cloud SourceRecord v2 validates schema and human approvals, but a real upload needs explicit verification of every Evidence excerpt in captured source, rights, privacy and source retention.
2. D1 does not have PostgreSQL RLS; each query must be owner-scoped using verified Cloudflare Access identity. Current synthetic Cloudflare Access cannot be assumed sufficient for a new real-data Worker without tested wrong-identity access denial.
3. Existing synthetic revision/library tables prohibit DELETE. A new dedicated real-data pilot schema is necessary for verified deletion, without weakening synthetic audit integrity.
4. D1 Free Time Travel can retain deleted information for up to seven days. Explicit deletion cannot promise immediate permanent removal from underlying point-in-time backups. Local exported backups remain Owner-controlled.
5. Current synthetic D1 metadata check: about 106KB; two legacy synthetic rows, four Cloud SourceRecord rows and seven revisions. This is not an account billing-tier verification and cannot guarantee future free usage.

## Implemented, LOCAL ONLY
- lib/phase13-real-pilot-preflight.ts: safe metadata-only SourceRecord v2 eligibility; exact Evidence phrase checks; maximum 100000 bytes; captured status; no pending AI analysis; nine affirmative Owner declarations (rights, no confidential/PII, original backup and tested restore, retention/deletion and backup residual understanding, source-specific upload approval). Produces SHA-256, record size and blocker codes; no titles, raw texts, URLs, JWTs, emails or secrets in report. It does not call a remote API.
- tests/phase13-real-pilot-preflight.test.ts: ten PASS tests for consent block, schema, evidence, approval reset, hashes, offline backup readback and data minimization.
- experiments/phase13-one-article/schema.sql: proposed independent one-article-per-Owner SQL schema. Separate Owner-scoped source/revision/event tables, explicit parent-delete cascading through history; no update of historical events. Retention due date held per pilot. NOT applied to Cloudflare.
- experiments/phase13-one-article/test_pilot_sqlite.py: nine synthetic LOCAL SQLite checkpoints PASS: two Owner isolation; at most one article each; wrong-Owner read denied by scoped SQL; no event/revision update; compare-and-swap; offline JSON backup SHA-256 equality; targeted article/revision/event purge; other owner preserved; synthetic restore equality; expiration lookup.
- No new remote D1/Worker, database migration, real source inspection, credential changes, model calls, production DNS switch or Git push.

## Proposed policy (Owner consent pending)
- Precisely ONE Article/Cloud ID. Only public or personally authored content for which the Owner has cloud storage rights; no employer/customer confidential data or personal/sensitive data.
- Dedicated isolated Cloudflare Access Worker plus separate D1; never reuse existing synthetic QA data tables for real articles.
- Retention maximum seven days in active pilot D1. Explicit deletion whenever requested; automatic expiry must be built and tested before any real upload.
- Native D1 Free Time Travel can retain older states up to seven days; deletion cannot guarantee immediate absence from backup storage.
- Original Source Inbox IndexedDB remains system of record. Preserve a local original backup and a separate candidate backup; never copy legacy Review/Approval to cloud.
- Each remote write must require fresh authenticated identity, exact source ID, source-specific explicit approval, server-side SourceRecord v2/Evidence validation, per-source allowed payload and revision CAS 409; no background transfer or automatic conflict merge.
- No model APIs, publishing, third-party exports, private logging or actual content in reports.

## Gates / Acceptance
G0 — PASS: local planning, metadata-only preflight and SQLite synthetic deletion/recovery.
G1 — BLOCKED: Owner chooses one existing Source Inbox material title/ID and confirms rights, privacy and accepts seven-day pilot plus Time Travel residual. Do not paste confidential text.
G2 — BLOCKED: Deploy independently Access-protected real-data Worker and D1 only after reviewing this choice and permission. Implement real SourceRecord gate, genuine remote purge endpoint, expiry job and quotas.
G3 — BLOCKED: Real article LOCAL backup with verified JSON readback, SHA-256 and evidence matching; candidate review status reset. Upload preview must contain only approved metadata.
G4 — BLOCKED: Fresh explicit Owner go/no-go for the identified record and exact cloud destination. Only then upload ONE real article.
G5 — BLOCKED: Mac/iPhone same-record cloud readback, compare exact fingerprint and original Evidence, approval governance and stale edit 409. Check actual quota and CPU.
G6 — BLOCKED: Owner-requested or seven-day deletion; prove D1 source, revisions and events absent while acknowledging backup residual and deciding disposition of local backups.

## Cloudflare cost, limits and recovery references checked 2026-10-15
Workers Free: 100,000 requests/day, 10ms CPU/request. D1 Free: 5 million rows read/day, 100,000 rows written/day, maximum 500MB per D1 database, 5GB account storage and seven-day Time Travel. Daily Free D1 limits are actively enforced as of September 2026. Account plan, current quotas and real Worker CPU utilization are not yet independently verified. Never enable automatic paid upgrades. Official docs:
https://developers.cloudflare.com/workers/platform/limits/
https://developers.cloudflare.com/d1/platform/pricing/
https://developers.cloudflare.com/d1/platform/limits/
https://developers.cloudflare.com/d1/reference/time-travel/
https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/

## Immediate Owner decision
Which existing public/user-owned Source Inbox article should be the one pilot? Provide only the article title or Source Inbox material ID, and confirm rights, absence of employer/customer or personal sensitive information, and acceptance of seven-day trial retention plus possible seven-day Time Travel residual. Do not send the article body here.

Rollback: Gate 0 made no live cloud or production changes; preparatory files can remain or be ignored.

## Final local regression
- Radar npm test: 177/177 PASS, no failures.
- npm run typecheck, npm run validate:data, npm run validate:daily: PASS.
- Phase1.3 preflight 10/10 PASS; synthetic SQL lifecycle all nine checkpoint statements PASS.
- npm run health:mobile PASS: protected Mac origin listening on 127.0.0.1:4320; existing Gemini helper configuration observed, not called during Phase1.3.
- No cloud credentials retrieved or logs containing actual source records; no real data migration or remote writes.

## 2026-10-15 continuation after Owner delegated article choice
Owner authorized assistant to choose an arbitrary suitable article to keep work moving. To avoid inspecting private browser storage, the assistant selected a freshly authored clean-room public-safe article with a stable SourceRecord and matched original-text Evidence. Dedicated separate D1 + DARK Worker deployed; route disabled and upload explicitly disabled. Full details, SHA-256 and safe rollback: docs/cloud-migration/PHASE13_GATE2_DARK_DEPLOYMENT_2026-10-15.md.
G1 article selection is RESOLVED to clean-room candidate but Owner rights/retention acceptance remains pending. G2 isolated backend infrastructure is DEPLOYED DARK; new Access All Traffic app not yet configured. G3 offline article preparation+backup integrity PASS. G4 actual cloud upload remains BLOCKED; new D1 contains zero documents.
