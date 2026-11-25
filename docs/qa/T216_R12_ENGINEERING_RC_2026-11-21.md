# T216 R12 — Engineering RC Handoff

Checked: 2026-11-21 (HKT)

## Release summary

- **Version:** `0.4.1-rc.0`
- **Branch:** `feat/cloudflare-cloud`
- **HEAD:** `1725db5b1727ee2c777295284ac9f0b8efad2efd`
- **Local cached upstream ref:** `origin/feat/cloudflare-cloud` at `11e3be4`; branch reports 13 commits ahead. No fetch was performed, so this is not a claim about the current GitHub remote.
- **Worktree:** contains the scoped local test/documentation changes recorded in this handoff plus pre-existing user changes. Nothing was staged, committed, pushed, merged, or deployed.
- **Completed locally:** R0 baseline; G02 ingestion contract audit; R1 approval/evidence regression; R2 collector resilience fixture; R3 ingestion/evidence audit; R4 deterministic research failure recovery; R5 local Access/D1 contracts and all 18 Wrangler migrations in isolated local D1; R6 static mobile workflow and viewport measurements; R7 synthetic downstream delivery contract; R10 automated local tests, validators and mobile export.
- **Partial:** G04 invalid-row retry; G08 collector/source-preview redirect destination validation and arbitrary-host DNS pinning; R8 complete keyboard/empty/error/backup-restore verification; R9 production/authenticated operational and performance metrics (local fail-closed/helper timings are now recorded). R11 independent reviewer returned **REJECT** for marking R0–R10 acceptance complete; no specific code defect was identified, but acceptance gaps remain. Overall RC remains **HOLD**.

## Architecture boundary

Source input and feed collection normalize to versioned SourceRecord data; AI and research remain draft-producing steps. Exact evidence and snapshot fingerprints bind review and approval. Cloud sync is disabled unless its protected binding and Access identity contract are active; D1 contract tests use isolated fixtures and all current migrations were applied to a separate temporary local D1. Approved handoffs become versioned delivery packages with consumer contracts and explicit receiver readback. Mobile static output keeps browser-local IndexedDB drafts; the protected companion Origin and Research runtime were stopped at the end of this check.

## Verification

| Check | Result |
|---|---|
| `npm test` | exit 0, 373/373; raw log `docs/qa/artifacts/T216-npm-test-post-g09-2026-11-21.txt` |
| `npm run test:phase-1.5d` | exit 0, 29/29; raw log `docs/qa/artifacts/T216-test-phase-1.5d-post-local-d1-2026-11-21.txt` |
| Downstream delivery suites | exit 0, 47/47 |
| `npm run typecheck -- --incremental false` | exit 0; raw log `docs/qa/artifacts/T216-typecheck-post-local-d1-2026-11-21.txt` |
| `npm run validate:data` | exit 0, 9 files / 73 articles, no warnings/errors; raw log `docs/qa/artifacts/T216-validate-data-post-local-d1-2026-11-21.txt` |
| `npm run validate:daily` | exit 0, 9 files / 73 articles; raw log `docs/qa/artifacts/T216-validate-daily-post-local-d1-2026-11-21.txt` |
| Wrangler D1 migrations | exit 0, 18/18 applied to fresh `/private/tmp` local persistence; read-only count confirmed 18 |
| `npm run build` / `npm run build:mobile` | exit 0 in isolated temp copies; Next export generated 83 pages; checkout `out/` and `.next/` preserved |
| `git diff --check` | exit 0 |
| Browser smoke | synthetic local Source Inbox capture/reload; CSS viewport measurements at 360/390/768/1280; limited keyboard and console checks; backup file not confirmed |
| `npm run health:mobile` | exit 0 on loopback ports 54320/54310; 10-sample unauthenticated Origin and helper status timings captured; both services stopped and original `out/` restored |

Evidence reports: `T216_R0_BASELINE_2026-11-21.md` through `T216_R7-R10_LOCAL_RC_2026-11-21.md`. No screenshot artifact was saved by the available browser-control surface.

## Readiness distinctions

