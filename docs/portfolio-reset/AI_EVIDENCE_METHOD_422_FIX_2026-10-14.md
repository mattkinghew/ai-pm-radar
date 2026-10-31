# AI PM Radar — AI Evidence 422 bounded repair (2026-10-14)

## Proven issue from Owner response
Owner-observed production Source Inbox /api/analyze: HTTP 422, code=evidence_not_found, provider=gemini, stage=evidence_validation, finish_reason=STOP, candidate_count=1, text_length=5029, attempts=1, issue $.method_or_teaching_points[0], expected an exact source substring; actual not found. No real model payload, source text, credentials, or user data were copied to the repo.

Interpretation: provider returned a completed analysis, but Radar rejected the entire output because one optional method/teaching excerpt was not verbatim. The claim-evidence gate must remain hard.

## Primary Outcome
Allow an unapproved, editable AI draft when only optional method/teaching excerpt(s) do not match the source, with clear and persistent omission warning. Any invalid claim citations must still cause HTTP 422. No automatic claim verification or human approval.

## Deterministic implementation
- scripts/source-fetch-helper.mjs: preserve schema and exact-substring requirement; omit only unmatched optional method excerpts; return diagnostics stage completed_with_omissions and omitted_method_points paths, without ungrounded content. All other evidence failures remain hard 422. No added provider calls or retries.
- components/SourceInboxWorkbench.tsx: localized omission warning persisted with draft, original source snapshot protection, human review and approval unchanged.
- lib/i18n.ts: warning copy in both existing language variations.
- tests/source-fetch-helper.test.mjs: simulated provider results with valid methods, invalid optional method, mixed methods, invalid claim plus invalid method, and translated claim evidence rejection.

## Verification
- Baseline targeted test confirmed prior design rejected the unmatched optional method.
- Targeted helper tests 20/20 PASS.
- Full npm test 123/123 PASS.
- Typecheck PASS; validate:data PASS (2 files, 12 articles); validate:daily PASS.
- npm run build and npm run build:mobile PASS in isolated copy /tmp/radar-build-20261013.HV41 (production out/ not changed).
- Browser Playwright synthetic E2E, Chrome 390x844, isolated local dev port 3001: PASS. Mock /analyze with one optional omitted-method path; original source retained, draft/warning shown, no method promoted, after Save+Reload original/draft/warning preserved; no auto approval; zero page errors. Screenshot: evidence/2026-10-14-method-excerpt-omission-ui.png.

## Not verified / Owner decision
- NO deployment, commit, push, Cloudflare/Tunnel/API key/schedule changes. Production site still uses existing build/helper; local fix is not yet available there.
- NO live Gemini request. Actual production model body/candidate was unavailable, so acceptance uses synthetic reproduction of the same failing validation path.
- No external fetch nor actual downstream receiver import tested in this repair.
- For production PASS: authorize a controlled Radar-only rollout with rollback, then repeat Source Inbox checks with public-safe material; verify omission draft/warning, hard rejection for bad claim citations, reload, explicit human review; Owner browser UAT remains mandatory.
- Active worktree contains extensive pre-existing tracked/untracked changes; file paths below must not be interpreted as a complete diff against Git HEAD.

## Owner-authorized Radar-only deployment — 2026-10-14 ~01:02 HKT

Owner explicitly authorized deploying the verified 422 repair to https://radar.lamlab.cc/. No commit, push, credential changes, scheduled activation, model calls, or unrelated app changes.

- Pre-deployment backup: ~/Library/Application Support/AI PM Radar/rollbacks/evidence-422-20261014-010014/
  - out/: previous 2026-10-11 static website.
  - out-live-previous/: original production static directory moved at cutover.
  - source-fetch-helper.mjs.prior-behavior: syntax-checked reconstruction of previous optional-method hard-reject function, for rollback.
  - source-fetch-helper.mjs.current-patched: local post-fix helper snapshot.
- Build used isolated working copy /tmp/radar-build-20261013.HV41. npm test 123/123 PASS; TypeScript, both data validations and mobile build PASS.
- Staged out/ on the same filesystem, stopped only Radar launcher, swapped out/ directories, restarted a fresh detached Radar-only launcher. Existing dedicated Cloudflare Tunnel PID 96310 remained unchanged.
- Current Radar launcher PID 5270; protected static origin PID 5280 at 4320; helper PID 5281 at 4310; launched at 2026-10-14 01:01 HKT.
- Mobile health PASS. External unauthenticated Source Inbox redirects to Cloudflare Access (302); direct origin with no JWT returns 401; helper empty-body /analyze returns analysis_body_missing (no paid model call). Deployed JS includes method omission warning.
- Authenticated Owner Browser UAT: PENDING. Do not claim the entire production workflow PASS until valid source, new AI analysis, evidence Review, human Approval, Export and Reload are checked.
- Browser-local prior failed analysis state persists until user starts a fresh analysis. Hard refresh updates website code, but does not automatically retry an API call.
- Detached server is not configured to auto-start after reboot; schedules unchanged. Service log: ~/Library/Logs/AI PM Radar/production-422-20261014.log.
