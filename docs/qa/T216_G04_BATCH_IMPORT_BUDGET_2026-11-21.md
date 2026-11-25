# T216 G04 — Batch import and budgeted summarization

Date: 2026-11-21 HKT  
Scope: local implementation and synthetic verification. No live Gemini/Workers AI call, remote D1 write, Worker deployment, or production data change.

## Outcome

> Historical baseline: the initial `Partial` outcome and unmet-acceptance notes below record the pre-closure state. The closure follow-up at the end of this report supersedes those findings for current local implementation status; it does not imply remote D1 or authenticated Production acceptance.

Historical status at initial report: **Partial** — the required invalid-row recovery path was missing and authenticated UI end-to-end was unverified. See the closure follow-up for current local status.

G04 adds a unified source import flow for newline text, OPML, and CSV, with editable CSV mapping, validation preview, explicit one-time confirmation, bounded row batches, persisted job status, resume, cancel, and selected transient-failure retry. Existing sources are not overwritten; canonical source identity prevents duplicate inserts. Import and progress endpoints report zero AI calls.

Daily draft cards with eligible excerpts can be explicitly selected for batch AI summarization. The request requires a confirmed maximum item count (1–10) and model-call count (1–20), uses G03 `summarize`, spends only on actual provider attempts, stops when the call ceiling is reached, and reports unprocessed IDs. Results remain `draft` and `needs_review`; they do not create review, approval, or verification state.

## Changed files

- `cloud/src/source-import.mjs` — bounded text/CSV/OPML parsing, editable mapping contract, input validation and canonical identity.
- `cloud/migrations/0016_resumable_source_imports.sql` — canonical source identity plus persisted import job/row tables.
- `cloud/src/routes-p1.mjs` — preview/confirm/status/run/cancel/retry routes; preserves legacy bulk route and fixes legacy X identity recognition.
- `cloud/src/worker.mjs` — bounded explicit batch summarization route and canonical source duplicate check.
- `cloud/public/index.html`, `cloud/public/app.js` — import panel, file/text inputs, CSV mapping, progress/resume controls and budget-confirmed summary UI.
- `tests/cloud-source-import.test.mjs`, `tests/cloud-worker.test.mjs`, `tests/helpers/cloud-fakes.mjs` — parser and route regressions, migration fixture support.
- `package.json` — includes the new parser test in `npm test`.
- `docs/CONTEXT_SUMMARY.md` — current G04 state and limits.

## Verification

- `npm test` — exit 0, **353/353 passed**.
- `npm run typecheck` — exit 0.
- `node --check` for `cloud/public/app.js`, `cloud/src/worker.mjs`, `cloud/src/routes-p1.mjs`, `cloud/src/source-import.mjs` — exit 0.
- Scoped `git diff --check` — exit 0.
- Browser static preview at `http://127.0.0.1:8792/`: source import panel and controls were visible and accessible. Its static-only server correctly returned 404 for API routes, so UI-driven import/job continuation was not verified. An isolated local Wrangler dev attempt remained protected by Access and returned 401; no auth bypass was introduced.
- Synthetic Worker tests verified preview without writes/AI, confirmation gate, idempotent job creation, 10-row chunking, resume, cancel without rollback, transient retry, missing-budget rejection, call-ceiling stop, remaining IDs, and draft review state.

## Not verified / limits

- Independent read-only review: **ACCEPT** after one revision for cancel/run race safety and stale-preview invalidation.
- No real provider call or cost measurement was made. The budget limits model attempts, not a currency amount; the existing provider quota remains an additional limit.
- Authenticated browser UI end-to-end was not verified. A local static visual preview confirmed the controls render, but API actions returned 404 because that preview intentionally served static assets only. No production route, remote D1, or deployed UI was changed.
- Import jobs live in the selected D1 database; local browser job ID is only a convenience pointer. No arbitrary user content is saved to browser storage by this UI.
- **Historical unmet G04 acceptance (pre-closure):** an invalid OPML row was persisted with status `invalid`, while the retry endpoint accepted only `failed` rows. A synthetic route check confirmed the bad row returned `409 no_failed_rows_selected`. The closure follow-up below adds corrected-input revalidation; invalid input is not converted into a transient failed row.
- A currently executing single-row D1 batch may complete before a concurrent cancel is observed; already completed rows are never rolled back.

## Closure follow-up — invalid-row recovery (2026-11-21)

- Implemented the missing invalid OPML recovery path in `cloud/src/routes-p1.mjs`: an owner can submit a corrected type/value/label/category for selected `invalid` rows; server validation runs again, invalid corrections remain invalid, and valid corrections re-enter the existing bounded import queue. Cancelled jobs and replay against completed rows are rejected. No schema migration or external fetch was added.
- `cloud/public/app.js` renders correction inputs and a distinct “重新驗證” action for invalid rows; transient `failed` rows retain the existing retry action.
- Synthetic route regression verifies an unsafe correction remains invalid, a corrected HTTPS feed becomes pending, the import run inserts it once, and completed-row replay returns 409.
- Focused G04/G08/collector suite passed **94/94**; full `npm test` passed **378/378**. Authenticated browser UI import remains unverified. No remote D1 write or deployment occurred.
- The G04 implementation gap is closed locally; broader release remains subject to the Engineering RC/HOLD gates already documented above.