- **Local Engineering:** PARTIAL; listed automated checks and isolated D1 migrations pass, while G04/G08 criteria remain unmet.
- **Synthetic E2E:** PARTIAL; collection/reload, viewport measurements, review gate and mock delivery contracts have evidence, but UI backup export/import is not confirmed and all nine flows are not browser end-to-end.
- **Authenticated Cloud E2E:** UNKNOWN; no current production credential/route validation was performed.
- **Production deployment / real data migration:** NOT RUN by authorization boundary; no production operation occurred.
- **Physical device / mobile network UAT:** NOT RUN.
- **Independent review:** REJECT for completed gate. Remaining gaps include backup restore, complete keyboard and UI-state coverage, operational metrics, and G04/G08 closure. A later narrow G09 redirect patch review was ACCEPT; this does not change the overall verdict. Review evidence: `T216_R11_INDEPENDENT_REVIEW_2026-11-21.md` and G09 follow-up below.

## Rollback and data protection

No deployment or production migration exists to roll back. The isolated temporary local D1 is retained at `/private/tmp/t216-phase5-local-d1-20261121`; it contains only the schema created by these migrations. The current changes are uncommitted and coexist with pre-existing worktree changes. Do not use `git reset`, `git clean`, or restore the whole worktree. If this candidate is later rejected, inspect each scoped diff and remove only its owned hunks/files after verifying no later work depends on them. The pre-existing `out/` was restored, and the new build artifact remains isolated at `/private/tmp/radar-rc-r6.0itcGB/build-mobile-out`.

## Owner handoff

**Recommendation: HOLD.** Do not call this a Production Release. Before any later promotion, obtain independent review, run the exact mobile viewport plus backup export/import test, confirm the authorized Origin/Access health and migration state, and obtain separate authorization for any production action. Receiver import confirmation requires a receiver-side receipt; none is claimed here.

## Follow-up — X original-text preservation and current UI verification (2026-11-21 HKT)

- Added local migration `0018_x_original_text.sql` and owner-protected detail readback so X posts accepted up to the configured input bound are retained verbatim, while list payloads continue to expose only the bounded excerpt. The UI lazy-loads and displays the original text as text content. Inputs beyond the bound are rejected, not silently truncated. Focused evidence: `T216_PHASE1_X_ORIGINAL_TEXT_2026-11-21.md`.
- Verification after this increment: focused Cloud suite **54/54**; broad package tests excluding `tests/mobile-production-server.test.mjs` **362/362**; `npm run typecheck -- --incremental false`, changed-JS syntax and scoped `git diff --check` passed. The excluded server test cannot bind loopback in this sandbox (`listen EPERM`); no passing result is claimed for it.
- UI acceptance was rechecked for available tooling: no Playwright/Puppeteer package is installed and CUA exposed no browser tab; opening the native Chrome window timed out. Therefore 360/390/768/1280, keyboard-only, console, and backup export/import remain **Unknown**. This does not replace the prior R11 verdict.
- No production migration, deployment, Cloudflare/D1 operation, model call, Receiver dispatch, or formal daily-data modification occurred. Overall Engineering RC remains **HOLD**; G08 remains **Partial** due to collector/source-preview redirect destinations not being revalidated, and G09 stays held.

## Follow-up — G09 mock-only adapter and release checks (2026-11-21 HKT)

- Added isolated default-off official Gemini HTTP adapter tests; it has no route/UI caller and cannot fall back. Focused adapter tests **4/4**; package suite excluding only `tests/mobile-production-server.test.mjs` **366/366**; `npm run test:phase-1.5d` **29/29**; typecheck and both daily validators passed.
- `npm run build` and `npm run build:mobile` passed in `/private/tmp/radar-g09-build.0JhEYm`, an isolated copy; static generation completed **83/83** routes. Existing checkout `.next/` and `out/` were left untouched.
- `npm test` remains **Unknown** as a complete command because the loopback production-server test is excluded after its sandbox `listen EPERM` blocker; no second attempt was made. Browser/keyboard/viewport/backup-restore acceptance remains **Unknown** (no browser automation package/tab available; native Chrome control timed out).
- The adapter is not enabled, and this work does not change G08 closure status. G08 remains **Partial**, R11 remains **REJECT**, overall Engineering RC remains **HOLD**. No production, Access, D1, Receiver or formal daily-data action occurred.

