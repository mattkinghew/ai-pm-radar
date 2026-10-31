# AI PM Radar — Phase 1.3 One-article Authorized Cloud Upload
Date: 2026-10-15 (HKT).

**Disposition: ONE OWNER-AUTHORIZED CLEAN-ROOM SOURCE RECORD STORED in ISOLATED CLOUDFLARE D1; LIVE DATA PARITY PASS; SIGNED-IN MAC/IPHONE OWNER UAT PENDING; LIVE SEVEN-DAY PURGE PENDING.**

Official radar.lamlab.cc, its original IndexedDB, existing protected synthetic Worker, and existing Source Library unchanged.

## Owner authorization
The Owner expressly responded **同意上傳** on 2026-10-15 to a narrowly specific request to store ONLY this clean-room article, accept up to seven days active retention and potential D1 Time Travel backup residual. The Owner had previously supplied the sanitized JSON backup, whose exact file SHA was compared against the Mac candidate. This does not authorize uploading any other article, employer/customer data or production cutover.

## Verified source
- Title: AI PM Radar：以可追溯證據與人工審核提高 AI 研究資料的可信度
- Source ID: src_b374361cee7c6e132205267306a1e82b
- Original 4,807-byte JSON SHA256: 54c698b9ce1a29615362ce1a5b071f688fa7fd26996934757e2b09281ca1001a
- Canonical 4,167-byte SourceRecord v2 SHA256: bdea79cb77ae17c5467aba2f6a0517abd8368c611e76be45989f9af300ee6474
- Claims: 3. Verbatim Evidence references: 6. Review: needs_review. Approval: not_approved.
- No private historical Source Inbox records, customer/employer confidential source or unrelated data imported.

## Exact upload method and safeguards
**This was an Owner-approved, one-off PRIVILEGED ADMIN D1 MAINTENANCE IMPORT, not an Access-authenticated in-app POST.** The deployed Worker's generic browser POST/PUT capability remains OFF through PILOT_REAL_UPLOAD_ENABLED=false.

1. Generated one exact pinned SQL import via experiments/phase13-one-article/one-time-admin-migration.mjs, checking original file hash, cloud canonical hash, configured article ID, source schema, Evidence and seven-day TTL. Its private SQL file is stored in owner-permissioned Mac directory and was not printed into chat or source control.
2. Rehearsed exact SQL in local in-memory SQLite with foreign keys and one document / one revision / one created event, all same SHA.
3. Exported separate real-pilot empty D1 BEFORE the write. Private Mac backup:
   ~/Library/Application Support/AI PM Radar/phase13-one-article-private/phase13-empty-d1-pre-single-article-upload-20261015.sql (1,651 bytes, mode 600).
4. Read-only remote empty D1 check before writing showed 0 article / 0 revision / 0 event.
5. Executed one exact targeted Wrangler D1 remote SQL file; succeeded.
6. Independently queried remote D1 after upload and AFTER preview deployment. Exactly one document, one immutable revision and one created event; entire remote SourceRecord deep-equal to original approved canonical JSON. Stored SHA matches original canonical SHA, configured Worker hash and revision hash. Owner-scoped key matches verified configured Owner Access email digest. Literal Evidence verification passed.
7. Exported real POST-UPLOAD D1 into private Mac backup:
   ~/Library/Application Support/AI PM Radar/phase13-one-article-private/phase13-d1-with-approved-one-article-20261015.sql (6,803 bytes, mode 600).
8. Restored that ACTUAL cloud SQL export into an isolated local SQLite memory database, confirmed 1/1/1 and SHA. Locally deleted the specifically owned article with cascading revision and event removal -> 0/0/0. Restored from the same SQL backup again -> 1/1/1 with unchanged SHA. **Live D1 article was NOT deleted. This is NOT a verified live cloud purge.**

