# AI PM Radar — Phase 1.4B Controlled Single-article Update Preflight
Date: 2026-10-15 HKT.
STATUS: PROTECTED CLOUDFLARE PREVIEW DEPLOYED; AUTOMATED QA PASS; SIGNED-IN OWNER MAC/IPHONE UAT PENDING.
GENERAL SOURCE RECORD UPLOAD/UPDATE OFF. This update added a strict PREVIEW/VALIDATION workflow only, not new cloud revisions or a live cloud write.

## Owner consent and scope
Owner replied PASS to Phase 1.4A signed-in Mac/iPhone UAT instructions. Record as Owner-reported acceptance (no independent device-level trace from this reply). This authorizes pursuing incremental design/QA but NOT storing an edited article or lifting the existing one-week retention policy. The exact approved existing Clean-room SourceRecord is the only candidate.

## Live protected Preview
https://radar-phase13-one-article-dark.lamms280.workers.dev/pilot-source-inbox/
Worker radar-phase13-one-article-dark, version 9d996e9f-6943-4f2a-8ca5-925a2e70297c.
Previous safe rollback version: f0ce0255-9eb5-4b01-a56c-08a17e88f13a.
Cloudflare Access required, verified Owner identity required by Worker before serving HTML, JS, CSS or API. Worker-first ASSETS still enabled.
PILOT_REAL_UPLOAD_ENABLED=false. PILOT_WRITE_PREFLIGHT_ENABLED=true.

## Specific restricted proposal
Only pinned source ID src_b374361cee7c6e132205267306a1e82b.
Base D1 SourceRecord Revision 1 SHA256:
bdea79cb77ae17c5467aba2f6a0517abd8368c611e76be45989f9af300ee6474
Only permitted field difference: summary.
Pre-approved clean-room summary alternative: 修訂版：為跨裝置協作增加明確備份與人工衝突處理。
New full candidate is constructed from the verified D1 canonical SourceRecord and never from a lossy React field projection. All original raw text, Evidence, provenance, analysis and metadata preserved. Review needs_review and Approval not_approved. No publishing, extra article or human approval inherited.

## New implementation
- lib/pilot-controlled-update.ts: pure pinned source / one-field proposal contract. Never returns cloud-write authorization. Rejects arbitrary summaries, unknown source, stale approvals and unchanged candidate.
- tests/pilot-controlled-update.test.ts: 6/6 PASS, integrated into root npm test.
- experiments/phase13-one-article/worker.mjs: new Owner-authenticated same-origin POST /api/pilot/update-preflight. Requires precisely expectedRevision, expectedSha256, and fixed allowlisted summary, rejecting extra keys and unsupported text. Checks revision 1, canonical baseline hash, expiration, source Evidence, strict schema and pinned future SHA. Response returns future hash and changed-field metadata, persisted=false, current revision=1, unchanged retention expiry. It performs no SQL INSERT/UPDATE/DELETE.
- components/SourceInboxWorkbench.tsx and OneArticleCloudWorkspacePanel.tsx: fixed summary applied to actual React form, complete cloud JSON backup verified by download/reimport, current full local Workbench JSON backup verified by download/reimport, then explicit server-side preflight. No cloud write request made.
- experiments/phase13-one-article/test-worker-local.mjs: 8/8 PASS (three new scenarios for allowed update, wrong Owner/CSRF/unknown fields/conflicts, stale TTL and feature disabled).
- experiments/phase13-one-article/test-pilot-react-workbench-local.mjs: actual Next/React Mac/phone two-browser E2E with local D1. Simulated Owner can produce a bounded preflight POST but cannot create new revision. Browser network has no writes beyond the specific preflight POST; other requests GET only. Mobile widths 390/768/1280 PASS.
- experiments/phase13-one-article/verify-one-time-live-migration.mjs: corrected old validator's false-positive requirement that D1 article must be less than one hour old. Now checks original seven-day retention window correctly while verifying SHA and expiration; no D1 mutation.

## Evidence
- Full Radar npm test 187/187 PASS; typecheck, validate:data, validate:daily PASS.
- Isolated Next static build PASS, 29 assets ~1,160,742 bytes. Worker dry-run 55.96 KiB / gzip 15.33 KiB.
- Worker API local 8/8 PASS; existing protected preview browser 2/2 PASS; complete true React cross-context E2E PASS, including actual form backup, fixed proposal, server response SHA match, revision unchanged and no runtime errors.
- Live post-deploy Cloudflare Access anonymity matrix 12/12 PASS: public HTML, original preview, true React page, JS/CSS, capabilities, current D1 record/history and GET/POST of the new preflight endpoint return 302 to Access. No anonymous content or source passed through.
- Remote D1 read-only verification after deployment: 1 document, 1 revision, 1 event; full article canonical SHA/Evidence unchanged; current D1 still Revision 1. Active retention expires 2026-10-22T06:12:29.952Z = 2026-10-22 14:12:29 HKT, unchanged.
- Official radar.lamlab.cc Mac origin localhost 4320 and helper 4310 health PASS; official production build timestamp remains 2026-10-14 17:53:25. No new paid resources, Cloudflare Access policy change, Gemini request, Git stage/commit/push or broad real source migration.

## Owner Mac and iPhone acceptance
1. Mac: open protected Preview and log in. Confirm cloud Revision 1, SHA256, expiry and upload OFF.
2. Download full cloud original JSON; reselect it to prove backup SHA matches. Load cloud article into real React Source Inbox.
3. Click the fixed summary proposal button and confirm the existing React summary field changed locally.
4. Wait until browser draft saved, click the full local Workbench JSON backup; reselect this new local backup to confirm PASS.
5. Click server update preflight button. Expect proposed Revision 2 SHA and persisted=false; cloud Revision must remain 1 and expiry unchanged. This does not authorize future actual write.
6. On iPhone, same Access login and protected URL; local draft is independent of Mac. Cloud remains v1; mobile edits stay local.

## Remaining acceptance gates
- Owner signed-in real-device UAT for this new preflight is pending. Automated browser identity was simulated; live Cloudflare Access was validated only for unauthenticated denial.
- Committing an actual cloud summary edit requires a distinct Owner GO for precisely this proposed text, final backup and owner-authenticated CAS+readback testing. No broad source upload authorization inferred.
- Phase 1.3 real D1 expiry deletion still pending at or after 2026-10-22 14:12 HKT. Do not extend original TTL. Cloudflare D1 Time Travel backup copies may remain until native retention ends.
- Rollback the Worker to f0ce0255-9eb5-4b01-a56c-08a17e88f13a if needed, or emergency deploy wrangler-dark.jsonc to remove public ingress. Keep D1 contents and official Radar unchanged.


## Owner acceptance — 2026-10-15
- **Owner-reported UAT PASS:** after the Phase 1.4B Mac/iPhone preflight instructions, Owner replied "pass". This acknowledges the bounded, no-write update preflight, not an actual cloud update. Independent signed-in device traces were not captured in this turn.
- Accepted scope: exact single clean-room candidate summary, full backup, cloud SHA/revision verification and persisted=false.
- No grant of permission for D1 revision 2, general SourceRecord upload, new Cloudflare Access policy, extension of original TTL or altering production.
- Phase 1.4C may be implemented and locally QA-tested with the actual controlled-commit flag **OFF**, awaiting a separate explicit Owner instruction before any real cloud write.
