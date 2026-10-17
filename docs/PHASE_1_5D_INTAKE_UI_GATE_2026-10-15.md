# Radar Phase 1.5D — Intake UI evidence wiring, local acceptance

Date: 2026-10-15
Status: COMPLETE (automated local engineering candidate); OWNER BROWSER QA PENDING.
Milestone closure: PARTIAL. No release, push, deploy, cloud sync, scheduling or new dependency.

## Primary outcome
Connect the already-supported Markdown, SRT, VTT and TXT manual file import in Source Inbox to the existing UniversalIngestor evidence chunkers, with review-safe defaults and explicit source locator selection. Preserve existing SourceRecord shape, provenance and human approval gates.

## Implementation
- `lib/intake-evidence-preview.ts` (new): validate file extension, UTF-8 text controls, byte length <= 1 MiB, empty files and subtitle time ranges. Build bounded evidence navigation candidates from existing chunkTranscript / chunkBookChapter. For subtitle candidates use neutral `Subtitle HH:MM-HH:MM` rather than assuming YouTube.
- `lib/universal-ingestor.ts`: optional transcript locator prefix, retaining backward-compatible default `YouTube`.
- `components/SourceInboxWorkbench.tsx`: upload enters needs_review draft with no selected quote and no approval; show candidate quotes with chapter/page/time locators, explicit click fills quote and source/locator; manually pasted Markdown/SRT/VTT retains its detected kind; errors offer paste fallback. Changing source/form invalidates prior review/approval as before.
- `tests/intake-evidence-preview.test.ts` (new): four focused tests covering VTT, SRT, Markdown, TXT fallback, provenance, subtitle verbatim matching, invalid/binary/over-size rejected.
- `package.json`: included tests in both ordinary and focused phase 1.5D runners.
- Synthetic Owner fixtures: `fixtures/intake-phase15d-demo.md`, `fixtures/intake-phase15d-demo.vtt`.

## Actual checks (this session)
- npm run typecheck: PASS.
- Focused intake suite: 4/4 PASS.
- npm run test:phase-1.5d: 21/21 PASS.
- npm test: 202/202 PASS.
- npm run validate:data: PASS (2 daily data files, 12 articles, 0 warnings).
- npm run validate:daily: PASS (2 files, 12 articles).
- npm run build: PASS, 22 generated static pages.
- npm run build:mobile: PASS, same-origin API routing.
- Scoped tracked git diff --check on package.json: PASS. New untracked TS compiled/tests passed.
- No browser or mobile viewport/Console inspection performed. No owner approval inferred.

## Owner manual UAT (one bounded local session)
1. Run `npm run dev:local` if not already running; visit `http://127.0.0.1:3000/source-inbox/`.
2. Save/download existing IndexedDB draft backup before testing; use synthetic materials only.
3. Upload `fixtures/intake-phase15d-demo.vtt`; expect a captured draft with suggested time locator `Subtitle 00:00-00:15`, but no automatic approval.
4. Expand evidence source details; select a locator; expect exact quote, filename provenance and time locator; review status should remain pending until explicitly reviewed.
5. Upload `fixtures/intake-phase15d-demo.md`; expect source title `Evidence-led AI project delivery`, chapter/page locators in evidence picker, and manual selection required.
6. Save draft, reload, confirm selected quote and SourceRecord body persist; editing source text must invalidate prior review/approval.
7. Attempt invalid/empty subtitle/oversize file: should display an actionable error and retain existing draft; manual paste remains available.
8. Once manually reviewed/approved, use the prior secure Handoff/DeliveryPackage gates. Receiver import is a SEPARATE acceptance event; don't mark `import_confirmed` without Content Ops evidence.

## Explicitly outside scope
No PDF/EPUB, auto YouTube subtitle fetch, new crawler, cron, new cloud write, model call, AI-generated approval, multi-repo refactor or production release.

## Risks
- Only first 80 evidence candidates are displayed; longer sources remain manually editable, not truncated from captured SourceRecord.
- Subtitle exact quotes are matched against the normalized transcript retained by SourceRecord, not against raw subtitle markup byte offsets. Locator values are time ranges, not cryptographic byte spans.
- SHA-256 is an integrity check and does not authenticate the approving user by itself; retain independent authorization and D1 gate.
- Production `https://radar.lamlab.cc` may still serve the older build. Local UAT must use the local URL.

## Next decision
If Owner confirms manual upload / locator selection / draft reload / unchanged approval gates, mark the local Phase 1.5D evidence-import slice OWNER PASS and close 1.5D local scope. Then require separate authorization before any production deploy or Phase 1.6.

## Owner acceptance addendum — 2026-10-15
- Owner reported **PASS** in the project conversation after being asked to test the two synthetic Markdown/VTT fixtures, locator selection, draft persistence and continued manual approval gates.
- Scope of evidence: **Owner-reported UI acceptance** for this intake slice; no independent replay/Console/browser video was retained by the assistant.
- Disposition: `Intake UI evidence-import sub-slice = OWNER PASS`. The broader Phase 1.5D SourceRecord → Handoff → real Content Ops receiver verification remains a distinct, unresolved closure gate.
- Do not infer Cloudflare deployment, new release, Git commit, or cross-device verification from this PASS.
