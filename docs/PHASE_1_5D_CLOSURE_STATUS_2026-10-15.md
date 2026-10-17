# AI PM Radar — Phase 1.5D Controlled Closure: Local Engineering Report
Date: 2026-10-15
Status: PARTIAL — secure UI export slice PASS; full Phase 1.5D not yet CLOSED.
Decision: HOLD production writes, deployment and broader ingestion expansion.

## Primary Outcome
Prevent stale or modified human approvals from producing Handoff / DeliveryPackage exports in the SourceHandoffWorkspace controlled UI path, while preserving the existing Content Ops v1 consumer contract and legacy readback.

## Baseline / Git safety
- Mac Online: Mings-MacBook-Air.local
- Repo: /Users/mattgor/Documents/Daily/ai-pm-radar
- Branch: main
- HEAD: 43882ad3c6aab0da5c0785677910338f8b7ddc51
- package version: 0.4.0
- Initial status: 39 tracked status rows, 79 untracked status rows.
- After verification: 38 tracked status rows, 80 untracked status rows. Note: Next.js build appears to have normalized previously modified tracked next-env.d.ts; original prebuild content was not captured. No restore or cleanup attempted. Existing changes otherwise preserved; counts are status rows, not file counts inside untracked folders.
- No stage, commit, push, deployment, cloud write, new provider, cron or dependency install.

## Completed (local engineering)
1. Phase 1.5D tests included in default npm test (the dedicated runner remains available).
2. Added lib/secure-handoff-delivery.ts using WebCrypto SHA-256 over canonical JSON bytes:
   - At explicit Handoff approval: bind reviewed Handoff including its derived analysis, evidence references, timestamps and the complete current SourceRecord (including full raw text and evidence).
   - At DeliveryPackage creation: bind the full approved Handoff seal and SourceRecord digest, and SHA-seal the complete portable package.
   - Before UI Handoff/Delivery exports and import confirmation: recompute and reject stale, altered or legacy-unsealed records.
3. Previous 16-hex fingerprint fields remain for legacy identity/consumer v1 compatibility. They are *not* claimed to be cryptographic evidence of approved bytes.
4. Editing handoff invalidates SHA seal. Old approvals and packages remain readable but not exportable through the new controlled UI path; they need new review/approval and recreated package.
5. SHA digest fields travel as optional audit metadata inside the existing Content Ops v1 intake envelope.
6. Added tests/secure-handoff-delivery.test.ts (four regression cases): positive approved source→handoff→package; source/evidence/handoff/package mutation rejection; legacy unsealed rejection; backup JSON readback and stale revision rejection.

## Verified in this session
- Baseline focused tests: 13/13 PASS.
- After code change: npm run typecheck PASS.
- npm run test:phase-1.5d: 17/17 PASS.
- npm test: 198/198 PASS.
- npm run validate:data: PASS, 2 files / 12 articles, no errors/warnings.
- npm run validate:daily: PASS, 2 files / 12 articles.
- npm run build: PASS (22 static pages).
- npm run build:mobile: PASS, same-origin /api routing built.
- git diff --check (tracked touched file scope): PASS. Relevant untracked TS tested by typecheck and both test runners.
- Controlled synthetic single-source Radar → Content Ops real receiver src/handoff.ts contract smoke: PASS; 1 item, 0 duplicate, needs_review, content_candidate; no auto-publication. No receiver workspace was mutated.

## Known limitations / remaining gates
- The underlying older synchronous API functions and checked-in v1 fixtures still use 16-hex FNV-style fingerprints. The new SHA-256 functions are applied at the controlled UI export boundary; do not treat other programmatic export paths as independently reverified unless they call assertSealedHandoff/assertSealedDeliveryPackage.
- This SHA-256 implementation detects changes to content relative to a stored seal. It is NOT reviewer authentication: a party able to rewrite both local payload and seal can rehash them. Cloud authorization/identity/revision checks remain separate and mandatory.
- A real public article has not yet gone through fresh Owner human review, Content Ops Owner UI import, idempotent reimport and evidence/readback check. This is blocked on explicit owner test and cannot be replaced by the synthetic contract smoke.
- UniversalIngestor SRT/VTT/Markdown chunk functions are not yet wired into the Intake UI, and user acceptance for the end-to-end ingestion path is unverified.
- YouTube auto subtitles, binary PDF/EPUB, freebie terms verification, collector scheduling, new adapters are NOT implemented in this slice, deliberately deferred.
- No new live Cloudflare Access/D1 production sync acceptance was run; production writes stay OFF.

## Changed files this session
- package.json (previously dirty tracked file; scripts only)
- lib/downstream-handoff.ts (previously untracked file)
- lib/delivery-package.ts (previously untracked file)
- components/SourceHandoffWorkspace.tsx (previously untracked file)
- lib/secure-handoff-delivery.ts (new untracked)
- tests/secure-handoff-delivery.test.ts (new untracked)
- docs/PHASE_1_5D_CLOSURE_STATUS_2026-10-15.md (this report; new untracked)
- Build artifacts may have changed from npm run build / build:mobile, including out/; no running mobile-production-server/cloudflared process matched read-only process inspection.

## Owner UAT gates to CLOSE
1. Choose one public or licensed article and conduct genuine review/approval in the UI. Do not auto-approve source or handoff.
2. Confirm Handoff JSON/Markdown download; tamper a local backup/evidence selection and verify old approval cannot export.
3. Create SHA-256 package and export Content Ops v1 intake file; import in an isolated Brand workspace, verify source provenance, status needs_review and idempotent duplicate handling.
4. Read back/reload/reopen; check old legacy handoffs display re-review requirement, and edited packages cannot export.
5. Record receiver confirmation separately; imported status must not be inferred from local exported state.
6. Decide whether to close security + consumer sub-slice and schedule a separate small T1 Intake UI integration.

No new Phase 1.6; retain Phase 1.5D PARTIAL until these gates are recorded.
