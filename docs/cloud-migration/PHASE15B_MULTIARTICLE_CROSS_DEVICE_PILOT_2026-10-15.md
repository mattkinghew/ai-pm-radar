# Phase 1.5B — Multi-article Cross-device Synthetic Pilot
Date: 2026-10-15 HKT
STATUS: PROTECTED CLOUD PILOT DEPLOYED; LOCAL DUAL-BROWSER QA PASS; ACTUAL SYNTHETIC CLOUD D1 WRITE/UPDATE/DELETE SMOKE PASS; OWNER SIGNED-IN MAC/IPHONE UAT PENDING.

## Owner authorization and boundary
Owner explicitly approved Phase 1.5B Multi-article Cross-device Pilot GO. This permits a separate synthetic test D1. It does NOT permit uploading private or arbitrary real SourceRecords, weakening Cloudflare Access, extending the original seven-day retention deadline, migrating the official website or introducing extra subscriptions.

## Live URL / deployment
https://radar-phase13-one-article-dark.lamms280.workers.dev/multi-source-pilot/
Final protected Worker version: 803cf61c-b573-45e0-b9eb-dcea31d72861.
Rollback Worker version: 4ba16221-30cd-41f9-882e-ed49085ea7ff.
The existing Cloudflare Access-protected Worker hostname is reused; no new unprotected workers.dev hostname is exposed.
Deployment profile: experiments/phase13-one-article/wrangler-phase15b-synthetic-protected.jsonc
Config: CLOUD_ACCESS_REQUIRED=true, SOURCE_SYNC_ENABLED=true, SOURCE_SYNC_SYNTHETIC_ONLY=true; both real-data flags PILOT_REAL_UPLOAD_ENABLED=false and PILOT_CONTROLLED_COMMIT_ENABLED=false. Worker-first assets and hourly retention job retained.

## Data isolation
Original DB binding DB: radar-phase13-one-article-20261015, stays 1 document / 2 immutable revisions / 2 events, current v2 SHA 9249bd0181fd7197d93ad6f64f5f689cb4bca3eb1c3faf171adab116c0f7ed13, original expiry 2026-10-22T06:12:29.952Z (= 2026-10-22 14:12:29 HKT).
New binding SYNC_DB: radar-phase15b-synthetic-20261015, separately created in Cloudflare D1 APAC and initialized with experiments/phase15-source-sync/schema.sql. This database is distinct from all real and legacy synthetic SourceRecord databases; it starts empty and was restored to 0/0/0 after administrative smoke QA.

## Safety design
- Six fixed, wholly fictional, invented SourceRecord v2 fixtures, three available in UI. Each has exactly two approved summary versions. Only entire canonical records matching these exact fixture allowlists are accepted. A user cannot upload arbitrary data by renaming it SYNTHETIC. No real existing Owner/employee/client source body is copied into these fixtures.
- All URLs point to invalid test-only domains. Exact owner principal is computed from server-verified Cloudflare Access identity.
- SourceRecords are restricted to five active articles, eight immutable revisions per source, 80KB per source, maximum seven-day TTL from first creation. Edits do not extend TTL.
- Candidate source JSON is downloaded and reselected client-side with SHA-256. User explicitly confirms rights, offline backup, seven-day retention and Cloudflare Time Travel residual. The server validates candidate SHA and consent booleans; booleans alone cannot cryptographically prove a backup exists.
- PUT requires expected Revision and expected SHA, 409 CAS blocks stale revisions, losing concurrent writers do not append history. Every edit resets Review to needs_review and Approval to not_approved.
- DELETE requires explicit confirmation, source ID and expected Revision; parent deletion cascades revisions and events. D1 Time Travel residual is disclosed.

## Implemented
- experiments/phase15-source-sync/fixtures.mjs: all synthetic source contents and exact whole-record approval variants.
- experiments/phase15-source-sync/service.mjs: fixed-fixture discovery, Owner-scoped create/read/list/update/history/delete and scheduled deletion.
- experiments/phase15-source-sync/schema.sql: separate D1 schema, immutable history and Owner/source indexes.
- experiments/phase15-source-sync/pilot-ui/index.html, app.js and build-ui.mjs: standalone protected mobile-responsive UI with article selector, complete backup/reselect, SHA validation, owner consent, version checks, 409 conflict explanation, history and targeted delete.
- experiments/phase13-one-article/worker.mjs: protected UI served only after Access owner validation, separate synthetic D1 CRUD routes. Original single real article endpoints remain disabled for writes.
- components/OneArticleCloudWorkspacePanel.tsx: synthetic pilot link and real-data sync OFF messaging in protected original React Source Inbox.
- experiments/phase15-source-sync/test-cross-device-browser-local.mjs: separate actual Mac/iPhone Chromium contexts with shared in-memory SQLite and simulated verified Access identity, creates two sources, iPhone updates one, Mac stale update receives 409 and refreshes history, then deletes other article and verifies phone update.

