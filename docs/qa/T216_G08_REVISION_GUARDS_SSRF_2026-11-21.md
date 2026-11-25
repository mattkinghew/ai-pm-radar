# T216 G08 — revision guards and SSRF verification

Checked: 2026-11-21 (HKT)

## Revision/CAS coverage

| Async path | Guard now used | Evidence |
|---|---|---|
| Scheduled collector, short Chinese extractive result | `ai_provider IS NULL` plus exact `title`, `raw_excerpt`, and `updated_at`; increments `analyzed` only when the conditional update changed a row | New regression `extractive analysis does not write or count a result from a stale source snapshot`; existing `short Chinese capture is extractive and consumes no model quota` |
| Scheduled collector model summary | Existing exact title/body/updated_at/provider guard retained | `auto analysis preserves manual floor and respects daily item limit`; stale manual-source regression |
| Explicit deep-read / translate and bounded batch summarize | Exact title/body/updated_at/provider snapshot retained in `AI_UPDATE` call sites | `deferred item AI cannot overwrite manual source or appear in its earlier snapshot`; `batch AI summary requires an explicit bounded budget...` |
| Article fetch / refresh | Item title, URL, excerpt, metrics and `updated_at` snapshot checked before article insert/upsert and metadata write; existing article revision/paragraph snapshot remains conditional | New regression `reader fetch discards extracted content when the source revision changes during fetch`; refresh success/failure regressions |
| Full-text translation, one chunk at a time | Item source snapshot and article timestamp/paragraph/translation snapshot checked in the same D1 batch | `deferred translation cannot erase newer manual history or language`; `reader: fetch+cache, chunked translation...` |
| Full-text summary | Article timestamp/paragraph/summary plus item source snapshot checked after the model call | `deferred reader summary cannot replace a newer manual body` |
| Manual capture enrichment | Existing item `metrics`/`updated_at` plus article revision predicates retained | `same URL manual capture preserves reader history and rejects duplicate races`; `concurrent exact URL captures use SQLite uniqueness...` |

## SSRF findings

> Historical baseline: the collector/source-preview redirect finding below predates the closure follow-up. The follow-up adds shared fixed-host fetch enforcement with manual per-hop redirect validation; the unresolved current gate is external DNS / connection-identity pinning, documented below.

- The article reader uses `redirect: "manual"`, validates every redirect target with `safeFetchUrl`, limits redirects to three, applies a 12-second timeout and caps HTML at 1,000,000 bytes. Regression coverage now explicitly asserts IPv4 loopback and IPv6 loopback redirect targets are rejected before a second fetch; `safeFetchUrl blocks SSRF targets` also checks IP literals and private-name patterns.
- Cloudflare’s current Request documentation says Worker fetch supports manual redirects and recommends checking redirects in application code. Its `resolveOverride` option only applies when both hostnames belong to the Worker’s zone; it does not provide a general external DNS-resolution pinning interface. Therefore arbitrary-host DNS pinning remains **Unknown / unavailable through the documented interface**. Existing host validation, manual per-hop redirect checks, bounded redirect count and timeout are compensating controls, not proof against DNS rebinding. Sources: [Workers Request API](https://developers.cloudflare.com/workers/runtime-apis/request/) and [Workers Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch/).
- **Historical pre-closure gap:** collector feed requests (`conditionalFetch` in `cloud/src/collector.mjs`) and source discovery preview (`cloud/src/routes-p1.mjs`) then used default redirect-follow behavior. The closure follow-up below replaces those two paths with the shared restricted fetcher. The current unresolved G08 gap is DNS / connection-identity pinning, not redirect validation.

## Verification and limits

- Test-first reproduction: before the patch, the reader race returned 200 and stored the stale article; the extractive race reported `analyzed=1` and wrote the stale summary. After the patch, both reject the stale write.
- Focused set: `node --test tests/cloud-g08-cas-ssrf.test.mjs tests/cloud-p1-reader.test.mjs tests/cloud-ingestion-contract.test.mjs` — **35/35 passed**, exit 0.
- Broad repository suite excluding only sandbox-blocked `tests/mobile-production-server.test.mjs` — **359/359 passed**, exit 0. Full `npm test` was not rerun after G08; prior attempts hit `listen EPERM` in that excluded file.
- `npm run typecheck -- --incremental false`, changed-JS syntax checks and scoped `git diff --check` — exit 0.
- Independent G08 review: **UNKNOWN**. Reviewer confirmed the new extractive and reader-fetch race tests and code-level CAS predicates, but noted that reader translate/summary, item deep-read/translate and batch-summary race paths lack direct stale-response regression tests. The separate audit also found the collector/source-preview redirect gap above.
- No outbound live source fetch, Gemini call, remote D1 access, production migration, deployment, or formal daily data modification occurred.

## Rollback

No database migration or remote state change was made. Revert only G08 hunks in `cloud/src/collector.mjs`, `cloud/src/routes-p1.mjs`, `package.json`, and the new G08 test/report files after reviewing their diffs; these source files already contain unrelated dirty work and must not be reverted wholesale.

## Closure follow-up — 2026-11-21

- Added `cloud/src/safe-fetch.mjs` for collector and source-preview outbound fetches: fixed hostname allowlist, manual redirects with validation on every hop, three-hop cap, MIME allowlist, 1 MB body limit, and 10 second timeout. Arbitrary user RSS domains are intentionally blocked in this Cloudflare Worker path. Article Reader continues to use its existing separately tested safe-fetch path.
- Regression coverage includes an arbitrary hostname blocked before fetch, a redirect to link-local metadata blocked before a second request, response MIME/size/timeout enforcement, and collector redirect rejection.
- The first full-suite run exposed a compatibility regression: HTTP 304 was treated as a redirect because it is in the 3xx range. `fetchRestricted` now handles 304 as a cache response. Focused tests verify this correction.
- Verification after correction: G08/G04/collector focused command passed **94/94**; complete `npm test` passed **378/378**; typecheck, both daily validators and `build:mobile` passed.
- Residual security limit: Cloudflare Workers' documented `resolveOverride` is zone-scoped and does not provide external DNS pinning. The allowlist reduces attacker-controlled destination choice but is not proof against DNS rebinding of an allowlisted hostname. Therefore G08 remains **Partial** pending platform-supported connection-address binding or a security review accepting this bounded-host model. No Worker deployed, no D1 written, no production source changed.
