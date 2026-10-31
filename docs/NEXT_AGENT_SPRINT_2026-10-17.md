# AI PM Radar — Agent Sprint Directive (2026-10-17)
Status: PLANNED / T0 / Active Engineering #1. Not a deployment authorization.
Primary Outcome: Restore a reliable, authenticated approved-intelligence handoff to Content Ops, with end-to-end receiver evidence.

## Context to read first
Read AGENTS.md, docs/GOALS_2026-10-12_2026-11-10.md, docs/CONTENT_WORKFLOW.md, docs/CONTEXT_SUMMARY.md and the existing Phase 1.8 Archive/Dispatch/Receiver contracts. Identify the canonical runtime and current Git worktree before changing code. Existing owner-state: HEAD e9c14c5, dirty worktree; Origin :4320 returned HTTP 421; Archive local :4482 returned 200; LAN :4482 returned 401; :4310 helper listening. These are point-in-time observations, not a diagnosed root cause.

## Scope
1. Read-only preflight: git rev-parse/status/diff --stat, existing listener PIDs and launch configuration, runtime origin/host allowlists, Cloudflare/Tunnel references (do not edit), server and receiver health. Inspect why :4320 returns 421; distinguish expected host enforcement from a real routing fault. Record exact requests/status/response without secrets. Do NOT relax security merely to change 421 to 200.
2. Validate authenticated Archive read on local and trusted LAN using existing mechanisms; a 401 without credentials is not by itself a failure. Do not expose :4482 or :4496 publicly.
3. Trace existing SourceRecord → evidence → manual review → approved content_candidate → signed Dispatch → Content Ops :4496 receiver. Preserve signed sourceId/SHA256/Brand/timestamp/content, DeliveryPackage immutability and the receiver contract. Reuse exact Brand ID personal-ai-consultant (if configured); never guess or auto-create real account IDs.
4. Execute synthetic E2E first: approved fixture, HMAC signature, SQLite receipt, pending list, browser import, acknowledgment and reimport idempotency; Content Ops is the source of truth for receiver confirmation. Test tamper, unsigned, expired, cross-brand and changed-source rejection.
5. Prepare one REAL approved SourceRecord for Owner-operated UAT only if sourced from public non-sensitive material; Owner must explicitly review and approve before any real dispatch. Without it, report REAL E2E as BLOCKED/UNKNOWN, not PASS.
6. Produce a compact Content Opportunity Brief as downstream editorial guidance, not a new source fact: audience NGO/education/SME, operational pain point, evidence link, analyst interpretation, uncertainty, content angle, optional diagnostic CTA idea. Do not modify the signed receiver payload without joint contract tests; if required fields are not supported, keep the brief in a separate derived note.
7. Document restore procedure, exact health probes and no-regression security checks; recommend a deployment gate only, do not change production, Tunnel, schedules or API keys.

## Acceptance Criteria
- AC1: Root-cause or bounded explanation for :4320 421, host-safe health check and restart procedure; no weaker origin/auth policy.
- AC2: Archive local and authorized LAN read verified or explicitly Blocked with evidence; unauthorized access remains denied.
- AC3: One synthetic source-to-receiver sequence with original source/evidence IDs and Content Ops receiver-side receipt; no assertion that exported means imported.
- AC4: Identical retry returns the same receiver draft, wrong Brand or changed evidence rejected, receiver browser draft stays unapproved.
- AC5: One real Owner-approved dispatch has actual receiver confirmation OR prominently remains not yet verified.
- AC6: Evidence saved in docs/qa or equivalent and no pre-existing dirty files lost.

## Tests
Use documented scoped npm test/typecheck/validate:data/validate:daily/build/build:mobile, contract tests, HTTP status probes and git diff --check limited to new changes. Record exact pass/fail/blocked; do not claim production validation from a local build.

## Non-goals / stop conditions
No new scrapers, Agent/RAG framework, cloud DB migration, new marketing automation, automatic approval, public port exposure, production JSON changes, live AI/API spending, reset/stash/clean, blanket git add/commit/push, merge or deployment. Stop at approval or rights/security boundaries.

## Output to Owner
1) Completed/Partial/Blocked/Unknown/Planned; 2) technical defect and fix evidence; 3) synthetic E2E and real E2E distinct; 4) changed paths/test outputs; 5) Owner GO/HOLD questions; 6) Content Ops handoff note with exact brand, IDs and safe receiving instructions.

## Execution update — 2026-10-30 HKT

