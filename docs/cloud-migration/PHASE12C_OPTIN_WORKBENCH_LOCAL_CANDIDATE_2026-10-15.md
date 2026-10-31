# AI PM Radar v2.1 — Phase 1.2C Opt-in Workbench Sync, Local Candidate
Date: 2026-10-15 HKT
Owner disposition: Phase 1.2B PASS, proceed to Phase 1.2C.
Current stage: **PARTIAL / LOCAL CANDIDATE QA PASS; REAL CLOUD SYNC BLOCKED BY EXPLICIT NEXT SECURITY/CONSENT GATES.**
The production radar.lamlab.cc deployment, its Cloudflare Tunnel and Phase 1.2B Worker remain unchanged.

## Outcome
The first Phase 1.2C slice is integrated directly in the **actual SourceInboxWorkbench** UI as a collapsed, default-off Cloud Sync preparation panel. It provides a durable per-material Cloud ID, mandatory browser-local workbench JSON backup and user confirmation, safe restoration of Cloud ID mapping, dry-run SourceRecord v2 readiness, and distinct conflict/consent decision contracts. **No real SourceRecord is sent to Cloudflare.**

## What changed
- components/SourceInboxWorkbench.tsx: introduces CloudSyncOptInPanel after the local save bar. Backup explicitly awaits the IndexedDB transaction via persistWorkbench(currentWorkbench()) before prompting the complete workbench export. No modification to capture, AI, manual Review/Approval, Daily or Source Library workflows.
- components/CloudSyncOptInPanel.tsx: default-collapsed consent panel; identity provisioning only after complete local backup triggered, user confirms file exists, local persistence is ready and backup content fingerprint still matches active source. Source edits invalidate backup confirmation. Displays candidate SourceRecord v2 validity/size/content hash locally and states the current Cloudflare Preview remains SYNTHETIC ONLY. Allows explicit JSON metadata-only export; matching Material ID import is inspected first and restored only after separate confirmation. Never overwrites existing different Cloud ID.
- lib/cloud-workbench-sync.ts: source content ID is assigned once per material independent of source URL / mutable text; cloud draft strips inherited global workbench approval flags; SHA256 fingerprint; four-way conflict calculation; explicit user choice contract, no automatic last-write-wins; future server acknowledgements require positive revision, correct ID and valid fingerprint.
- lib/cloud-sync-local-store.ts: separate IndexedDB database ai-pm-radar-cloud-sync-metadata storing only per-material ID/revision/fingerprint metadata. Insert-only transaction rejects duplicate Cloud ID creation from another tab; does not store any article text, private keys or Access sessions.
- lib/cloud-sync-capability-gate.ts: Future real-article write plan cannot be constructed without a fresh source-specific consent and locally verified backup, identical HTTPS origin to authenticated gateway, explicit access/real-source/version/approval/CAS capability flags and source ID/fingerprint match. This is a PURE contract, not a deployed gateway, credential mechanism or actual sender. Current Phase 1.2B API is synthetic_only and lacks the capabilities endpoint; it is correctly BLOCKED.

## Automated evidence
- 11/11 cloud-workbench-sync tests PASS: stable source identity, approval stripping, SHA/fingerprint, material changes, 4-way conflict routing, 409 manual resolution, remote absence, revision ACK.
- 6/6 capability tests PASS: reject HTTP/other-origin, synthetic-only and missing Access/revision/approval policy, require per-record consent/backup, require server-ACKed expectedRevision, block conflicts.
- Actual isolated Chromium SourceInboxWorkbench UX PASS: 390px synthetic draft created, Workbench backup JSON downloaded and parsed; cannot prepare Cloud ID before explicit download+confirmation; Cloud ID persisted/reloaded across tabs; binding metadata JSON downloaded and read back without source text; NO outbound Cloudflare requests and no console page errors.
- Browser restore PASS: second isolated browser context imports existing Workbench draft export and mapping JSON, previews Cloud ID first, confirms insert-only restoration, then after allowing IndexedDB autosave to commit, full reload preserves same ID. A test initially reloaded immediately after restore/import and timed out; waiting for the existing Workbench local-save confirmation removed the race (no code change in existing draft import logic in this slice).
- Viewport 390/768/1280 horizontal overflow checks PASS. Screenshot (synthetic QA): docs/cloud-migration/evidence/phase12c-optin-local-workbench-390.png.
- Current full suite and isolated static build results are documented below after final validation; no root repo stage/commit/push.

