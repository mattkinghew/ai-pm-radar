# AI PM Radar — Phase 1.2C-2 Secure Cloud Gateway
Date: 2026-10-15 HKT
STATUS: Protected Synthetic Gateway DEPLOYED; automated QA PASS; authenticated Mac/iPhone Owner acceptance PENDING.
Production radar.lamlab.cc UNCHANGED. No real articles uploaded.

## Purpose and current limit
Provide a true protected same-origin Gateway for full-structure synthetic SourceRecord v2 and D1: local draft, manual backup, cloud creation, Review, independent Daily/Library approval, revision conflict and restoration. This is a dedicated synthetic workbench page, NOT the actual Next.js SourceInboxWorkbench. The latter remains a local-only opt-in candidate pending secure same-host deployment and distinct authorization for real data.

## Live preview
Gateway: https://radar-phase11-preview-locked.lamms280.workers.dev/gateway-workbench/
Worker name: radar-phase11-preview-locked
Deployed Worker version: 06e9a95d-2c04-428f-b767-695d0a073911
Prior safe Worker version: d568fb77-39bc-4fed-a91a-2b9dca10c648
Protected route GET /api/cloud/capabilities requires signed Cloudflare Access identity and returns full schema support with synthetic_only=true, real_sources_opt_in=false, access_enforced=true, same_origin_required=true, expected_revision_required=true and human_approval_required=true.
New page and script use same-origin /api/cloud/* under Access All Traffic; cannot capture arbitrary real URLs or articles. Fixed synthetic SourceRecord v2 fixture and two bounded synthetic summaries only. Worker validates entire fixture structure on write. No cross-site CORS, no scheduled sync, no model API calls.

## Changes
experiments/cloudflare-sync-spike/cloud-api.mjs: authenticated synthetic capability declaration.
experiments/cloudflare-sync-spike/worker.mjs: protected /gateway-workbench/ and /gateway-workbench/app.js routes with self-only script/connect CSP, no frame embedding.
experiments/cloudflare-sync-spike/gateway-workbench.html: responsive Chinese synthetic gateway UI.
experiments/cloudflare-sync-spike/gateway-workbench-client.js: same-origin capability handshake, local synthetic draft, download/confirm backup, explicit cloud upload, D1 read, independent review/approval, CAS 409 and manual conflict resolution.
experiments/cloudflare-sync-spike/gateway-workbench-ui.mjs: compiled HTML/script string for isolated Worker.
experiments/cloudflare-sync-spike/test-gateway-workbench-local.mjs: real Wrangler local D1 plus Mac/phone separate-browser synthetic workflow.
experiments/cloudflare-sync-spike/test-cloud-auth-local.mjs: identity-denial, CSP and capability regression.
Screenshot: docs/cloud-migration/evidence/phase12c2-gateway-mobile-390-synthetic.png

## Validation
- Synthetic Playwright Mac/phone browser + Wrangler D1 PASS: new full SourceRecord v2, downloaded and read-back backup, explicit create v1, human Review v2, Daily v3 (Library separate), Library reuse v4, iPhone v4 cloud read, explicit remote-to-local staging, local summary change and backup, push v5, current approvals reset, stale Mac rejected 409, manual retain/remote adoption, immutable five-event history, reload persistence.
- Non-synthetic article returns 422; all recorded browser network requests use the same origin; zero page JS errors; 390/768/1280 no horizontal overflow.
- Cloudflare Access denial and CSP tests 12/12 PASS. Cloud API 27/27 PASS. Old Phase 1.1 D1/JWT/API and UI 8/8 PASS. Previous Phase 1.2B cross-device UI PASS.
- Radar npm test 160/160 PASS, typecheck and data/daily validators PASS. Worker dry-run 132.12KiB / gzip 32.89KiB PASS.
- Backed up remote isolated D1 before deployment to user's Mac:
  ~/Library/Application Support/AI PM Radar/cloud-phase12-backups/phase12c2-before-gateway-20261015.sql
  Verified SQL includes original and versioned tables, 30,900 bytes, permissions 600 on file and 700 directory.
- Cloudflare Access anonymous matrix after deployment: 11/11 page/script/API endpoints redirected with 302 to Access login. No unauthenticated 200.
- Before and after D1 counts unchanged: 2 old Phase1.1 records, 4 cloud SourceRecords, 7 immutable revisions, 1 Library snapshot; no schema migration or real data upload in this phase.
- Official Mac production health PASS, listeners still on 127.0.0.1 ports 4320 and 4310; official domain, tunnel, Runner, credentials and billing unchanged. No commit, push, dirty-repo cleanup, production deployment or Gemini calls.

## Real device Owner acceptance: pending
1. Mac open Gateway and log in through Cloudflare Access.
2. Create synthetic workbench draft, download and verify JSON, confirm backup and upload. Check Revision 1.
3. Manually Review -> Rev 2; approve Daily -> Rev 3; approve Library -> Rev 4. Confirm both approval scopes and Library snapshot.
4. iPhone same Access identity and link, select same qa12 source. Confirm Rev 4. Choose manual remote-to-local, switch to synthetic summary B, download/confirm and upload -> Rev 5. Both current approvals should reset; old Library snapshot returns 409.
5. Mac retains unrefreshed Rev 4, edits and tries to upload: 409 with no lost local work. Save backup and manually use new remote Rev 5. Review history 5 events.
6. Test iPhone while Mac fully shut down, and observe actual Cloudflare Worker CPU/D1 metrics. Do not provide tokens, cookies or password.
7. Only after Owner acceptance proceed to Phase 1.2C-3: same-host actual Next.js SourceInboxWorkbench synthetic integration. Real sources still require new explicit Owner authorization and retention/deletion/access safety plan.

## Rollback
Restore the isolated Worker to version d568fb77-39bc-4fed-a91a-2b9dca10c648 using Wrangler rollback; do not touch D1 data or production domain. The D1 backup is a protected local SQL artifact, not a replacement for version-specific approval history.