## Follow-up — isolated browser evidence (2026-11-21 HKT)

- Served the isolated G09 static build from `/private/tmp/radar-g09-build.0JhEYm/out` on `127.0.0.1:8793`. The Source Inbox loaded the saved synthetic Paste Text fixture after a new browser tab and showed `Captured`, `Needs review`, and `Not approved`; no AI action was invoked.
- At effective CSS widths **360, 390, 768, and 1280 px**, browser measurements found `documentWidth = bodyWidth = clientWidth` and no overflow in navigation links, workflow steps, sections or primary action groups. The 360 px Source Inbox and Research Brief were visually inspected; Research Brief showed the unavailable local service state rather than fabricated data. Keyboard `Tab` moved from the body input to the source URL field. No browser console errors were captured on the inspected pages.
- Opened the saved material and the approval/download step. The candidate download button was disabled and the page listed the missing review, approval, source URL, creator, claims, evidence grade, daily metadata and manual enrichment fields. SourceRecord backup remained available. This is a synthetic local UI gate check, not an approval/export success.
- The collection-backup button was clicked twice with a download-event waiter, but both browser-tool continuations expired before returning a file path; neither download nor re-import is confirmed. **Backup export/import remains Unknown.** No screenshot artifact was saved, so the earlier independent review remains **REJECT** until fresh independent review of complete evidence. G08 redirect validation and R9 operational metrics remain open; Engineering RC remains **HOLD**.
- Re-ran `npm run health:mobile` after stopping the isolated static preview: exit 1, `connect ECONNREFUSED 127.0.0.1:4320`. This confirms the production Origin is not currently available locally; no Origin process was started.
- A controlled `npm run start:mobile` attempt exited 1 with `Run npm run build:mobile before starting the protected origin.` The checkout's `out/.radar-mobile-build.json` marker is absent. No build was written into the existing checkout during this check.
- Preserved the pre-existing `out/` and `.next/` under `/private/tmp/radar-r9-preserve-2026-11-21`, ran `npm run build:mobile` (exit 0; 83 static routes), then `npm run start:mobile` on loopback. `npm run health:mobile` passed: Origin listening at `127.0.0.1:4320` and fail-closed; helper status reported Gemini/model configured. No model request was made. The start output's Node module-type warning remains unrelated and unchanged.
- Stopped the process with Ctrl-C and restored the original `out/` and `.next/` directories. A separate 10-sample HTTP latency measurement was blocked by sandbox `connect EPERM 127.0.0.1:4320`; no latency metric is claimed. External HTTPS, authenticated flow, live model, and physical-phone metrics remain Unknown.
- A static-browser navigation timing read was also unavailable through the current browser evaluation surface, so no client timing value is recorded. The preview loaded the Home route and its same-origin static assets; this qualitative render is not a latency/performance benchmark.
- Fresh independent read-only review of the updated evidence: **REJECT** for Engineering RC PASS. It credits the viewport matrix and limited keyboard/console evidence, while identifying unresolved backup export/import, complete keyboard/UI-state coverage, R9 latency/production metrics, R10 raw logs/per-flow evidence mapping, formal daily before/after hashes, and G08 redirect/DNS validation. The prior R11 verdict remains historically recorded; this review confirms current readiness is still **HOLD**.
- Read-only formal-daily preservation check for the current validator run: aggregate SHA-256 over sorted `data/daily/*.json` names and bytes was `4f61f843af5478efa9851d2e96af5ecd855e0ff4601e78d82cb82bb2b690f1f2` both before and after `npm run validate:data` and `npm run validate:daily`; both validators passed (9 files / 73 articles). This proves those validator commands did not alter the files; it is not a historical hash comparison for earlier RC operations.
- Additional synthetic keyboard-only pass in the static preview traversed primary navigation, saved material open, creator/evidence controls, return/review/reject actions, candidate-blocker links, and SourceRecord backup control. The disabled daily-candidate button was skipped by focus order. `documentElement.clientWidth` and `scrollWidth` matched at the observed 1024 px viewport. No approval, rejection, or download was activated. This covers the observed keyboard route only; screen-reader and full assistive-technology acceptance remain Unknown. No screenshot artifact was saved.
- Fresh `npm test` run: **367 passed / 5 failed out of 372**. All five failures are `tests/mobile-production-server.test.mjs` and share sandbox `listen EPERM 127.0.0.1`; raw output is retained at `docs/qa/artifacts/T216-npm-test-2026-11-21.txt`.
- Re-ran the complete `npm test` with loopback permission after confirming the sandbox bind restriction: **372/372 passed**, exit 0. Successful raw output: `docs/qa/artifacts/T216-npm-test-loopback-enabled-2026-11-21.txt`. This resolves the test-suite execution gap, not production verification.
- Fresh independent read-only re-review after the successful full test run: **REJECT — Engineering RC remains HOLD**. It confirms the test execution gap is closed, while local E2E and backup export/import remain Partial/Unknown, production gate was not exercised, and G08 collector/source-preview redirects plus arbitrary-host DNS pinning remain unresolved.

