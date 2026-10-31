# AI PM Radar — Phase 1.2C-4 Full-field Synthetic SourceRecord Sync
Date: 2026-10-15 HKT.
Status: DEPLOYED to Access-protected Cloudflare Preview; automated QA PASS; authenticated Owner Mac/iPhone UAT PENDING. Production radar.lamlab.cc unchanged. No real records uploaded.

## Outcome
The ACTUAL Next.js React Source Inbox now sends the complete SourceRecord v2 JSON rather than a hidden summary-only replacement. Sixteen source enrichment fields and three Analysis fields are read from the actual edited React form and returned from D1, with revisions and strict human Review/Approval boundaries.

This is a FINITE SYNTHETIC ALLOWLIST, NOT unrestricted real-data full-field sync. Permitted fields: summary, key_points, key_claims, evidence, why_it_matters, business_implication, ai_pm_implication, video_implication, content_ideas, uncertainties, trend_tags, topic_tags, confidence, evidence_grade, case_candidate, library_targets; analysis.source_facts, analysis.inferences, analysis.method_or_teaching_points. Each accepts only baseline fictional value or a pre-approved alternative. The original raw_text, source URL, creator, title, dates, provider metadata, rights, and all other provenance remain immutable, with unsupported local edits BLOCKED rather than silently discarded. Every permitted Evidence excerpt is located verbatim in the original synthetic text.

## Live Preview
Protected URL: https://radar-phase11-preview-locked.lamms280.workers.dev/preview-source-inbox/
Worker: radar-phase11-preview-locked.
Deployed version: 40db1abe-af8e-4dd9-97b1-27f780a82114.
Safe rollback version: d892bbf7-1c21-40cb-91de-4da11da1abf9.
Existing D1: radar-phase11-synthetic-20261014. No schema changes, real import, production DNS/Tunnel changes or new billing plan.

## Code delivered
- lib/synthetic-full-field.ts — strict typed finite synthetic options, verbatim Evidence, unknown-key and provenance protection, real React field mapping and no silent field discard.
- experiments/cloudflare-sync-spike/cloud-api.mjs — imports the same full v2 synthetic validator for Worker POST/PUT and advertises full_field_synthetic_version=1 while preserving synthetic_only=true and real_sources_opt_in=false.
- components/SyntheticActualWorkbenchCloudPanel.tsx — sends all permitted fields from live Source Inbox record; offers a full-field synthetic alternate preset, requires fresh actual Workbench JSON backup and explicit human consent per upload, and retains D1 expectedRevision CAS and 409 conflict handling.
- components/SourceInboxWorkbench.tsx — restores additional Business/AI PM/Video, tags, case, grade, confidence and Analysis fields from D1 into original React form.
- tests/synthetic-full-field.test.ts — 7 field integrity and negative safety tests.
- experiments/cloudflare-sync-spike/test-cloud-api-local.mjs — extended full v2 D1 round trip and approval invalidation tests.
- experiments/cloudflare-sync-spike/test-full-field-react-browser.cjs and test-full-field-react-local.mjs — isolated Worker+D1, actual Next React form, two independent browser contexts.

