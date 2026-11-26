# G5 — Daily Digest / Markdown export

Status: Blocked

## Handoff packet

- TASK-ID: G5
- Goal: authenticated daily/weekly digest with one-click Markdown export, using existing approved signals and zero AI calls.
- Base: `feat/cloudflare-cloud`, HEAD `0d8a034`; existing owner changes were present before this task.
- Acceptance criteria: protected GET-only API; HKT daily/weekly windows; safe publication gate; score sorting and lane groups; deterministic browser/Node Markdown formatter; mobile digest UI and copy/preview; full tests, typecheck, syntax checks, and 375px visual acceptance.
- Non-goals: schema or Wrangler configuration changes, AI calls, remote D1, deployment, publication, schedules, commit/push.

## API contract and safety

`GET /api/digest?window=daily|weekly&date=YYYY-MM-DD&lane=TECH_NEWS&limit=30`

The existing owner Access JWT gate runs before the handler. Unauthenticated requests return 401; authenticated non-GET requests return 405 with `Allow: GET`. Machine bearer credentials cannot enter this route. Responses use `Cache-Control: no-store`. D1 failures return sanitized 503 errors.

Only daily items with `status=approved`, `curation_status=main|released`, no injection flag and no dismissal are eligible. A linked KB entry must have `origin=approved` and `kb_type=item`. Manual KB entries, notes, syntheses, stars without approval, drafts, reviewed-only items, rejected items and quarantined items are excluded. KB notes, KB summaries and raw excerpts are never selected for the new digest response. The eligibility SQL is shared with G4 showcase.

Dates use Asia/Hong_Kong (UTC+8). The source timestamp is `published_at`, falling back to HKT `run_date`, then `created_at`. Daily selects one HKT calendar day. Weekly selects the requested day and preceding six calendar days, inclusive. Explicit dates with no eligible items return an empty digest, without fallback.

For default daily requests only, the most recent eligible date on or before HKT today is selected within the requested lane. If it differs from today, `fallback_used=true` and `date_label` contains the actual edition date. If no eligible date exists, the date stays today, `fallback_used=true`, with empty lanes/highlights. No future day is selected as a fallback.

`limit` is a positive decimal integer, default 30, capped at 60. `total_items` and lane counts describe returned items after the global cap. Items sort by score descending, then publication timestamp descending and ID ascending. Top highlights are the first three globally. Lane groups sort by count, then highest score, then lane name.

Legacy `?days=1..30` retains its existing rolling-created-time, preference/trainer ranking and lane-object response for existing consumers, but now applies the same publication gate and omits raw/private content. `window` takes precedence when both are supplied. Three existing ranking tests now explicitly approve their synthetic fixtures and attach approved KB entries; their original ranking/feedback assertions remain intact.

## UI / Markdown

The 今日晨報 tab offers daily/weekly pills, a lane filter, Top 3, lane cards, exact Markdown preview and copy feedback. The existing 7-day shortcut opens the new weekly view. Keyboard navigation supports seven tabs. Styles reuse existing tokens with wrapping navigation and constrained grid columns.

`cloud/public/digest-markdown.mjs` is pure ESM without Node dependencies. It escapes Markdown title/text punctuation, collapses line breaks and uses only HTTP(S) source links without credentials. Copy uses `navigator.clipboard.writeText`; on failure it selects the preview textarea and tries `execCommand('copy')`. If that fails, the exact preview stays selected for manual copy. Actual browser support remains unverified in this environment. See [MDN Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) and [MDN execCommand](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand).

D1 queries use the existing binding and parameterized statements; see [Cloudflare D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/).

## Changed files / diff

- `cloud/src/digest.mjs`: eligibility predicate and HKT query/grouping service.
- `cloud/src/worker.mjs`: authenticated digest dispatch, method rejection and safe legacy compatibility.
- `cloud/public/digest-markdown.mjs`: deterministic Markdown formatter.
- `cloud/public/index.html`: dedicated digest tab.
- `cloud/public/app.js`: digest loading, rendering, filters, preview, copy and seven-tab shortcuts.
- `cloud/public/app.css`: digest layout using existing tokens; wrapping navigation.
- `tests/cloud-g05-digest.test.mjs`: eight focused tests for auth, methods, dates, ranking, limits, leakage, failures and formatting.
- `tests/cloud-lanes.test.mjs`: approved digest fixtures; existing assertions preserved.
- `package.json`: register G5 in npm test.
- `docs/G05_DIGEST.md`: behavior, safety, evidence and handoff.

Tracked task diff before this document: 6 files, 79 insertions, 16 deletions. New service/formatter/test: 204 lines. Full working-tree diff includes pre-existing `.gitignore`, `README.md`, `cloud/wrangler.toml`, and `tsconfig.tsbuildinfo` changes; these must not be attributed to G5. Typecheck may refresh the already-dirty incremental TypeScript cache. Migrations and Wrangler configuration were not edited by this task.

## Verification evidence

Exact output files live in `output/g05/`:

| Command | Exit | Evidence |
| --- | --- | --- |
| `node --test tests/cloud-g05-digest.test.mjs tests/cloud-lanes.test.mjs` | 0 | `focused.log`: 21 tests, 21 pass, 0 fail |
| `npm test` | 1 | `npm-test.log`: 422 tests, 417 pass, 5 fail |
| `npm run typecheck` | 0 | `typecheck.log`: `tsc --noEmit` |
| `node --check cloud/public/digest-markdown.mjs && node --check cloud/public/app.js` | 0 | `syntax-check.log`: no stdout/stderr |
| `git status -sb` | 0 | `git-status.txt` |
| `git diff --stat` | 0 | `git-diff-stat.txt`: includes pre-existing changes; excludes untracked files |
| `git diff --check` | 0 | `diff-check-all.txt`: no whitespace errors |

G5 and all G1–G4 tests in the full suite passed. The five failures are existing mobile-server tests at lines 67, 87, 136, 162 and 181 of `tests/mobile-production-server.test.mjs`; each fails while trying to bind a local socket. No test was skipped or weakened. No executed evidence of a full zero-failure suite is available.

## Known failures / stopping condition

- Failure: full regression and visual acceptance cannot finish in this sandbox.
- Command: `npm test`.
- Exact error: `Error: listen EPERM: operation not permitted 127.0.0.1`.
- Files involved: `tests/mobile-production-server.test.mjs`, local server startup; no G5 assertion failed.
- What was attempted: full suite; isolated synthetic preview via `node /private/tmp/radar-g05-preview.mjs` on `127.0.0.1:4395`.
- Preview exact error: `Error: listen EPERM: operation not permitted 127.0.0.1:4395`.
- Browser command: `node /Users/mattgor/.npm/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js --session g05 open 'http://127.0.0.1:4395/?tab=digest'`.
- Browser exact error: `EPERM: operation not permitted, open '/Users/mattgor/Library/Caches/ms-playwright/daemon/ccff619976726dc7/g05.err'`.
- Most likely blocker: managed filesystem/socket sandbox permissions. No elevated retry, permission workaround or remote service was used.
- Smallest next decision required: select an execution environment that permits local loopback and the browser cache, then rerun the exact full suite and desktop/375px/390px copy/preview checks.
- Unknown: visual rendering, horizontal overflow at 375px, real clipboard/fallback behavior, physical iPhone Safari and live Access/D1 integration. No screenshots were produced. Deployment and real data were not exercised.

Implementation stopped after these permission failures. This is local unit-test evidence, not production or owner UAT acceptance.