### Phase 8 flow-to-test evidence map

| Flow | Current evidence | Result boundary |
|---|---|---|
| A. X ingest → dedupe → draft | `tests/cloud-sources-x.test.mjs`, `tests/cloud-ingestion-contract.test.mjs` | Synthetic Worker/DB tests cover identity dedupe and source preservation; no deployed X ingest. |
| B. Draft → evidence review → approval gate | `tests/cloud-worker.test.mjs`, `tests/cloud-sync-contract.test.ts`, R1 report | Synthetic contract tests cover negative/positive transitions; not a human review of real content. |
| C. Modified content → approval invalidated | `tests/cloud-sync-contract.test.ts`, `tests/daily-candidate.test.ts` | Fingerprint/revision changes invalidate state in tests. |
| D. Source failure → partial collection success | `tests/research-runner.test.mjs`, R2 report | Injected timeout/invalid/duplicate fixtures preserve successful records; no live feeds. |
| E. AI failure → SourceRecord preserved | `tests/research-runner.test.mjs`, `tests/cloud-worker.test.mjs` | Synthetic provider failures preserve captured material; no live model request. |
| F. Approved synthetic item → Research Brief | `tests/research-runtime.test.mjs`, `tests/research-runner.test.mjs` | Local runtime tests form a brief without promoting it to approved; not a production brief. |
| G. Approved package → mock receiver → receipt | `tests/secure-handoff-delivery.test.ts`, `tests/content-ops-dispatch.test.mjs` | Mock receiver verifies receipt distinctions; no real receiver dispatch or `import_confirmed`. |
| H. Local D1 → revision conflict → safe readback | `tests/cloud-d1-schema.test.mjs`, `tests/cloud-source-gateway.test.mjs` | In-memory/local synthetic DB contracts cover revision immutability and CAS; no remote D1. |
| I. Mobile card → review → reload | Synthetic browser checks above | Reload and review gate were observed; no review action or backup restore was completed, so full flow is **Partial**. |

This is a per-flow evidence index, not a claim that all nine flows passed as end-to-end tests.

## Follow-up — fresh local draft persistence smoke (2026-11-21 HKT)

- Served the existing isolated G09 static build at `127.0.0.1:8794` and opened `/source-inbox/`. Entered only synthetic text, then confirmed the UI created two records because blank lines are a multi-item separator. Both records displayed `已取得素材`, `未審核`, and `未批准`.
- Reloaded the route. Both synthetic records remained visible with the same unreviewed/unapproved state; no AI action, approval, candidate download, external request, or production data operation was performed.
- Clicked `匯出收集草稿`; the UI returned to its normal saved state, but no new matching `source-inbox-draft-*.json` appeared in the checked Downloads directory. Therefore this interaction does **not** prove backup export or import; that criterion remains Unknown. The existing UI export action serializes the current workbench; no round-trip was established.
- The temporary static server was stopped with Ctrl-C. This is local synthetic browser evidence only; it does not replace the exact viewport matrix, a saved screenshot artifact, physical-device checks, production health, or independent review. Engineering RC remains **HOLD**.

## Follow-up — G09 Cloudflare fetch compatibility (2026-11-21 HKT)