- **Partial:** Protected production Origin/helper are running and health-checked; the authenticated browser can load Home, Research Brief, and Source Inbox. The synthetic Worker's authenticated capabilities route is currently readable and remains synthetic-only/access-required. Exact active Worker version was not independently re-read because the Dashboard redirected to login and terminal DNS resolution failed.
- **Verified local:** Source Inbox IndexedDB save/reload preserved one synthetic draft and kept it unreviewed/unapproved with candidate export blocked. A local UI status-label correction is tested and built in an isolated Webpack output; no production static deployment occurred.
- **Owner review and limited source reuse approval complete:** Public Google Cloud AIHelp SourceRecord `src_4a0922cb` is saved under `docs/qa/recovery-r1-owner-uat/`, with exact source-linked evidence. On 2026-10-30 Owner retained the three vendor-reported claims at evidence grade B and approved their use only in an editable Content Candidate draft. The handoff remains an unreviewed, unapproved draft; no daily candidate or dispatch is approved. Publication date is unknown; AI analysis is not requested. Target Brand `personal-ai-consultant` requires revalidation at dispatch.
- **Delivery gap:** Canonical Radar app has Content Ops v1 file-intake export but no HMAC Receiver sender integration in `app/`, `components/`, `lib/`, or `scripts/`. Read-only Receiver inspection found signed POST guarded by a server-only secret/Bearer HMAC, while browser pending/ack is exact-Origin CORS for trusted LAN and is explicitly not Internet-safe. Earlier isolated Phase 1.8 E2E is not current mobile-to-Receiver evidence. No Content Ops receipt exists, so `import_confirmed` remains unset.
- **HOLD:** physical iPhone/cellular save/readback, Archive authenticated 200, current Receiver HMAC route and receipt, and Owner-approved real dispatch remain unverified. No D1 write or production daily-data write occurred in this continuation. One earlier page-load-triggered D1 `GET /records` read is documented in `CONTEXT_SUMMARY.md`.

## Synthetic Worker deployment follow-up — 2026-10-30 HKT

- With authorization limited to the fixed synthetic Worker, deployed `radar-phase13-one-article-dark` version `24ae7e77-f008-46a0-bf73-bfe06f2318ba` using the existing protected config. The deployed Worker has no diagnostic response path; Access policy and configuration were retained.
- Local JWT/Worker tests: **18/18 PASS**. Unauthenticated external capabilities request returned Cloudflare Access **302** to sign-in. This browser session was not Access-authenticated, so deployed post-login verification remains **NOT VERIFIED**. No D1 API or Receiver request was made.
- Existing D1 bindings and hourly cleanup trigger were preserved and not changed; the scheduled cleanup remains active. Overall release remains **HOLD** and `import_confirmed` remains unset.

## Controlled Receiver dispatch preparation — 2026-10-30 HKT

- Fresh checks: local Origin health PASS; wrong Host 421 is the expected host guard; expected Host/HTTPS without Access JWT is 401; LAN Archive `/archive` is 401 while loopback Archive is 200 HTML shell. Receiver `*:4496` was identified in another checkout and was not contacted.
- Canonical Radar now has server-only signed dispatch to fixed loopback `127.0.0.1:4496/api/intake/radar`, behind Access-protected same-origin `/api/content-ops/*` routes. No arbitrary Receiver URL, CORS relaxation, or public Receiver route was added.
- Readback is also server-side and source/Brand/hash/content bound. The UI can mark Content Ops `import_confirmed` only after this readback returns the exact Receiver draft in `imported` state; a POST receipt or HTTP 200 alone is insufficient.
- Dispatch requires an exact Brand allowlist and repository-external mode-0600 secret file. Do not configure a real Brand until verified from the Receiver. A receipt remains distinct from `import_confirmed`.
- Local synthetic HMAC/fake-Receiver tests and exact-Origin proxy tests pass. One isolated run exercised the actual Receiver module with temporary SQLite + `demo-brand-ai-pm`: signed POST, pending readback, ack and Radar status readback returned imported; temporary DB/secret were removed. It did not contact `:4496` or D1 and did not verify browser UI import. Owner real dispatch remains **HOLD**.
- Verification before Receiver readback follow-up: full suite 216/216 and isolated build 22/22 passed. Latest follow-up: full suite **217/217**, typecheck, both daily validators, isolated Webpack build **22/22 routes**. Empty-config helper routes returned fail-closed JSON and the temporary process was stopped. Active production services and their `out/` were not changed.
- Content Ops receiver/import mapping tests also passed **10/10** with a temporary test cache; no Content Ops code changed. The phone/browser Inbox import is still not verified. Technical package/receipt IDs were moved into a collapsed advanced-details section in Radar's delivery card.

## Recovery R1 fresh runtime audit — 2026-10-30 HKT

