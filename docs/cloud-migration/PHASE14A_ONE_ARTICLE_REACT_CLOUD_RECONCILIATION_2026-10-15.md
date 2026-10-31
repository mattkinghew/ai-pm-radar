# AI PM Radar — Phase 1.4A One-article React Cloud Reconciliation
Date: 2026-10-15 HKT.
STATUS: PROTECTED CLOUD PREVIEW DEPLOYED; LOCAL AUTOMATED QA PASS; LIVE MAC/IPHONE OWNER UAT PENDING.
General real-source cloud uploads, genuine two-way writes, production cutover and additional article migration remain DISABLED / NOT AUTHORIZED.

## Goal
The actual Next.js React SourceInboxWorkbench UI now consumes the existing Owner-approved clean-room SourceRecord from the isolated Phase 1.3 Cloudflare D1, behind Cloudflare Access. It can verify/download the cloud original, manually stage it to a distinct local IndexedDB, backup the local draft before overwrite, and compare local edits without making a cloud write.

## Live Preview
https://radar-phase13-one-article-dark.lamms280.workers.dev/pilot-source-inbox/
Worker: radar-phase13-one-article-dark
New version: f0ce0255-9eb5-4b01-a56c-08a17e88f13a
Previous Worker version: bcc4cd4e-3d39-4917-be2c-695dabe31596
Original protected Phase 1.3 read-only /pilot-preview/ remains available.