- Official Workers Request documentation states `redirect: "error"` is unsupported and throws before sending. The Gemini helper used that mode, which the previous injected-fetch test had not modeled as a Cloudflare runtime constraint.
- Changed the shared Gemini fetch to `redirect: "manual"`; the existing non-OK check rejects 3xx. Added a regression for 302 to a loopback Location and verified only one request is made. Focused G09/shared Gemini suite: **67/67**; TypeScript, JS syntax, and scoped diff checks passed.
- Wrangler `deploy --dry-run` exited 0 and compiled the Worker bundle without upload; it emitted a local log-write EPERM warning. No live model call, deployment, remote D1 write, or production configuration change occurred.
- Fresh regression runs after the fix: `npm test` **373/373** and `npm run test:phase-1.5d` **29/29**, both exit 0. Existing module-type warnings remain unrelated and unchanged.
- This fixes the Worker redirect-mode incompatibility; G09 stays default-off and G08 collector/source-preview redirect handling remains Partial. Overall R11 verdict and RC recommendation remain **REJECT / HOLD** because independent review, backup export/import, operational and production gates are unresolved.
- A read-only independent reviewer returned **ACCEPT** for this narrow G09 redirect change, limited to code wiring, the regression and official runtime documentation. The mock does not prove deployed Worker behavior. Overall Engineering RC remains **HOLD**.

## Follow-up — source-draft backup interaction (2026-11-21 HKT)

- On the already-open local isolated static preview at `127.0.0.1:8794/source-inbox/`, clicked `匯出收集草稿` once while the visible list contained only synthetic smoke-test records. The accessibility state did not change, and no matching recent `source-inbox-draft-*.json` appeared in Downloads.
- The browser control surface did not expose a completed download path/event; no import was attempted. Backup export/import remains **Unknown**, not passed. No production or remote action occurred.

## Follow-up — Phase 5 local D1 migration (2026-11-21 HKT)

- Applied all 18 migrations to a fresh isolated Wrangler local D1 under `/private/tmp/t216-phase5-local-d1-20261121`; command exited 0 with explicit `--local`, and no remote operation.
- Read-only query confirmed 18 rows in `d1_migrations` and expected application tables. R5 local migration criterion is now **PASS**; production migration and Access state remain unverified.
- Read-only query output is preserved as `docs/qa/artifacts/T216-local-d1-schema-readback-2026-11-21.json`.
- Fresh `npm run typecheck -- --incremental false`, `npm run validate:data`, and `npm run validate:daily` each exited 0. Validators checked 9 files / 73 articles with no warnings or errors. Raw outputs are preserved under `docs/qa/artifacts/T216-*-post-local-d1-2026-11-21.txt`.
- Fresh `npm run test:phase-1.5d` exited 0 with **29/29** passing; raw output: `docs/qa/artifacts/T216-test-phase-1.5d-post-local-d1-2026-11-21.txt`.
- Re-ran both daily validators with an explicit before/after aggregate SHA-256 over sorted JSON filenames and bytes: `4f61f843af5478efa9851d2e96af5ecd855e0ff4601e78d82cb82bb2b690f1f2` matched. Raw output: `docs/qa/artifacts/T216-daily-validator-preservation-2026-11-21.txt`. This proves only that these validator commands left the daily files unchanged, not that earlier RC operations did.
- These runs do not close G04/G08, backup round-trip, operational metrics, or production gates; overall status remains **HOLD**.

## Follow-up — R9 loopback service check (2026-11-21 HKT)

- Started the existing protected Origin and helper on loopback-only ports `54320`/`54310` using the preserved mobile build. `npm run health:mobile` exited 0; no model request was made.
- 10 requests each: unauthenticated Origin `/api/status` remained 401 (mean 1.88 ms, p50 0.68 ms, p95 9.94 ms); unauthenticated `/source-inbox/` remained 401 (mean 0.44 ms, p50 0.41 ms, p95 0.68 ms); local helper `/status` returned 200 (mean 0.83 ms, p50 0.61 ms, p95 2.27 ms).
- This does not measure authenticated UI, public HTTPS, mobile network, Production, or model cost. Both services were stopped; both test ports refused connections afterward; original `out/` was restored. Logs: `docs/qa/artifacts/T216-r9-mobile-health-2026-11-21.txt` and `docs/qa/artifacts/T216-r9-loopback-latency-2026-11-21.txt`.
- R9 remains **Partial**; overall Engineering RC remains **HOLD**.

