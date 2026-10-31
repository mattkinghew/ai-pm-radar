# AI PM Radar — Phase 1.3 Access-Protected Owner Preflight
Date: 2026-10-15 HKT
Status: PROTECTED PREVIEW DEPLOYED; ANONYMOUS CLOUDFLARE ACCESS 7/7 PASS; LOCAL AUTOMATED QA PASS; AUTHENTICATED OWNER UAT AND ARTICLE CONSENT PENDING.
REAL ARTICLE CLOUD UPLOAD REMAINS DISABLED. Official radar.lamlab.cc and synthetic Preview unchanged.

## Live preview
https://radar-phase13-one-article-dark.lamms280.workers.dev/pilot-preview/
Worker name: radar-phase13-one-article-dark
Deployed version: 8a120e15-311f-4fa7-8c02-0620c7702df2
Deployment config: experiments/phase13-one-article/wrangler-protected-preview.jsonc
workers_dev=true; preview_urls=false; no custom routes; separate isolated D1 unchanged.
CLOUD_ACCESS_REQUIRED=true, PILOT_REAL_UPLOAD_ENABLED=false. Worker pins exact allowed candidate ID/SHA256, even when the upload is enabled in a later separately authorized stage.
Hourly seven-day expiry cleanup retains its earlier deployment configuration.

## Implemented
- experiments/phase13-one-article/pilot-preview.html: mobile-friendly Chinese preflight UI for local SourceRecord JSON selection, backup, rights and retention acknowledgements. Explicit upload disabled.
- experiments/phase13-one-article/pilot-preview-client.js and pilot-preview-ui.mjs: Browser File API checks exact article ID, canonical SHA256, SourceRecord v2 and verbatim Evidence, then downloads sanitized candidate JSON and requires the user to import the just-downloaded backup to verify it. All content stays within browser memory; the page never POSTs source content.
- experiments/phase13-one-article/worker.mjs: Access-protected preview HTML and JS routes, CSP script-src/connect-src self only, live PINNED_ARTICLE_SHA256 read-only capability, historical event endpoint now refuses expired records.
- experiments/phase13-one-article/test-preview-ui-local.mjs: 2 complete tests, including failed/spoofed identities for HTML, JS and API; real Chromium document selection, SHA256, backup download/reimport, 7/7 local checkbox flow, no non-GET request, zero JS errors and mobile/desktop responsiveness.
- Deployment control: separate prior experiments/phase13-one-article/wrangler-dark.jsonc retains workers_dev=false with upload=false; can re-deploy to close ingress safely if Access fails.

## Selected candidate
Title: AI PM Radar：以可追溯證據與人工審核提高 AI 研究資料的可信度
Local file: /Users/mattgor/Documents/Daily/ai-pm-radar/experiments/phase13-one-article/fixtures/clean-room-public-article.json
SourceRecord ID: src_b374361cee7c6e132205267306a1e82b
Clean-room, AI-assisted, locally generated for this test. No original private materials reused; three Key Claims and three matching verbatim Evidence passages. Owner still must review rights and consent to upload.
The final cloud upload remains OFF; no cloud D1 insert was performed.

## Live acceptance evidence
- Anonymous Cloudflare Access redirects 7/7 PASS: /, /pilot-preview/, /pilot-preview/app.js, /api/pilot/capabilities, /api/pilot/record, /api/pilot/history and /api/unknown returned 302 to cloudflareaccess.com.
- Signed-in exact Owner browser has NOT been independently observed; Owner Mac/iPhone UAT still pending.
- Separate D1 live count after deployment: 0 articles, 0 revisions, 0 events. No source content uploaded.
- Isolated Worker security / expiry / CAS tests: 5/5 PASS.
- Browser File API / SHA / local backup / no-upload: 2/2 PASS.
- Radar npm test 177/177 PASS, typecheck PASS, protected original Mac origin/helper healthy. No Gemini, no billing plan change, no source library migration, no Git commit/push.

## Owner Mac UAT
1. Open protected preview URL and sign in to Cloudflare Access.
2. Choose the selected local clean-room JSON file from the project path above.
3. Confirm SHA256 and all Evidence matched.
4. Download the sanitized proposed backup; re-import that backup in the second file picker. Confirm SHA PASS.
5. Review and consciously check all seven rights/retention/privacy acknowledgements; the status should read 7/7 ready, but no cloud POST will occur.
6. Optionally view the same link on iPhone and ensure Access login works. No private file needs to be pasted into ChatGPT.

## Remaining authorization and next gate
The user's Cloudflare Access PASS confirms policy configuration, and live anonymous redirects substantiate it. It does not permit immediate real upload or assume consent for a seven-day active retention period and residual Time Travel backups. The Owner must separately accept this policy and confirm the selected clean-room article. Only then enable one pinned SourceRecord real write with exact backup approval, verify D1 revision/hash/evidence, stale 409, owner access isolation, CPU/quotas and controlled deletion. Do not allow any other Source Inbox source.
Rollback: re-deploy the dark configuration to close the workers.dev route. Existing original radar.lamlab.cc and synthetic-only preview are unaffected.


## Owner-reported preflight PASS and uploaded-backup verification — 2026-10-15
- Owner replied PASS and provided radar-phase13-one-article-sanitized-backup.json via ChatGPT. Record as Owner-reported read-only preflight UAT PASS, not explicit full cloud upload consent.
- Independently inspected uploaded bytes in session: 4807 bytes; original file SHA256 54c698b9ce1a29615362ce1a5b071f688fa7fd26996934757e2b09281ca1001a. Record Version 2; pinned Source ID src_b374361cee7c6e132205267306a1e82b; 3 claims; 6 matched verbatim Evidence references; Review needs_review, Approval not_approved.
- Canonical JSON transport SHA256 bdea79cb77ae17c5467aba2f6a0517abd8368c611e76be45989f9af300ee6474, same as deployed Worker PINNED_ARTICLE_SHA256, independently rechecked against Mac fixture and configuration.
- Read-only isolated cloud D1 live check AFTER Owner PASS confirmed articles=0, revisions=0, events=0, and deployed profile retains PILOT_REAL_UPLOAD_ENABLED=false. No actual content has been uploaded.
- Still required before real-data upload: explicit statement that the Owner authorizes storing only this specified article and affirms storage rights, absence of confidential/personal-sensitive data, seven-day active retention and the potential additional seven-day Time Travel residual window. A generic PASS plus a backup does not independently establish those specific decisions.
- Do not turn on upload before the above affirmative consent. No changes to official or synthetic preview.

## 2026-10-15 Owner-approved one-off Clean-room cloud upload completed
Owner expressly wrote 同意上傳. A SINGLE pinned article was written by PRIVILEGED OWNER ADMINISTRATIVE D1 maintenance, NOT by an Access-authenticated Worker POST. Remote full Record/hash/Evidence and Owner binding parity PASS. D1 now contains 1 document, 1 revision and 1 created event, with initial review needs_review and approval not_approved. Active expiry due 2026-10-22 14:12 HKT. Owner signed-in Mac/iPhone and live scheduled purge remain pending. See docs/cloud-migration/PHASE13_ONE_ARTICLE_AUTHORIZED_CLOUD_UPLOAD_2026-10-15.md. Original production and protected synthetic QA unchanged.
