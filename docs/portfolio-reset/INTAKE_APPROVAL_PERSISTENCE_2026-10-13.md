# AI PM Radar — Intake → Review → Export / Approval Persistence Repair

Date: 2026-10-13 (Asia/Hong_Kong)  
Scope: one reproducible core blocker; no deployment, Git push, schedule change, schema migration, or paid AI call.

## State and environment

- **Owner report — FAIL (not superseded):** the deployed/owner-used auto-collection, manual intake and AI-analysis workflow is not smoothly usable. Exact owner action, authenticated browser state and deployed revision have not been observed in this pass.
- **Repo:** `/Users/mattgor/Documents/Daily/ai-pm-radar`, branch `main`, HEAD `43882ad`, working-tree package `0.4.0`. The working tree had extensive existing tracked and untracked changes before this repair. HEAD alone does **not** represent the tested app.
- **Documented private production URL:** `https://radar.lamlab.cc/source-inbox/`. An unauthenticated request reaches a Cloudflare Access redirect/login, which does not prove that the post-authentication origin is live. At inspection, Mac listeners `127.0.0.1:4320`, `:4310` and `:3000`, and matching Radar origin/helper/tunnel processes were absent. The deployed build revision could not be read through authenticated production.
- **Isolated browser runtime:** `http://127.0.0.1:3001/source-inbox/` with companion `127.0.0.1:4311`, current dirty worktree, Next.js 16.2.9, Node v24.15.0; Google Chrome via installed Playwright at viewport 390×844 and fresh browser context. `AI_PROVIDER=none` was set explicitly for the isolated run. The test instance was shut down afterward.
- **Provider evidence:** isolated `POST /analyze` returned 503 with an actionable unconfigured-provider message and preserved the captured text. Prior records describe Gemini HTTP 400 `FAILED_PRECONDITION` / unsupported user region, but that historical result does **not** establish today's authenticated owner-runtime provider status. No live Gemini/API request was made here.

## Proven failure BEFORE repair

Synthetic-only pasted text of 186 characters, the reserved illustrative source URL `https://example.com/fictional-radar-fixture`, one human-entered claim and literal evidence excerpt were used. Browser UI accepted the text, persisted it across reload, and allowed explicit human review, reusable-source approval, candidate export and SourceRecord export.

Immediately after clicking **批准並下載候選檔**, the browser downloaded a SourceRecord with `review_status=reviewed` and `approval_status=approved`, but an immediate page reload restored `review_status=reviewed` and **`approval_status=not_approved`**. The browser reported no page error. This is a local-worktree runtime defect with observed before/after evidence, **not proof it caused all the Owner's production failures**.

Root cause: `approveAndDownload` immediately set approval in React state and downloaded the approved candidate, while IndexedDB persisted that state asynchronously after a 250 ms debounced effect. Immediate reload could occur before the approved fingerprint was stored; the exported approval and restored UI state disagreed.

## Minimal correction

Changed only application component `components/SourceInboxWorkbench.tsx`:

1. `approveAndDownload` now awaits the **existing serialized IndexedDB write queue** for a snapshot containing the exact approved fingerprint, before marking UI approved or triggering candidate download.
2. `writeStoredWorkbench` now reports success on the IndexedDB **transaction `oncomplete`** (rather than the preceding individual request success), closing the storage connection after commit. This makes export-after-persist meaningful for immediate reload.
3. An outstanding debounced autosave timer is canceled before the explicit durable approval save, so an older snapshot cannot race with it.
4. The approval button is disabled while saving; if persistence fails, the button does not export an approved candidate and the existing local save-error status is set.

No source parsing, evidence validator, human review gate, provider selection, schedule, crawler, scoring, database schema or other product feature was changed.

## AFTER repair: local UI E2E

- Pasted text → created draft: **PASS**.
- Source URL and original text → Save → Reload: **PASS**.
- AI provider unconfigured (503) → readable error without clearing source or fabricating analyzed/verified data: **PASS**.
- Human-entered claim → literal body-backed evidence → human review → separate reusable Source Library approval: **PASS**.
- Candidate download: **PASS**, parsed JSON includes one article.
- SourceRecord download: **PASS**, parsed JSON preserves `raw_text` (186 chars), source URL, one claim, one evidence reference, `reviewed` and `approved`.
- **Immediately reload after export:** **PASS**; the UI shows both `審核狀態=已審核` and `批准狀態=已批准`.
- Browser page errors: **none** in this E2E scenario.
- **Content Ops downstream compatibility:** **PARTIAL**. Independently read the UI-exported synthetic SourceRecord, created an explicitly separately reviewed/approved `content_candidate` handoff, built a DeliveryPackage, JSON-serialized a `content-ops-handoff` v1 intake, then parsed and asserted provenance, evidence references, and SourceRecord ID. **PASS** at contract/readback level; **not** a Content Ops receiver UI import, and `import_confirmed=false`.