## Follow-up — G04/G08 closure and R8 browser backup verification (2026-11-21 HKT)

- G04 invalid OPML correction/revalidation is now implemented locally and covered by a synthetic Worker route regression. Invalid corrections stay blocked; successful corrections re-enter the existing bounded job; replay after completion is rejected. No migration or remote D1 write.
- G08 collector and source-preview fetches now validate a fixed hostname allowlist and every manual redirect, and enforce MIME, body-size and timeout limits. Full-suite testing caught a 304-as-redirect regression; this was fixed and covered. Cloudflare's documented interface still does not establish external DNS/IP connection pinning, so G08 remains Partial.
- R8 browser export/import now round-trips three synthetic records through a downloaded versioned JSON backup, a separate browser session, reload, and duplicate import. The records remain captured/unreviewed/unapproved. Evidence: `docs/qa/T216_R8_BACKUP_ROUNDTRIP_BROWSER_2026-11-21.md` and the hashed synthetic fixture under `docs/qa/artifacts/`.
- Fresh verification: `npm test` **378/378**; focused G04/G08/collector tests **94/94**; typecheck, `validate:data`, `validate:daily`, and `build:mobile` exited 0. The production build ran in a temporary output location; pre-existing `out/` and `.next/` were restored. Static browser preview stopped and port 8796 is closed.
- These local fixes do not change the prior independent review of the wider release. G04's invalid-row implementation gap is closed locally; G08 DNS pinning remains unresolved and no independent review of this closure patch was performed. No production deployment, Worker deployment, remote D1 write, true-source handoff, commit, or push occurred. Current recommendation: **HOLD**.
- Final integration gate recheck after this closure: fresh G02 set **77/77** and G03 set **67/67**, both exit 0. The test sets overlap and are not additive. Official Cloudflare docs confirm Workers Fetch is URL-based and does not expose a generic direct-IP request path for pinning an arbitrary public HTTPS host. The current allowlist proves unlisted targets fail before request; it does not satisfy G08's required DNS rebinding / connection-identity evidence. No live production request or deployment was used as a substitute.
- No independent read-only review has examined these final closure diffs. R11's earlier wider-release finding is not a review of this patch. Accordingly the independent review gate and G08 connection-identity gate remain **Unknown / unmet**, and current RC recommendation stays **HOLD**.

## T216 final recheck — current-build R8 (2026-11-21 HKT)

- The R8 test was repeated against the current post-validation build, not the prior candidate. Two distinct isolated Playwright sessions completed browser download → fresh-session import → reload → duplicate import. Three unique synthetic materials remained exactly three and retained captured / unreviewed / unapproved state. A malformed nested record was rejected without replacing those existing materials. Download and snapshot evidence is indexed in `docs/qa/T216_R8_BACKUP_ROUNDTRIP_BROWSER_2026-11-21.md`.
- The R8 restore path now uses a small runtime structural validator before any state setter; regression covers a valid record, invalid status, malformed material form, and missing form. This was the only code change in this recheck.
- Fresh verification after that change: `node --test tests/source-inbox.test.ts` **25/25**; `npm test` **379/379**; `npm run typecheck -- --incremental false`; `npm run validate:data`; `npm run validate:daily`; `npm run build:mobile` (83 static routes), all exit 0. G02 **77/77** and G03 **67/67** were rerun; sets overlap and are not additive. Pre-existing build output directories were restored.
- Independent review of the previous G04/G08/R8 closure returned **REJECT overall**: G04 **ACCEPT** locally; G08 **REJECT** because DNS/connection identity remains unproven; R8 was **UNKNOWN** then because a distinct fresh profile had not been evidenced. The current-build evidence above resolves that R8 profile/round-trip gap, but this latest R8 validation code and browser evidence still require reviewer read-back. G08 remains an explicit Engineering RC blocker. Overall recommendation: **HOLD**. No production deployment, remote D1 write, commit, push, real-source dispatch, or formal daily-data change occurred.
