# AI PM Radar — Phase 1.2C-3 Actual Source Inbox Integration
Date: 2026-10-15 (Hong Kong)
Status: **Protected Preview DEPLOYED; local automated QA PASS; authenticated Owner Mac/iPhone UAT PENDING.**
Production radar.lamlab.cc unchanged, existing REAL local IndexedDB unchanged, no real data transferred.

## Primary Outcome
Serve the ACTUAL Next.js SourceInboxWorkbench React component (not a mock workbench) under the existing Cloudflare Access protected Worker hostname, with a bounded full SourceRecord v2 synthetic-only cloud bridge. Preserve independent local IndexedDB storage, human review and scope-specific approvals, backup-before-upload and expectedRevision conflict protection.

## Live link and deploy
- Test URL: https://radar-phase11-preview-locked.lamms280.workers.dev/preview-source-inbox/
- Worker: radar-phase11-preview-locked
- New Worker version: d892bbf7-1c21-40cb-91de-4da11da1abf9
- Prior Worker rollback version: 06e9a95d-2c04-428f-b767-695d0a073911
- Assets: 28 curated files / 1,136,771 bytes, ONLY Next.js compiled preview-source-inbox HTML and required _next/static assets. Full production website and source documents are not uploaded.
- New Wrangler config: experiments/cloudflare-sync-spike/wrangler-preview-next-cloud-access.jsonc, separate from original config; uses assets.binding=ASSETS with assets.run_worker_first=true, so Worker must verify Access identity before returning any static file.
- Worker routing: /preview-source-inbox/ and /_next/static/* -> env.ASSETS.fetch() only AFTER signed ctx.access.getIdentity() and pinned email digest. All requests to unrelated unknown paths remain denied/404. CSP restricts script and connect origin to self.
- Cloud API remains existing /api/cloud/* v2 schema and synthetic canonical record validator. No new D1 schema or billing plan.

## Changes
- app/preview-source-inbox/page.tsx: client-only dynamic import of existing SourceInboxWorkbench component to prevent hydration mismatch of dynamically generated draft IDs in static Next export.
- components/SourceInboxWorkbench.tsx: additive syntheticPreview prop, independent IndexedDB name "ai-pm-radar-source-inbox-synthetic-phase12c3"; existing production default DB untouched. Reuses actual WorkbenchFormState, buildRecord, Evidence rendering and original full JSON backup, but hides production advanced subscriptions/runner, blocks /fetch and /analyze functions, and hides arbitrary new input until a canonical synthetic record is loaded.
- components/SyntheticActualWorkbenchCloudPanel.tsx: authentic same-origin gateway capability handshake, fetch canonical full synthetic v2 fixture, create qa12 material card, map into actual React Workbench form, local backup+acknowledgement, per-item explicit cloud create/update with CAS expectedRevision and 409 rejection, cloud Review and independent Daily/Library approvals, cross-browser read and manual remote-to-local staging only after verified backup.
- Identity mapping uses stable material card qa12 ID for cloud D1. Existing SourceInboxWorkbench's dynamically computed internal src_... ID is unchanged; never require it to be a cloud ID.
- experiments/cloudflare-sync-spike/worker.mjs: static authenticated Next assets routing only.
- experiments/cloudflare-sync-spike/prepare-next-cloud-preview-assets.mjs: explicit allowlisted static asset packaging; never uploads entire Next out folder.
- experiments/cloudflare-sync-spike/wrangler-preview-next-cloud-access.jsonc and wrangler-preview-next-local.jsonc.
- experiments/cloudflare-sync-spike/test-next-assets-auth-local.mjs: 15 static assets deny-before-fetch, valid identity, CSP and synthetic-only checks.
- experiments/cloudflare-sync-spike/test-actual-react-source-inbox-browser.cjs and test-actual-react-source-inbox-local.mjs: reproducible isolated Wrangler/D1 and two-browser genuine React workbench integration acceptance.
- Screenshot of synthetic 390px UI: docs/cloud-migration/evidence/phase12c3-real-react-source-inbox-390-synthetic.png

## Test evidence
- Root Radar npm test 160/160 PASS; TypeScript check, validate:data and validate:daily PASS.
- Isolated npm run build:mobile PASS, both original and new Source Inbox compiled. Production out/ not replaced.
- Self-contained fresh Wrangler local D1 (not remote) + genuine React Playwright test PASS: fixture -> original SourceInbox Draft/summary/Evidence -> original full Workbench JSON backup/download/readback -> explicit D1 create v1 -> Review v2 -> Daily approve v3 -> Library approve v4 -> independent simulated phone reads v4 -> remote-to-local actual React draft -> edits original summary textarea -> mandatory new original JSON backup -> updates to v5 -> both cloud approvals reset -> stale Mac update rejected 409 -> human chooses remote-to-local after backup -> reload, responsive 390/768/1280, no JS errors, all recorded browser network same origin.
- Static assets security unit checks 15/15 PASS. No forged identity reaches env.ASSETS.fetch. Config explicitly requires run_worker_first=true; src routes reject dotfiles/traversal.
- Prior Phase1.1 and Phase1.2B contract and UI regressions passed in Phase1.2C-2; initial test also verified existing v2 API protocol.
- Final Worker dry-run: 133.55 KiB / gzip 33.20 KiB, 28 static assets in allowed list.
- Cloud D1 remote backup BEFORE deployment:
  ~/Library/Application Support/AI PM Radar/cloud-phase12-backups/phase12c3-pre-next-source-inbox-20261015.sql
  30,900 bytes, owner-only chmod 600 directory 700.
- Remote D1 counts before AND after: legacy 2; cloud source heads 4; revisions 7; approved Library snapshots 1. No real records or new remote test records created by automated tests.
- Deployed anonymous 11-route matrix PASS: /, /gateway-workbench/, /cloud-sync/, /preview-source-inbox/, /preview-source-inbox/index.html, genuine Next JavaScript and CSS chunk URLs, /api/cloud/capabilities, fixture, records, original /api/records all responded HTTP 302 to Cloudflare Access. This is NOT authenticated live Owner UAT.
- Official Mac production health: protected static origin 127.0.0.1:4320 and helper 127.0.0.1:4310 both running; production DNS/Tunnel unaffected. No Gemini requests, real data import, credentials/config modifications beyond isolated Preview, Git staging, commit or push.

## Known limits and bounded interpretation
- Actual React UI IS deployed, but the cloud bridge intentionally allows only canonical synthetic SourceRecord v2 and two fixed summary variants. The server validates exact canonical record; editing other local React fields DOES NOT cause those fields to sync. The UI explicitly discloses this. No free-form real Record edit/sync or signed source upload yet.
- Existing React Workbench uses a legacy content-derived internal record ID and globally scoped review status. This preview retains original behavior for local UI. Cloud Review/Approval is strictly per-SourceRecord, independently stored and does not trust local legacy Approval.
- Preview's synthetic IndexedDB is separate from official Radar's IndexedDB, and Browser origins are different. Production Source Library v4 and old assets were not imported to D1.
- Dynamic client-only mounting avoids hydration mismatch; no SSR HTML preview of actual form (it hydrates client-side). Test uses synthetic fixture only.
- All static assets are Worker-first authenticated; when reviewing future edits do not change run_worker_first or add unprotected CDN routes.
- No actual authenticated Owner Mac/iPhone device login or Mac-off acceptance performed by the assistant; Owner UAT PENDING.
- Real migration requires a new explicit Owner GO covering 1-article private content consent, proof of source ownership, retention/delete/backup procedure and server-side data policy. Real sources are still forbidden in the cloud synthetic API.

## Suggested Owner UAT
1. On Mac open protected actual React preview link; pass Cloudflare Access.
2. Click "1. 載入合成文章到 Source Inbox"; verify familiar real Source Inbox "核對草稿", "Evidence", article content. Wait until saved in current browser.
3. Use new cloud panel "2. 下載並儲存真正 Source Inbox JSON", verify downloaded full JSON and tick checkbox. Click "3. 逐筆明確上傳"; expect v1.
4. Cloud Review -> v2; Daily Approval -> v3 (Library false); Library Approval -> v4, check both true.
5. On iPhone open SAME link, sign in with same Access identity, select matching qa12 ID, confirm remote v4; choose "已備份：明確將遠端版本載入 React Source Inbox"; edit ORIGINAL summary textarea to alternate fixed synthetic summary; wait local save, download/confirm backup; upload -> v5 both approvals false.
6. On Mac without refreshing cloud state, edit the original summary, backup/confirm and attempt update. Must see 409 and must NOT overwrite v5. Choose manual retain or backup-before-remote recovery; verify v5 after reload.
7. Fully shut down Mac and reload same source on iPhone; check quotas. Report any errors by code, never provide Access cookies/JWT.

## Rollback
Isolated Worker rollback to 06e9a95d-2c04-428f-b767-695d0a073911 (prior Phase1.2C-2 Worker), which did not bundle Next assets. Leave Cloudflare D1 alone; do not drop tables or overwrite existing synthetic test data. The prior signed-off production URL is unchanged.


## Owner acceptance — 2026-10-15
- **OWNER UAT: PASS (owner-reported in ChatGPT).** User responded "PASS" following the protected React Source Inbox Mac/iPhone acceptance steps. This records Owner acceptance, but is not independently observed evidence for each device/test step; keep the automated local QA as separate evidence.
- **Phase 1.2C-3 disposition:** Protected Preview deployed; automated and Owner acceptance PASS. Full-field SourceRecord sync and real/private article migration remain NOT authorized and NOT implemented.
- **Next recommended scope:** Phase 1.2C-4 full-field synthetic SourceRecord v2 round-trip. Extend genuine Workbench form edits to server with strict synthetic fixture guardrails, revision/fingerprint integrity, claim/evidence provenance, CAS 409, explicit backup-before-send, manual conflict restoration and separate approval invalidation. Preserve the distinction between the legacy content-derived internal src_ ID and stable per-material Cloud ID, and reject silent data loss or review bypass. Official production remains unchanged.
- **Future explicit authorization required:** Real article opt-in only after privacy/retention/deletion policy, server validation, owner isolation, recovery proof, budget/quota check, and fresh Owner approval. Do not infer authorization from this PASS.