## Evidence
- Radar npm test 187/187 PASS; typecheck, validate:data and validate:daily PASS.
- Original Worker tests 13/13 PASS, older readonly browser 2/2 PASS; isolated multi-source service tests 12/12 PASS after strict fixture allowlist.
- Real two-context Chromium Mac 1280px and iPhone 390px E2E PASS for create x2, modify and conflict, full JSON SHA backup/readback, history, delete and phone refresh. No JavaScript exceptions or horizontal overflow at 390/768/1280. This is locally simulated Access and SQLite, NOT live signed-in Mac/iPhone.
- New independent Cloudflare D1 remote ADMINISTRATIVE synthetic smoke PASS: 2/2/2 create, 2/3/3 updated, 1/2/2 after targeted cascade delete, then 0/0/0 after cleanup. This confirms physical D1 operations, NOT live signed-in client HTTP POST.
- Protected Worker deployed version 803cf61c-b573-45e0-b9eb-dcea31d72861, anonymous Cloudflare Access probe 20/20 routes PASS (all 302 to Access; includes HTML, JS, original APIs, new fixture/list/source APIs and POST).
- Live postdeployment real original D1 unchanged at 1/2/2, original v2 SHA, Evidence and TTL intact; synthetic D1 back to 0/0/0. Mac official radar.lamlab.cc 4320 protected origin and companion helper 4310 health PASS; original production source-inbox build timestamp 2026-10-14 17:53:25 unchanged.
- No additional real data was synchronized; no Access policy changed; no production cutover, paid subscription, model API use, Git reset/stash/commit/push.

## Owner UAT
1. Mac open protected live URL and pass Cloudflare Access; confirm exactly three fictional cards and initially empty cloud list.
2. Select the paper-crane article summary v1. Click download full candidate JSON, reselect exactly this file to verify SHA. Tick three consent boxes and Create; expect cloud Revision1.
3. Repeat with the cloud-plant article; list now has two records.
4. On Mac read paper-crane from cloud to pin Revision1, then do not refresh its remote state yet.
5. iPhone sign into SAME protected URL with same Access identity. Select paper-crane, change to summary v2, download/reselect candidate, tick consents, read cloud Revision1 and UPDATE; expect Revision2 and unchanged first-created expiry.
6. Back on stale Mac, change only summary dropdown to v2, download/reselect candidate and attempt UPDATE without refreshing previously pinned Revision1. Expect HTTP409; no automatic overwrite. Refresh cloud and inspect immutable history to reconcile.
7. For deletion, download original cloud JSON of the cloud-plant source, verify candidate backup and explicitly confirm deletion. Ensure only cloud-plant article and its history are removed; paper-crane remains with two revisions.
8. Do not enter private/customer/employer or any other real article or Access tokens. Report PASS/PARTIAL/BLOCKED with observed devices and blockers.

## Remaining gates
- Signed-in Owner actual Mac/iPhone LIVE end-to-end UAT is PENDING. Admin smoke cannot substitute for this.
- The real original article must be checked for actual scheduled deletion at/after 2026-10-22 14:12:29 HKT. D1 Time Travel may retain data in backup snapshots according to the account plan.
- Arbitrary real-source Cloud Sync, rights/PII control, new user auth, production migration and long-term data retention have not been authorized or built.
- Worker emergency lockdown: experiments/phase13-one-article/wrangler-dark.jsonc. Previously deployed Phase1.5A config disables new sync; existing D1 data and Owner private backup should remain.


## Owner UAT result and remote data reconciliation — 2026-10-15
- **Owner-reported Mac/iPhone UAT: PASS**. Owner replied "pass" after the signed-in two-device UAT instructions. This is Owner testimony, not independently captured browser network traces, screenshots or an audit event export.
- **Read-only post-UAT synthetic D1 observation: ZERO current active rows**, documents=0, revisions=0, events=0 in radar-phase15b-synthetic-20261015.
- The expected state had the optional step of removing the SECOND article but keeping the FIRST at Revision 2 (normally 1 document / 2 revisions / 2 events). There is no surviving evidence of that outcome. This may reflect manual additional cleanup, but whether Owner manually deleted both is **UNKNOWN**, not proven by zero rows.
- Therefore distinguish **Owner-reported flow PASS** from **independent live authenticated cross-device cloud-write evidence: INCOMPLETE / cannot verify retrospectively**. Do NOT claim cloud UAT history was verified from current D1. The earlier admin remote D1 smoke and simulated browser 409 tests remain valid but are separate evidence.
- The EXISTING REAL D1 radar-phase13-one-article-20261015 was checked read-only and remains exactly 1 article / 2 revisions / 2 events. Rev2 SHA 9249bd0181fd7197d93ad6f64f5f689cb4bca3eb1c3faf171adab116c0f7ed13, original rev1 immutable and purge_due_at 2026-10-22T06:12:29.952Z unchanged.
- Cloudflare Access anonymous GET for multi-source pilot, source record list and original React workbench all returned HTTP 302 to Access login. No anonymous bypass observed.
- No change to the application, D1 content, feature flags, Cloudflare Access, production, subscription, Git or retention in response to this Owner PASS. This turn only appended acceptance/reconciliation notes.
- Next recommended gate: Phase 1.5C, a bounded real-source governance/readiness review. BEFORE any real article upload/sync, obtain separate Owner authorization for exact source, rights/PII screening, original backup/restore confirmation, quota/retention, consent audit, fail-closed 409 and signed-in network-level evidence. Keep general real-data write OFF until authorized.

## Phase 1.5C continuation — Protected local-only real-source governance (2026-10-15)
Owner replied "pass, next Real-source Sync Governance & Readiness". Phase1.5C added an Access-protected offline SourceRecord v2 review page checking v2 fields, Evidence, conservative sensitivity hints, byte-exact local backup and nine human attestations. It never authorizes real cloud upload. Worker e1484f3f-3f00-4691-a48f-01db310691fe, 22/22 anonymous Access probes PASS, original real D1 still 1/2/2 and expiry Oct22 unchanged, synthetic D1 still 0/0/0. See PHASE15C_REAL_SOURCE_GOVERNANCE_READINESS_2026-10-15.md for evidence and Owner UAT.