## Delivered implementation
- app/pilot-source-inbox/page.tsx: client-only dynamic import of the true SourceInboxWorkbench.
- components/SourceInboxWorkbench.tsx: additive realPilotPreview mode; distinct IndexedDB named ai-pm-radar-source-inbox-one-article-phase14. Production Workbench and earlier synthetic test mode unchanged. The pilot restricts loading to the single approved ID/title; disabled arbitrary import, subscription and companion/AI analysis; local Review/Approval invalidated after staging.
- components/OneArticleCloudWorkspacePanel.tsx: authenticated same-origin Cloudflare API GET; checks cloud source ID, Revision, expiry, exact SHA256 and literal Evidence. Supports complete cloud JSON download/reselect and verify, local Workbench full JSON backup/reselect before replacing any pre-existing local draft, and explicit manual stage with a fresh D1 revision/hash precondition. Local-only field difference list; no POST/PUT/DELETE.
- lib/pilot-source-reconciliation.ts: pure field-level projection and source ID/body safety guard, unmapped provider/provenance/historical Review reported explicitly, cloud_write_allowed=false always.
- tests/pilot-source-reconciliation.test.ts: 4 newly added and passing regressions; root npm test script includes them.
- experiments/phase13-one-article/worker.mjs: new /pilot-source-inbox/ and /_next/static/* paths served ONLY after verified Cloudflare Access identity. No anonymous ASSETS fetch. CSP restricts scripts and connections to same origin; no change to existing D1 schema or write API.
- experiments/phase13-one-article/prepare-pilot-next-assets.mjs: isolated allowlisted static Next assets, 29 files/1,156,436 bytes. No full official site or browser IndexedDB packaged.
- experiments/phase13-one-article/wrangler-next-pilot-preview.jsonc: ASSETS binding with run_worker_first=true, upload feature flag remains OFF.
- experiments/phase13-one-article/test-pilot-react-workbench-local.mjs: true Next.js/React local Worker, in-memory single-article SQLite/D1 simulation, and two separate Chromium Mac/phone browser contexts. No remote writes.

## Evidence
- Radar npm test 181/181 PASS; typecheck, validate:data, validate:daily PASS; isolated Next npm run build:mobile PASS.
- Full two-browser UI QA PASS: cloud Revision1/hash, original JSON download/reimport, explicit load into real React form, actual Source Inbox full backup/reimport before re-stage, reload IndexedDB persistence, independent iPhone workspace, local summary edit shown as changed field but NEVER uploaded, same-origin network traffic only, zero POST/PUT/DELETE, responsive 390/768/1280, zero JS exceptions.
- Simulated wrong/missing signed Access identities denied BEFORE any HTML, JS or API fetch. Older Worker tests 5/5 and prior Owner preview UI browser tests 2/2 PASS.
- Cloudflare Worker dry-run ~51.33 KiB / gzip 14.46 KiB, 29 Next static assets deployed.
- Live anonymous Access matrix 10/10 PASS: /, older preview+JS, new React route, genuine Next JS/CSS, capabilities, record, history and unknown API each responded HTTP 302 to Cloudflare Access. No anonymous cloud data returned.
- Remote D1 postdeployment 1 article / 1 revision / 1 created event; original full SHA/Evidence parity PASS. Active expiry unchanged 2026-10-22T06:12:29.952Z = 2026-10-22 14:12:29 HKT.
- PILOT_REAL_UPLOAD_ENABLED=false. Official radar.lamlab.cc production health PASS; protected localhost:4320 origin and localhost:4310 companion helper untouched, production out/source-inbox/index.html timestamp remains 2026-10-14 17:53:25 HKT.
- No new paid resources, Access policy changes, Gemini calls, Cloudflare D1 writes, user article migration beyond previously approved single record, git commit, push or unrelated cleanup.

## Limits
- This is Cloud-to-local staging and reconciliation, not full-fidelity bidirectional sync. The cloud original JSON is authoritative for provenance, provider analysis metadata, revision and approvals; old React form may not map these fields exactly.
- No authorization to upload arbitrary real sources or update the cloud record. Owner Mac/iPhone signed-in UAT still pending; automated browser tests simulate identity and local D1, while actual live probes confirmed only anonymous gate and admin read-only D1 parity.
- Seven-day live expiry purge remains PENDING until after 2026-10-22 14:12 HKT. Must check 0/0/0 in remote D1 and note Time Travel backup residual.

## Mac/iPhone Owner UAT
1. Mac open live link and pass Cloudflare Access. Confirm Revision 1, cloud SHA, expiration, upload OFF.
2. Click download full cloud JSON, reselect to confirm hash PASS.
3. Explicitly stage cloud article into real React Source Inbox; verify original title, summary, Evidence and claims. Wait local IndexedDB saved.
4. If re-staging, click backup local Source Inbox Workbench and reselect the downloaded Workbench JSON; only then may the remote staging action be enabled again.
5. iPhone same Access identity and live URL; cloud Revision 1 should show independently, without Mac local draft. Explicitly stage locally. Edit only the local summary and confirm local_fields_differ; D1 revision stays 1. Mac power-off test optional.
6. Keep user-private sources and account credentials out of the pilot.

## Recovery
Urgent Access incident: deploy wrangler-dark.jsonc to close the workers.dev route while retaining D1. Prior Worker bcc4cd4e-3d39-4917-be2c-695dabe31596 is a safe scoped rollback candidate. No official production change.


## Owner acceptance — 2026-10-15
- User replied "PASS" following the Phase 1.4A Mac/iPhone Owner UAT instructions. Record as **Owner-reported UAT PASS**; individual device trace screenshots were not independently captured during this reply.
- Phase 1.4A accepted for read-only cloud SourceRecord + real React local staging, explicit backup and diff; Cloudflare Access protection, local 181/181 test and cloud D1 integrity remain separately verified evidence.
- **PASS does not authorize a real cloud update**, additional article uploads, extension of the one-week expiration, or changes to production. Phase 1.4B controlled-writing development may proceed with simulated tests and read-only/write-disabled cloud deployment; actual cloud writes require a distinct Owner decision.

## Phase 1.4B continuation — controlled update preflight
Owner replied PASS to Phase 1.4A. The protected live React workspace now supports exactly one educational summary update PRE-FLIGHT, verified via Owner identity, D1 Revision/hash, fixed fictional text, local and cloud JSON backups, with no cloud write. Worker version 9d996e9f-6943-4f2a-8ca5-925a2e70297c. See Phase14B report in same docs/cloud-migration folder. The one-week cloud expiration deadline is unchanged.
