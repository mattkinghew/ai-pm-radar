# AI PM Radar — Phase 1.5D Per-source Approval & Controlled Onboarding (Shadow)
Date: 2026-10-15 HKT.

STATUS: ACCESS-PROTECTED SHADOW REVIEW DEPLOYED / LOCAL AUTOMATED QA PASS / OWNER SIGNED-IN UAT PENDING / REAL CLOUD UPLOAD NOT AUTHORIZED.

## Authorization and scope
Owner replied "pass, 下一個階段" after Phase1.5C. Record this as OWNER-REPORTED Phase1.5C UAT PASS, not independently captured signed-in network traces. Advancing to Phase1.5D does NOT authorize non-synthetic article uploads, real D1 alterations, Access changes, retention extensions, or production migration.

Live URL: https://radar-phase13-one-article-dark.lamms280.workers.dev/real-source-approval/
Worker: radar-phase13-one-article-dark
New Worker version: 0c55a650-f9b8-4129-a4ac-190a5fa51a08
Prior rollback version: e1484f3f-3f00-4691-a48f-01db310691fe

## Outcome and exact limitations
Phase1.5D creates an OFFLINE SHADOW APPROVAL CANDIDATE tied to exactly one file SHA256 and a Phase1.5C governance report. It contains SourceRecord ID, exact original file fingerprint, byte-level original backup SHA, governance report SHA, reviewer codes/reference IDs, owner acknowledgement, requested future seven-day retention, and a 24-hour owner-device review timebox.

This candidate is NOT a legally effective license, electronic signature, authenticated reviewer identity, immutable cloud consent ledger or CLOUD WRITE PERMIT. Even if every local review stage passes, cloud_write_authorized=false, real_upload_enabled=false, server_approval_recorded=false, identities_verified=false, signature_verified=false and signed_at=null. Arbitrary reviewed or previously approved local SourceRecords do not become cloud-approved.

## Workflow and controls
1. Choose exactly three local files: full SourceRecord v2 ORIGINAL JSON, its byte-identical backup and the previous Phase1.5C governance JSON. All file operations are browser-local and no source bytes are uploaded.
2. Compute actual SHA256 of EACH file's complete bytes. Reject missing/malformed data and any original vs backup mismatch. Recheck report source ID and source SHA against ACTUAL original file bytes; rerun Phase1.5C governance checks for v2, Evidence, provenance and all nine attestations. A changed file with an old report HOLDs. Governance reports are NOT signed and user-claimed attestations are unverified.
3. Rights review requires specific basis and an evidence reference with reviewer code. Privacy requires public_non_sensitive classification and its OWN evidence reference and distinct reviewer code. Distinct strings are not identity proof.
4. Owner explicitly accepts one-source one-byte-hash scope, potential future seven-day retention (updates not extending it), D1 Time Travel residual and the fact no cloud permit exists.
5. Local result is HOLD with blockers/unknown/pending or SHADOW_APPROVAL_CANDIDATE with a 24-hour review expiry according to device clock. Device clock and report are NOT trusted server-signed evidence.
6. Export metadata-only JSON without raw article body, complete source URLs, quotation text or original governance report. Reviewer codes/Source ID/sha are still private metadata. Reload clears inputs and checkboxes; no IndexedDB/localStorage or remote data persistence.

## Evidence / Assumption / Unknown
- EVIDENCE: byte SHA256 for source/backup/governance report; original source and report revalidated, nine attestations required; browser and safety flags inspected; original real D1 remains unchanged.
- ASSUMPTION: rights/privacy evidence reference is meaningful and actual reviewers are independent, licensed, competent and honest; the device clock is accurate.
- UNKNOWN: external license validity, whether contents contain unrecognized confidential or personal material, authenticated reviewer identity, any real server-side signature/revocation, signed-in LIVE owner UAT and next-step legal/processor review.
- BOUNDARY: there is NO real-source write endpoint added in this phase. A new, explicit per-file Owner GO is mandatory before any future non-synthetic cloud storage.

