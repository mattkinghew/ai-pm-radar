# AI PM Radar — Phase 1.5A Protected Multi-Source Sync Contract
Date: 2026-10-15 HKT

**STATUS: PROTECTED PREVIEW DEPLOYED / SYNTHETIC MULTI-ARTICLE LOCAL QA PASS / GENERAL REAL-DATA SYNC OFF / OWNER UAT PENDING.**

## Goal and accepted previous phase
Owner replied "pass , 下一步" to the Phase1.4D Revision2 Mac/iPhone read-back instructions. This is Owner-reported acceptance, not independently captured device network traces. Existing Phase1.4D was an exactly authorized privileged D1 admin commit, not an authenticated self-service browser commit. The new goal is to replace the one-article-only data contract with reusable multi-article SourceRecord v2 sync.

## Implemented
- experiments/phase15-source-sync/schema.sql: standalone D1-compatible multi-article schema, composite Owner/source ID, immutable revision and event tables, cascade delete and expiry/Owner indexes. NOT APPLIED to live real D1.
- experiments/phase15-source-sync/service.mjs: Owner-scoped list, source create, read, history, revisioned update, explicit per-article delete, expiry purge and capability discovery. The live Worker has SOURCE_SYNC_ENABLED=false and does NOT bind any SYNC_DB; only authenticated capability GET is available.
- Per-source create/update requires source ID + exact SHA matching an explicit backup/rights/retention/Time Travel consent envelope. Invalid schema, missing evidence, unknown client keys, cross-site writes, wrong Owner and disallowed/private records rejected.
- Synthetic-only local fixtures require SYNTHETIC title + rights marker and example.invalid provenance. These labels are NOT an automatic privacy or content-safety certification. Do not enable arbitrary true real-data sync from this check alone.
- Maximum active sources per Owner: 5; maximum 8 immutable versions per source; 80KB canonical source JSON per article; seven-day maximum from initial capture (update cannot extend). Server rewrites Review needs_review and Approval not_approved, never inherits human approvals.
- CAS requires expected revision and SHA; transaction appends history only if prior update succeeded. Explicit Owner delete cascades active source/revisions/events; Time Travel backup residual limitation remains.
- experiments/phase13-one-article/worker.mjs: new Access-authenticated /api/source-sync/v1/* dispatcher and optional scheduled purge, both write-disabled in this live configuration.
- experiments/phase13-one-article/wrangler-next-pilot-preview.jsonc: SOURCE_SYNC_ENABLED=false, SOURCE_SYNC_SYNTHETIC_ONLY=true; NO SYNC_DB binding; old real upload and controlled commit remain OFF.
- components/OneArticleCloudWorkspacePanel.tsx: current REAL React Source Inbox protected page now displays Phase1.5A multi-source readiness card, explicit write OFF, five-article/eight-revision limits and correct current Revision2 state; stops presenting obsolete Rev1-to-Rev2 proposal as pending.
- experiments/phase15-source-sync/test-service-local.mjs: local SQLite tests for two independent synthetic articles, Owner isolation, per-item consent, rights/Evidence validation, CSRF, quota, 8-revision cap, stale CAS including racing update, immutable history, approval reset, deletion cascade, expiry purge and verified Worker Access gating.

## Automated and online evidence
- New multi-article synthetic local service: **12/12 PASS**.
- Full original Radar npm test: **187/187 PASS**. Typecheck, validate:data, validate:daily PASS.
- Existing Phase13/14 worker tests expanded to **13/13 PASS**; old read-only Chromium browser **2/2 PASS**.
- Isolated Next production mobile build PASS. 29 allowlisted static preview assets (~1,165,928 bytes), original production out not overwritten.
- Actual React dual-browser Mac/iPhone Chromium QA PASS: current approved cloud Revision1/Revision2 fingerprint, full backup/restage, local IndexedDB persistence and isolation, responsive 390/768/1280, no JS errors. Phase1.5A capability status OFF independently checked on both browser contexts.
- Live protected Cloudflare Worker version **4ba16221-30cd-41f9-882e-ed49085ea7ff**. Previous rollback version **6e72b502-e149-4d5a-97b4-37cba9cbc985**.
- Postdeployment anonymous Cloudflare Access matrix **18/18 PASS**: HTML, JS/CSS, legacy record APIs, new multi-source capability/list and attempted POST. All HTTP302 redirected to Access.
- Independent real D1 read-only verification AFTER deployment PASS: existing Owner real D1 exactly **1 article / 2 immutable versions / 2 events**. Approved Rev2 SHA 9249bd0181fd7197d93ad6f64f5f689cb4bca3eb1c3faf171adab116c0f7ed13. Original Rev1 SHA bdea79cb77ae17c5467aba2f6a0517abd8368c611e76be45989f9af300ee6474. Original six Evidence, unreviewed/unapproved states, expiry 2026-10-22T06:12:29.952Z unchanged.
- Official radar.lamlab.cc Mac origin 4320 and companion 4310 health PASS; original production build timestamp 2026-10-14 17:53:25. No extra source upload, D1 schema migration, API paid plan, Access policy change, git stage/stash/reset/commit/push or production cutover.

## Not delivered / pending
Phase1.5A is a local synthetic backend contract and deployed read-only capability display, NOT an active multi-source cloud synchronization feature. The new schema was not migrated to any live D1; no multi-source cloud records were created; Owner has not tested cross-device multi-article cloud writes. The previously approved article remains scheduled to expire 2026-10-22 14:12 HKT. Verify live cascade deletion after expiry, noting possible D1 Time Travel backup residual. No retention extension or auto migration was authorized.

## Owner UAT
Open https://radar-phase13-one-article-dark.lamms280.workers.dev/pilot-source-inbox/ on Mac and iPhone via Cloudflare Access. Confirm approved cloud Revision 2 and current SHA, original full JSON download/readback, Phase1.5A status PASS, "多文章雲端寫入 OFF", and no obsolete Rev1 proposal button. Local IndexedDB remains independent between devices. Do not enter confidential data or other real articles.

## Next Phase 1.5B gate
With separate Owner GO, create an independent synthetic-only D1 for Cloudflare Access Mac/iPhone two-or-more-article real cross-device QA: create, update/409, complete JSON backup, history and deletion. Keep existing real-article D1 and all general real sync flags OFF; explicitly review D1 Time Travel retention and cost. Full real data opt-in requires a separate privacy, rights and storage authorization.
