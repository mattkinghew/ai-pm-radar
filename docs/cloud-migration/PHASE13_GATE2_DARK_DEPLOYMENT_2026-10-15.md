# AI PM Radar — Phase 1.3 Gate 1/2: Clean-room Source + Separate Dark Cloud Gateway
Date: 2026-10-15 HKT.
**STATUS: CLEAN-ROOM SOURCE SELECTED; ISOLATED CLOUD GATEWAY DEPLOYED DARK; REAL ARTICLE UPLOAD BLOCKED AWAITING OWNER REVIEW & ACCESS POLICY.**
Production radar.lamlab.cc and synthetic preview unchanged. No real article payload has been written to Cloudflare D1.

## 1. Selected first candidate
Rather than reading the user's existing private browser IndexedDB or assuming that a random customer/NGO source is public, selected a fresh original clean-room article drafted specifically for the migration pilot.
Title: AI PM Radar：以可追溯證據與人工審核提高 AI 研究資料的可信度
SourceRecord ID: src_b374361cee7c6e132205267306a1e82b
Source: locally drafted zh-Hant article, not a copied third-party article, no personal information, customer material, employer workflow or confidential data. Article must be Owner-reviewed and cloud-storage rights attested before LIVE upload.
File: experiments/phase13-one-article/fixtures/clean-room-public-article.json
Generator: experiments/phase13-one-article/create-clean-room-candidate.mjs
Original complete fixture SHA-256: 54c698b9ce1a29615362ce1a5b071f688fa7fd26996934757e2b09281ca1001a
Original JSON file 4807 bytes, canonical sanitized upload 4167 bytes. 3 reviewed-eligible Key Claims; six claim/evidence references matched verbatim (three primary + three inside claims).
Local preflight is BLOCKED ONLY on the nine Owner permission/backup/retention declarations, NOT on structure, evidence or size. Initial Review = needs_review, Approval = not_approved.
No one has yet reviewed or consented to this particular new article, so this is selected but not formally accepted for cloud storage. It is also not yet imported into the Owner's existing Source Inbox; do not claim the migration completed.

## 2. Remote independent infrastructure — deployed
New separate Cloudflare D1: radar-phase13-one-article-20261015 (APAC region), 3 empty tables: pilot_documents, pilot_revisions, pilot_review_events. Separate from existing synthetic D1 radar-phase11-synthetic-20261014. D1 foreign_keys PRAGMA returns 1.
New separate Worker: radar-phase13-one-article-dark.
Worker version: 446c5dae-01da-4e39-8487-7bc5d59426de.
Deployment config: experiments/phase13-one-article/wrangler-dark.jsonc.
Upload **OFF**: PILOT_REAL_UPLOAD_ENABLED=false.
Public routes **NONE**: workers_dev=false, preview_urls=false, no custom domains/routes.
GET https://radar-phase13-one-article-dark.lamms280.workers.dev/api/pilot/capabilities returned **HTTP 404** after deployment. Worker cannot be used for public cloud uploads yet.
Requires verified Cloudflare Access owner digest inside Worker before ANY route, including GET. No token-bearing or forged client headers accepted. The separate new Access application has **NOT** been created or verified.
Pinned article ID and SHA-256 means only Owner-reviewed exact clean-room article or one specifically named edited version can be accepted when future upload is explicitly enabled. No arbitrary private article.
D1 owner_sub explicitly derived from verified Access identity in all SQL operations. One article per owner via UNIQUE(owner_sub). POST requires seven true consent flags, no auto upload or outside-origin POST. D1 revision CAS via expectedRevision; article revisions and human events cannot be updated in place.
GET after seven-day TTL returns HTTP 410 immediately. Hourly scheduled cleanup (0 * * * *) removes expired owner rows and cascades revisions/events. Active D1 deletion can be explicitly triggered only with exact confirmation phrase and current expectedRevision. D1 Time Travel point-in-time backups may still retain deleted bytes up to the Free plan backup retention period.

## 3. Tests actually performed
- Real-pilot preflight unit tests: 10/10 PASS, metadata-only outputs, original SourceRecord review/approval reset, evidence and full backup SHA-256.
- Dark worker unit/integration, in-memory native SQLite: 5/5 PASS. Wrong/no Access identity denied 401, disabled real upload denied 403, arbitrary sensitive content rejected 422 even with valid consent, exact pinned clean-room record create/read/revise; stale CAS returns 409; history versioned; owner-specific full deletion removes parent/revisions/events; expired record returns 410 before hourly job.
- SQLite schema lifecycle script: 9 checkpoint PASS (two owner isolation, one article max, no historical mutation, CAS, purge, restore, TTL).
- Remote independent D1 schema applied and read-only confirmation shows docs=0, revisions=0, events=0, foreign_keys=1.
- Dark Worker dry-run: 31.70 KiB, gzip 8.29 KiB. Deployed to zero routes; workers.dev HTTP 404; Cloudflare Access and paid plan were not relaxed or upgraded.
- Full Radar regression npm test 177/177 PASS, npm run typecheck, validate:data, validate:daily PASS. Original Radar production origin and companion helper healthy on localhost 4320/4310.
- No actual article uploaded (remote D1=0), no model calls, no release to production, no git commit/push, and no private user browser data accessed.

## 4. Next security gate — specific Owner action
To expose the new REAL pilot gateway safely, the Owner must FIRST configure a Cloudflare Access application for the exact future workers.dev hostname with **All traffic protected** and an Allow policy scoped to **the Owner's exact email address** (not a whole email domain). Existing Access policy covering the older synthetic Worker does NOT automatically protect this separate Worker.
The new workers.dev route will remain disabled until this Access app is configured and verified. Once Access policy exists, run a controlled follow-up to enable workers_dev on this isolated Worker and confirm public anonymous attempts to HTML/API still redirect to Access. If Access cannot be confirmed, leave route DARK.
After Access passes, the Owner should review the locally drafted public article and accept seven-day active retention plus possible additional residual storage in D1 Time Travel, confirm backup/restore of the original JSON and authorize only this one document. Then enable an exact pinned article-only upload in an isolated preview (not Production).
User's delegation "any one" authorizes the assistant to PICK an eligible public-safe article, but should not be treated as permission to claim its rights or accept backup residuals on user's behalf.

## 5. Recovery and rollback
No production/synthetic environment rollback is necessary; these remain unchanged.
If Dark Worker is no longer wanted, disable/remove only radar-phase13-one-article-dark (not the Phase1.2 protected Worker). Separate D1 can be removed ONLY after explicit Owner confirmation and export check; currently it contains zero documents. The new Worker's scheduled task is a single hourly expiry purge query; verify actual Cloudflare plan and analytics for accounting.
Ensure no user content or credential is copied into repository logs, test fixture screenshots, chatbot history or published assets. Clean-room fixture is intentionally public-safe but not yet approved for external publishing.