- Authenticated browser GET `https://radar.lamlab.cc/api/content-ops/status` still returns `api_route_not_found`. Direct loopback request to Origin `127.0.0.1:4320` with the loopback Host returns “Misdirected request” (421), consistent with the existing Host guard. Do not relax the guard.
- Loopback Archive `/archive` rendered its private shell. LAN Archive navigation failed with `ERR_INVALID_AUTH_CREDENTIALS`; an authenticated LAN Archive read is not established. Radar Origin/helper listener PIDs 10892/10893 have cwd `/Users/mattgor/Documents/Daily/ai-pm-radar`; neither was restarted. `npm run health:mobile` from the restricted shell returned `EPERM` connecting to loopback despite the listeners being present.
- Fresh checks: `npm test` **218/218**, `npm run typecheck`, `npm run validate:data` (2 files / 12 articles, no warnings/errors), `npm run validate:daily`, and scoped `git diff --check -- docs/CONTEXT_SUMMARY.md` pass. No build, production restart/deploy, D1 operation, or Receiver request was made.
- Synthetic pilot capability GET still establishes only Access-required, isolated, synthetic-only policy and `cloud_write_enabled=false`; no D1 record/history route was called in this audit. The approved seven-day fixture retention decision remains in force.
- **Current gate:** production route activation awaits explicit Owner GO. Browser-local draft persistence and local contract tests do not establish cross-device persistence. No matching Content Ops Receiver receipt exists; `import_confirmed` remains unset. Keep overall Recovery R1 **PARTIAL / HOLD**.

## Recovery R1 Research date label correction — 2026-10-30 HKT

- Production Research page was read-only checked: latest selected runner date `2026-10-18`; its 55-item Collector snapshot is timestamped `2026-10-18 01:55 HKT` and marked older than 24 hours; the selected runner state is `尚未執行`. The date picker incorrectly labeled `2026-10-11` as `今天` while page time was `2026-10-30 HKT`.
- Fixed the label comparison to use the actual current Hong Kong date, with a regression test for stale dates and timezone boundary. This is source-only until deployment; the production page remains on the previous build.
- Verification: focused Research runtime tests **17/17**, full suite **219/219**, typecheck, both daily validators, scoped diff check, and isolated Webpack build **22/22 routes**. Isolated Build ID: `jZ438EaxBpLDGHG-s3gB3perl`; output remained under `/private/tmp/radar-r1-build.w0zFD1/out`.
- No runner, feed collection, AI analysis, production output, Origin/helper process, D1 or Receiver was touched. Production activation still awaits explicit Owner GO; keep overall status **PARTIAL / HOLD**.
- Additional authenticated read-only UI evidence: Home shows the `2026-07-02` daily edition with a 120-day stale warning and reports one browser-local material; Source Inbox shows one `#1` material card and states cross-device sync is not enabled. The accessibility tree's `Value: 2` on the “素材清單” heading denotes H2, not two records; no count discrepancy is established.

## Recovery R1 review UX and local save verification — 2026-10-30 HKT

- Removed the expandable raw JSON inspector from the review UI; preserved plain-language review, blocker navigation, gated candidate download, and SourceRecord backup download.
- Isolated static build: **22/22 routes**, Build ID `VTkwiQtJ1OpzYnA_TCZt`, 214 files at `/private/tmp/radar-r1-ui-build.8MWdPW/out`; repository `out/` was not replaced.
- Local synthetic browser flow on port 43981: Paste Text → draft → Review → reload. The exact synthetic draft remained in local IndexedDB, review/approval remained unset, candidate download remained disabled, no JSON inspector appeared, and browser error log returned zero errors. The preview server was stopped; its test-only browser storage may remain under that loopback origin.
- `npm test` **219/219**, typecheck, both daily validators, and scoped diff checks pass. No AI call, Receiver request, D1 access, production write or deployment occurred. This does not establish cloud save, cross-device readback, or physical iPhone UAT.

## Recovery R1 authorized mobile activation checkpoint (2026-10-30 HKT)

- One-time production activation was explicitly authorized and completed at `https://radar.lamlab.cc/`. Build ID `dQ3HcT4SOpg2T6388yCL6`, 209 static files, tree SHA-256 `a4dc5b5f4f338ec16852c05a578bef109700d13246675e5b611f5750ac52845b`. Rollback archive and directory are recorded in `docs/DEPLOYMENT.md`.
- Origin/helper health passes. Unauthenticated HTTPS is Access-redirected (302); authenticated Home, Research Brief and Source Inbox load. Unknown API path returns JSON 404. Mobile viewport emulation 360/390/768 has no horizontal overflow; physical phone/cellular is not verified.
- `/api/content-ops/status` reports `content_ops_brand_allowlist_missing`, so dispatch remains fail-closed. No Receiver request, D1 write, Worker deploy, schedule/AI toggle, or daily-data write occurred. Research snapshot is stale (2026-10-18), daily edition is 2026-07-02. `import_confirmed` remains unset.
- Recommendation: **HOLD** real Content Ops delivery until the exact target Brand ID is verified/configured, a separately approved package is ready, and a matching Receiver readback proves Inbox import. Do not infer receipt from route health or package export.