## Test matrix

| Check | Result | Notes |
|---|---|---|
| `npm test` | PASS | 121 / 121 on the modified working tree |
| `npm run typecheck` | PASS | TypeScript `--noEmit` |
| `npm run validate:data` | PASS | 2 daily files / 12 records, no errors |
| `npm run validate:daily` | PASS | 2 daily files / 12 records |
| Chrome Browser E2E (390×844) | PASS locally | Same synthetic path before/after, including immediate reload |
| `npm run build` | PASS | Isolated clone with physical `node_modules`, no overwrite of repo's served `out/` |
| `npm run build:mobile` | PASS | Isolated clone; same-origin `/api` export |
| Scoped code formatting / diff check | PASS | No whitespace error surfaced for the modified component |
| Authenticated private production / physical iPhone Owner UAT | BLOCKED | No authenticated Owner session or running origin during inspection |
| Actual Content Ops receiver UI import | NOT VERIFIED | Contract readback only |
| URL live fetch / auto collection / daily schedule / live Gemini | NOT VERIFIED / DEFERRED | Deliberately outside this one-defect repair |

The first isolated production build failed because a **temporary clone symlinked `node_modules` outside Turbopack's root**; copying the dependency directory into the clone and retrying yielded two clean builds. No code fix for this temporary build setup was necessary.

## Recorded synthetic evidence

- `docs/portfolio-reset/evidence/2026-10-13-review-before-approval.png` — review status before human approval (not a screenshot of the original persistence failure).
- `docs/portfolio-reset/evidence/2026-10-13-approval-survives-reload.png` — restored approval status after immediate reload on fixed code.
- `docs/portfolio-reset/evidence/2026-10-13-synthetic-source-record.json` — export with source text, provenance, human approval and evidence.
- `docs/portfolio-reset/evidence/2026-10-13-synthetic-daily-candidate.json` — one-article daily candidate output.
- Local temporary reusable E2E script: `/tmp/radar-intake-e2e-20261013.cjs`. Contract readback: `/tmp/radar-receiver-readback-20261013.mjs`. These scripts are local temporary test fixtures, not production code.

## Owner UAT gate (still open)

1. Owner starts the **existing** authorized production origin/helper/tunnel through their standard runbook, then signs into `https://radar.lamlab.cc/source-inbox/` on their actual browser. Do not interpret the Access login page alone as success.
2. Verify the authenticated production client actually contains this new fix or compare the served revision against the current worktree. **Do not deploy without separate authorization.**
3. In that exact browser, paste a public-safe short text, enter source URL/creator, add one literal evidence excerpt and a supported claim, and save/reload.
4. Review explicitly, separately approve reusable SourceRecord and candidate as applicable, export, then **immediately reload**. Confirm the same approved fingerprint/status and original evidence survive.
5. Download/read back SourceRecord + candidate. For a complete consumer acceptance, separately import `content_candidate` through the actual Content Ops receiver UI in a synthetic isolated Brand/workspace and observe receipt. Export alone is **not** import confirmation.
6. Record redacted request outcomes, screenshots, actual origin/browser/device, and Owner PASS/FAIL. If real URL fetch fails, paste text is the intended fallback. Do not bypass evidence or review gates. Provider issue, feed schedules and automatic filtering remain a **separate later** investigation.

## Delivery decision

- **Completed (local engineering only):** reproducible candidate-approval persistence fix and after-fix UI verification.
- **Partial:** downstream Content Ops intake contract/readback; actual consumer UI receipt unknown.
- **Blocked:** authenticated Owner runtime and physical-device UAT; existing production services were not running locally when inspected.
- **Unknown:** owner-used authenticated deployment revision; whether this defect explains Owner's earlier intake failures; live model/provider and source-adapter failure causes.
- **Planned (not started):** Owner UAT followed by separately scoped daily collection / AI Filtering validation, only after this gate.
- **No push, deploy, commit, staging, Access/tunnel/policy change, scheduling activation, data migration, or production daily data edit.**
