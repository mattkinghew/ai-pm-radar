# AI PM Radar — Phase 1.4C Controlled Cloud Commit Candidate
Date: 2026-10-15 (HKT)
STATUS: PROTECTED CANDIDATE DEPLOYED / AUTOMATED QA PASS / OWNER REVISION-2 APPROVAL PENDING / LIVE COMMIT DISABLED.

## Owner acceptance and authorization boundary
Owner replied PASS after Phase 1.4B preflight Owner UAT instructions. Record as Owner-reported signed-in UAT PASS (device-level telemetry not independently captured this turn). Phase 1.4B is ACCEPTED for bounded fixed-summary validation. It does NOT authorize changing any cloud SourceRecord, creating Revision 2, extending the seven-day retention period, allowing general real source upload or changing radar.lamlab.cc production.

## Live protected candidate
URL: https://radar-phase13-one-article-dark.lamms280.workers.dev/pilot-source-inbox/
Cloudflare Worker name: radar-phase13-one-article-dark.
NEW version ID: 4915ed79-480f-41fd-8def-18f37ece75bf.
Rollback previous Worker: 9d996e9f-6943-4f2a-8ca5-925a2e70297c.
Deployment: experiments/phase13-one-article/wrangler-next-pilot-preview.jsonc.
CLOUD_ACCESS_REQUIRED=true, PILOT_REAL_UPLOAD_ENABLED=false, PILOT_WRITE_PREFLIGHT_ENABLED=true, PILOT_CONTROLLED_COMMIT_ENABLED=false, run_worker_first=true.
Endpoint POST /api/pilot/controlled-commit is reachable ONLY after Cloudflare Access authentication and verified exact Owner identity. Despite route existence, backend returns 403 controlled_commit_not_authorized while PILOT_CONTROLLED_COMMIT_ENABLED=false. The browser UI contains no commit action.

## Bounded future candidate and integrity
Existing Owner-authorized Clean-room SourceRecord ID: src_b374361cee7c6e132205267306a1e82b.
Current cloud Revision 1 canonical SHA256: bdea79cb77ae17c5467aba2f6a0517abd8368c611e76be45989f9af300ee6474.
The only allowed future difference is summary changed to: 修訂版：為跨裝置協作增加明確備份與人工衝突處理。
Every other original source field, Evidence and source metadata is preserved by deriving candidate from full CLOUD SourceRecord, not the potentially lossy editable React field projection.
Future Revision 2 would be unreviewed and unapproved; it would not automatically publish or be eligible for Library reuse.

## Implemented changes
1. experiments/phase13-one-article/worker.mjs: narrowly pinned controlled-commit POST behind independent disabled commit flag. Strict body keys: expectedRevision, expectedSha256, backupSha256, confirmedSummary and consentPhrase. Explicit phrase APPROVE_ONLY_THIS_CLEAN_ROOM_SUMMARY, pinned Source ID, known clean-room summary, exact rev1 SHA, Owner binding, live expiry, original source payload SHA, SourceRecord schema and verbatim Evidence all required. Unknown or disallowed data fail closed.
2. D1 batch, verified in isolated SQLite: atomic CAS updates owner-bound head with matching old Revision/hash and expiry; conditional append of immutable Revision 2 and edited event; readback verifies complete new SHA and original unchanged purge_due_at. Failing stale CAS creates no extra revisions, replays return 409. The original Revision 1 remains immutable.
3. components/OneArticleCloudWorkspacePanel.tsx: after Phase 1.4B bounded server preflight, allows download of full future Revision 2 candidate JSON and re-import to check exact SHA, every unchanged field and full original metadata. Clearly marks not committed and no UI operation sends a commit POST.
4. experiments/phase13-one-article/test-worker-local.mjs: 3 additional simulated isolated local D1 cases added (11 total): commit feature OFF and old generalized write remains OFF, successful exact local-only CAS + 1/2 immutable version history + original TTL, and wrong Owner, CSRF, mismatched backup hash, extra fields, consent failure, and expired record rejection.
5. experiments/phase13-one-article/test-pilot-react-workbench-local.mjs: true Next.js React Mac/iPhone Chromium simulation now verifies full local candidate download, exact SHA, evidence/provenance retained, file re-import and OFF flag, with no live cloud write request.
6. Owner PASS recorded in docs/cloud-migration/PHASE14B_CONTROLLED_SINGLE_ARTICLE_UPDATE_PREFLIGHT_2026-10-15.md.