## Files changed
- experiments/phase15d-source-approval/engine.mjs and test-engine.mjs: byte-bound review, fail-closed shadow policy, 24-hour local validity, 8 core tests.
- experiments/phase15d-source-approval/pilot-ui/index.html, app.js, embedded.mjs, build-ui.mjs: offline reviewer/source/owner input UI and metadata-only shadow packet download.
- experiments/phase15d-source-approval/test-browser-local.mjs: real Chromium Mac/iPhone independent contexts, mocked Access/no D1 storage, tamper and 409-independent role checks.
- experiments/phase13-one-article/worker.mjs: protected GET-only static pages under /real-source-approval/ with CSP connect-src none and preverified Owner Access. NO cloud POST/PUT.
- experiments/phase13-one-article/wrangler-phase15b-synthetic-protected.jsonc: SHADOW_APPROVAL_ENABLED=true, while REAL_SOURCE_SYNC_ENABLED=false, PILOT_REAL_UPLOAD_ENABLED=false, PILOT_CONTROLLED_COMMIT_ENABLED=false.
- experiments/phase15c-real-governance/pilot-ui/index.html and components/OneArticleCloudWorkspacePanel.tsx: links to shadow review.

## Validation
- Full Radar root npm test 187/187 PASS, TypeScript and validate:data/validate:daily PASS.
- Existing real-article Worker local API 13/13 PASS and legacy Chrome readonly UI 2/2 PASS.
- Synthetic multi-source service 12/12 PASS, Mac/iPhone synthetic cross-device Chromium E2E PASS.
- Phase1.5C governance 10/10 PASS, separate Mac/iPhone governance Chromium E2E PASS.
- Phase1.5D shadow approval 8/8 PASS. Actual two-context Chromium E2E PASS: original byte hash, downloaded packet, separate reviewers, old/tampered governance report blocked, role identity conflict HOLD, 24-hour candidate, reload clears data and no JS errors. No horizontal overflow 390/768/1280. ALL browser requests are static same-origin GET; NO article POST/PUT.
- Isolated Next.js mobile build and prior original React workbench browser regression PASS. Official production out untouched.
- Cloudflare Access-protected Worker version 0c55a650-f9b8-4129-a4ac-190a5fa51a08. Postdeploy anonymous Access audit: 29/29 static, API and attempted POST paths redirected HTTP302, NO anonymous 200.
- Actual read-only D1 verification after deployment: original real D1 1 article, 2 immutable revisions, 2 audit events, Revision2 SHA 9249bd0181fd7197d93ad6f64f5f689cb4bca3eb1c3faf171adab116c0f7ed13, original expiration 2026-10-22T06:12:29.952Z (14:12:29 HKT) unchanged. Phase15B synthetic D1 0 articles / 0 revisions / 0 events.
- Official radar.lamlab.cc protected Mac 4320 origin/4310 helper healthy; original source-inbox build timestamp 2026-10-14 17:53:25. No new D1, subscription, Access policy change, real content upload, Git reset/commit/push.

## Owner UAT
1. Sign into https://radar-phase13-one-article-dark.lamms280.workers.dev/real-source-approval/ on Mac and iPhone.
2. Prepare three test files via Phase1.5C: Owner-authored public-safe SourceRecord original JSON, its exact SHA-matching backup, and complete metadata-only Phase1.5C governance report with nine human attestations. No confidential or customer content.
3. Select all three. Complete Rights basis/evidence reference/reviewer code, Privacy classification/evidence reference/DISTINCT reviewer code, and Owner exact-source 7-day/privacy/deletion acknowledgement. Check HOLD by leaving a reviewer blank.
4. For a valid clean-room demo, a SHADOW_APPROVAL_CANDIDATE may appear. Verify that cloud_write_authorized=false and signature_verified=false. Download metadata-only packet and confirm no article body.
5. Change privacy reviewer code to equal rights reviewer, or select a modified report, to confirm HOLD. Reload and confirm all files/controls are cleared. Verify 390px mobile no overflow.
6. Return PASS/PARTIAL/BLOCKED with per-device observed issues. This UAT does not authorize a real upload.

## Next recommended gate — Phase1.5E, NOT authorized yet
Server-side authenticated immutable METADATA-ONLY consent ledger in an independent synthetic D1 with verified Access principal and per-file/source hash, actual independent reviewer identification, proof of backup/revocation, one-use expiry and server-side 409. Still keep all real data cloud write OFF until separate Owner explicit authorization. Cloudflare Time Travel deletion residual and account-specific retention rules need verification. Original real article live cascade purge should be checked at/after 2026-10-22 14:12 HKT.

## Emergency rollback
Use experiments/phase13-one-article/wrangler-dark.jsonc to disable all public Workers.dev ingress without modifying either D1. Earlier protected Worker version e1484f3f-3f00-4691-a48f-01db310691fe can be used for scoped rollback. Do not reset/stash/clean the dirty repository.