## Test evidence
- npm test 167/167 PASS; npm run typecheck, validate:data, validate:daily PASS.
- Strict full-field unit tests 7/7 PASS; every editable field affects fingerprint, forbidden real text or altered provenance rejected, invalid Evidence rejected, review/approval flags never inherited.
- Local Worker/D1 full-field API: all 19 synthetic enrichment/analysis values round-trip exactly, human Review, reusable Source Library v4 approval, edit invalidation, prior Library 409 stale, simultaneous CAS conflict and forbidden private fields all PASS.
- Actual React SourceInboxWorkbench isolated Playwright PASS: original JSON backup/readback, cloud create v1, Review v2, Daily v3, Library v4; independent iPhone loads source and changes 16+3 fields in original form, backs up, updates v5; D1 response retains Key Points, Claims, verbatim Evidence, Analysis fields, Grade C, CaseCandidate and implications; both approvals invalidated; stale Mac update rejected 409; manual remote restoration preserves rich fields; reload and 390/768/1280 responsive PASS, no JS errors, all browser network requests same origin.
- Existing Phase 1.2B Cloud UI, Phase 1.2C-2 Gateway and Access/asset authorization tests PASS.
- Cloudflare Worker bundle dry-run: 138.52 KiB / gzip 34.42 KiB; new static assets only 3 uploaded (25 unchanged), original static asset run_worker_first=true retained.
- Protected remote D1 backup captured BEFORE deployment: ~/Library/Application Support/AI PM Radar/cloud-phase12-backups/phase12c4-pre-fullfield-source-sync-20261015.sql; 30,900 bytes, file chmod 600, parent folder chmod 700.
- Remote D1 before/after counts UNCHANGED: legacy records 2, cloud sources 4, immutable revisions 7, Library snapshots 1. Local QA did not write cloud user data.
- Postdeploy anonymous GET checks across 11 page/script/stylesheet/API routes ALL returned 302 to Cloudflare Access login; no anonymous content publicly exposed.
- Mac official production health PASS, ports 127.0.0.1:4320 and 127.0.0.1:4310 still listening. Original production build unchanged (2026-10-14 17:53:25 HKT). No Git commit or push; no Gemini request.
- Local synthetic screenshot: docs/cloud-migration/evidence/phase12c4-full-field-source-inbox-390-synthetic.png.

## Owner Mac / iPhone UAT still pending
1. Mac: open protected Preview; click Load Synthetic Article. Review original React Source Inbox Evidence, download JSON, confirm and upload v1, human Review v2, Daily v3, Library v4.
2. iPhone: same Access account, select same qa12 source; manually stage remote v4, then click Full-field Synthetic Alternate. Inspect the actual form fields and the alternative verbatim Evidence. Backup/confirm and upload v5.
3. Confirm new Key Claims/Evidence/Implications/Tags/Grade/Analysis round-trip on both devices and that current approvals reset.
4. Mac stale v4 attempt must fail with HTTP 409 and no overwrite. Manual remote restore must retain all rich fields.
5. Unsupported real text or source metadata edits must block upload. With Mac powered off, iPhone must still access D1; observe real Worker/D1 CPU/free-tier usage.
6. Do not send credentials, Access cookies, JWTs or private content.

## Next security gate
Real source uploads remain BLOCKED. Phase 1.3 may only be started after distinct Owner GO for one real article, with retention/deletion, private backup/export, full server-side validation, verified Access/owner isolation, direct recovery evidence and usage/budget limits. A PASS on this synthetic Preview is not consent for private data migration. Roll back isolated Worker to d892bbf7-1c21-40cb-91de-4da11da1abf9 if needed; retain existing D1 history.


## Owner UAT disposition — 2026-10-15
- **Owner acceptance: PASS (owner-reported in ChatGPT).** The Owner replied "pass" after receiving the Phase 1.2C-4 actual Mac/iPhone UAT instructions. This records Owner acceptance, not independently observed step-by-step device telemetry.
- **Final Phase 1.2C-4 disposition: ACCEPTED for synthetic-only full-field SourceRecord v2 sync.** Distinguish deployed and automated tests PASS from Owner-reported UAT PASS.
- **Production scope:** Official radar.lamlab.cc and its local IndexedDB remain unchanged. The protected Cloudflare Preview still enforces SYNTHETIC_ONLY; approved schema/field constraints and the original recovery plan remain in force.
- **Not authorized by this PASS:** Any genuine, private or employer/customer SourceRecord transfer, relaxing Cloudflare Access, migration of the entire Source Library, deployment to production, Gemini use, added paid services, or moving to Phase 1.3 automatically.
- **Next suggested decision gate:** Phase 1.3 — One-article Real Data Migration Pilot. First design retention/deletion and recovery policy, direct backup restore proof, strict owner identity isolation, one-source explicit opt-in, provenance/evidence integrity and D1 cost/CPU limits. Require an independent Owner GO naming a permitted article before upload.