## Expiry
- Cloud created_at: 2026-10-15T06:12:29.952Z.
- Active-data purge_due_at: 2026-10-22T06:12:29.952Z, **2026-10-22 14:12:29 HKT**.
- Worker GET returns 410 once expired; scheduled hourly D1 purge is configured to delete owner article and all associated revision/event rows. Actual live deletion still requires verification at/after expiry.
- D1 point-in-time Time Travel backups may contain deleted source data until native backup retention expires; do not promise instant permanent erasure.

## Protected signed-in Owner read-only Preview
- URL: https://radar-phase13-one-article-dark.lamms280.workers.dev/pilot-preview/
- Worker version: bcc4cd4e-3d39-4917-be2c-695dabe31596
- Existing read-only local SourceRecord preflight was updated to recognize an already-existing cloud Revision 1, check SHA, original Evidence, review/approval status and TTL. It also allows loading local JSON to verify exact browser-local-vs-remote equality.
- No client-side POST, PUT, DELETE request logic was added; upload remains disabled at server level.
- Post-deployment anonymous 7-path HTML/JS/API probes all returned HTTP 302 redirect to Cloudflare Access.
- Browser automated tests 2/2 PASS for empty and cloud-present modes, full local backup check, zero network writes, mobile responsive and no JS exceptions. Independent Worker tests 5/5 PASS. Radar npm test 177/177 PASS; TypeScript and data/daily validators PASS. Original production origin 4320/helper 4310 healthy.

## Remaining acceptance gates
- **Owner Mac/iPhone UAT pending:** Sign into the same protected preview URL. Confirm cloud Revision 1, record SHA, Evidence, not-reviewed and not-approved states, expiry and optional local backup parity. The Owner must NOT share Access session secrets.
- **Live cloud delete pending:** At or after 2026-10-22 14:12 HKT verify remote D1 article/revision/event counts = 0, and signed-in GET refuses expired content. If automatic cleanup fails, authorized corrective deletion must be narrowly scoped.
- **Not general real-source sync:** This is one authorized Clean-room article, not an arbitrary article uploader, publication, migration of existing user browser storage, or production switch.
- **Rollback:** For serious Access issue, redeploy the existing wrangler-dark.jsonc to remove the public workers.dev route; leave the isolated D1 intact unless a separate owner-directed deletion is needed.


## Owner UAT acceptance — 2026-10-15
- **OWNER UAT: PASS (owner-reported in ChatGPT)**. Following the signed-in Mac/iPhone read-only verification instructions, Owner replied "pass". This is user-reported acceptance; per-device request traces/screenshots were not independently captured in this turn.
- **Phase 1.3 bounded outcome ACCEPTED:** one personally authorized Clean-room article stored in the independent D1 and its server-side full Record/hash/Evidence verified, with an Access-protected read-only Owner workflow. Initial Review remains needs_review and Approval not_approved, not published.
- **Ongoing HOLD:** live post-expiry purge is NOT YET verified; retention expires 2026-10-22T06:12:29.952Z (2026-10-22 14:12:29 Hong Kong time). Confirm documents/revisions/events all zero after expiry; D1 Time Travel backup residual may persist. No deletion of live article ahead of Owner's accepted seven-day retention by this update.
- **Release boundary:** this was a one-time privileged administrator D1 insert with general Worker article upload explicitly OFF. No generic user-supplied real content sync, automatic migration, production switch, Gemini or publishing permission should be inferred from the PASS.

## Phase 1.4A continuation — protected actual React Source Inbox
On 2026-10-15 the actual React SourceInboxWorkbench, backed by a distinct local IndexedDB, was deployed under the same Access-protected Worker at /pilot-source-inbox/. It supports read-only cloud Revision1 verification/download, explicit local staging, local Workbench backup/reselect, and field-diff without cloud writes. See docs/cloud-migration/PHASE14A_ONE_ARTICLE_REACT_CLOUD_RECONCILIATION_2026-10-15.md for complete validation and Owner UAT steps. The one-week deletion deadline remains unchanged.