## Evidence actually verified
- npm test: 187/187 PASS, typecheck PASS, validate:data and validate:daily PASS.
- Worker isolated local SQL tests: 11/11 PASS; old local Phase1.3 preview browser tests: 2/2 PASS.
- Isolated Next mobile build PASS; protected static bundle 29 files, 1,163,075 bytes; Worker dry-run ~60.68KiB uncompressed and 15.86KiB gzip.
- Browser full React Mac/iPhone contexts PASS: exact cloud v1 and original backup, true React local staging, full local Workbench backup/re-import, single fixed summary preflight and candidate full JSON download/readback, SHA equality, unchanged evidence, zero D1 writes, independent local drafts, 390/768/1280 responsive, no browser JS exceptions.
- Protected Cloudflare Preview live deployed with version 4915ed79-480f-41fd-8def-18f37ece75bf. Anonymously checked 15/15 URLs/HTTP methods (old HTML, new React HTML/JS/CSS, D1 API, update preflight, disabled commit POST and generic source POST) -> all 302 Cloudflare Access challenge.
- Live D1 postdeploy read-only: exactly 1 source / 1 immutable revision / 1 created event, SHA bdea79cb77ae17c5467aba2f6a0517abd8368c611e76be45989f9af300ee6474, TTL 2026-10-22T06:12:29.952Z unchanged.
- Official protected radar.lamlab.cc local origin 127.0.0.1:4320 and companion localhost:4310 healthy; prod out/source-inbox/index.html modification timestamp unchanged at 2026-10-14 17:53:25.
- No live Cloudflare D1 write/delete, no new subscription, model call, Access policy relaxation, Git stage/reset/commit/push or unrelated production change.

## Owner UAT
1. Mac signed in to the protected URL confirms cloud Revision 1, full SHA and expiry.
2. Download/re-import full original cloud JSON and manually stage into real React Source Inbox.
3. Apply exactly the fixed summary. Download and re-import FULL current React local Workbench backup.
4. Execute server summary update preflight (persisted=false, proposed Revision 2 digest), then choose Download full candidate Revision 2 JSON (NOT COMMITTED); re-import file in the new candidate chooser. Expect PASS for original Evidence, proposal SHA and preserved metadata.
5. iPhone signed in independently can view cloud Revision 1 and stage locally. Cloud is not Revision 2 after these operations. No actual commit button appears; commit capability OFF.
6. Do not use private or other articles, and do not share Access credentials.

## Remaining decision gate
- Owner real device candidate UAT pending. Even if UAT PASS, it does not by itself authorize cloud commit.
- Only after an EXTRA Owner instruction explicitly approving this precise Summary revision, with the original seven-day TTL unchanged, may authorized operators enable the separately pinned commit feature and verify live D1 CAS and readback.
- Real seven-day D1 expiry and cascade delete still pending until 2026-10-22 14:12 HKT; D1 Time Travel residual may survive beyond active row deletion. Do not extend expiry for this new Phase.
- This is not generic self-service real article sync or production cutover.
- Emergency rollback: redeploy wrangler-dark.jsonc to remove Workers.dev ingress, preserving D1; scoped UI rollback to prior Worker version if appropriate.

## Owner UAT acceptance — 2026-10-15
- **Owner-reported UAT: PASS.** User replied "pass" after completing the Phase 1.4C acceptance instructions for the protected clean-room single-article candidate. Signed-in per-device traces and screenshots were not independently captured in this reply.
- **Accepted scope:** fixed clean-room summary candidate, full Revision 2 JSON backup/download/reimport and SHA256 verification, original source/evidence preserved, controlled-commit UI OFF.
- **NOT AUTHORIZED:** production D1 Revision 2 write, enabling the controlled-commit flag, any broad real SourceRecord upload, extending the October 22 seven-day expiry or switching the official radar.lamlab.cc.
- **Required next action:** separate explicit Owner consent to commit exactly the fixed summary text to this one SourceRecord, keeping the original expiry unchanged. Until then, the live commit flag remains OFF.

## Phase 1.4D actual Owner-authorized cloud Revision 2 (2026-10-15)
Owner explicitly approved the exact fixed summary update. A ONE-TIME PRIVILEGED D1 ADMIN CAS SQL (not browser-authenticated POST) created cloud Revision 2. Remote full-record readback confirmed 1 article, 2 immutable revisions, 2 created/edited events, changed summary only, original Revision1 hash unchanged, new Revision2 SHA256 9249bd0181fd7197d93ad6f64f5f689cb4bca3eb1c3faf171adab116c0f7ed13, same Oct22 expiry and not-approved status. Controlled commit and general uploads remain OFF. See PHASE14D_OWNER_AUTHORIZED_REVISION2_COMMIT_2026-10-15.md for QA, backups and remaining signed-in Owner UAT.