## IMPORTANT: What is NOT completed
This is NOT actual Mac/iPhone real article sync. The production UI only has a local-preparation candidate. The protected Cloudflare Worker remains SYNTHETIC_ONLY and refuses all real article uploads, while radar.lamlab.cc and protected workers.dev have different origins and separate Access middleware. Direct browser POST across those domains would not qualify as a secure same-origin session. The following are **blocking prerequisites for cloud sync**:
1. Design and deploy a same-origin Access-authenticated minimum-scope gateway, or migrate only an independently approved preview frontend behind the same protected hostname; do not weaken Cloudflare Access or allow unauthenticated CORS.
2. Server must expose GET /api/cloud/capabilities with exact supported real-source/schema, max payload, Access-enforced, human-approval and expectedRevision flags. The existing test Worker deliberately lacks this endpoint for real data.
3. Extend server validation from canned synthetic fixtures to full SourceRecord v2 data with provenance, evidence grade, idempotency and retention policy; ensure Privacy/Delete/Recovery/size/CPU quotas. Keep manual human review independent of the legacy workbench-global approval.
4. Add explicit one-source upload/download consent, backup verification, Server-Version CAS and interactive conflict choices with no auto overwrite, plus real Cloudflare Access authorization tests for a different human account.
5. Perform opt-in first REAL article upload only after fresh explicit Owner authorization. The Owner did NOT authorize real data transfer by saying "PASS, next phase". No Gemini, publishing or runner migration without separate scope.
6. Mac/iPhone genuine same-source sync UAT and Mac-off acceptance must occur after this gateway. Do not report this Phase 1.2C candidate as real cloud sync PASS.

## Recovery/rollback
- Current official radar.lamlab.cc unchanged; no deployment rollback needed.
- Cloud Sync panel state is isolated metadata-only IndexedDB. Existing Source Inbox workbench IndexedDB remains the system of record; no import/overwrite or mutation of production records was made.
- To reverse the candidate code later, remove CloudSyncOptInPanel import/render in SourceInboxWorkbench; do NOT clear real user browser storage.
- Downloaded workbench JSON and mapping JSON are LOCAL backups. A mapping JSON includes material IDs, so it should not be published even though it contains no article body.

## Next bounded Phase 1.2C step
**Secure Cloud Gateway + Synthetic real-workbench round-trip**, initially with only synthetic but fully structured SourceRecord v2 in a new same-origin protected Preview, with explicit opt-in UI, predictable conflicts and dry-run restoration. Following Owner acceptance, separately authorize a real article opt-in migration trial; preserve local IndexedDB and Data Library as authoritative until reconciliation PASS.

## Final 2026-10-15 validation
- `npm test`: **160/160 PASS; 0 FAIL** (includes 11 cloud-workbench reconciliation tests and 6 secure capability-gate tests).
- `npm run typecheck`, `npm run validate:data`, `npm run validate:daily`: PASS.
- `npm run build:mobile` in isolated `/tmp/radar-build-20261013.HV41`: PASS, new Source Inbox and Migration Dry Run statically built. No production build replacement.
- UI/browser synthetic QA: full Source Inbox backup download/readback, explicit Cloud ID setup, source-content fingerprint readiness, metadata-only binding export, reload + second tab stability, 390/768/1280 layout, 0 outgoing cloud API requests, 0 page JavaScript errors: PASS.
- Manual import restore: separate empty browser context imported exported Source Inbox backup + cloud binding, verified matching ID before confirmation, restored to IndexedDB, waited for durable Workbench autosave, reloaded and verified identical Cloud ID: PASS.
- Synthetic screenshot: docs/cloud-migration/evidence/phase12c-optin-local-workbench-390.png.
- QA-only Next.js port 3001 stopped on verified isolated test directory. Production origin 4320 and API helper 4310 remain running; old static published build timestamp unchanged (2026-10-14 17:53:25 HKT). Cloudflare Worker/D1 not redeployed, charged AI model not called, no real source uploaded, no staging/commit/push.
- Final status **PARTIAL** because real cloud same-origin secured gateway, real SourceRecord server capability API, opt-in real upload and Mac/iPhone remote reconciliation are not yet implemented or authorized.
