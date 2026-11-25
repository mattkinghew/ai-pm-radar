# T216 G03 — Shared translation and summary pipeline

Date: 2026-11-21 HKT  
Scope: local implementation and synthetic verification only. No live provider calls, Cloudflare changes, migration execution against a remote database, or deployment.

## Outcome

G03 adds shared source/analysis provenance and configurable Traditional Chinese output to the existing item and reader routes. The existing provider selection and quota logic remain in place; no provider fallback or billing behavior was added.

- Feed, X, and adapter items retain a `source_type`; analyses persist provider/model, source type, content basis, and `completed|skipped|failed|not_requested` state.
- Reader records retain full-text versus insufficient-content basis, source type, provider/model, translation language/model, and stable extraction error codes. RSS excerpts cannot be sent as full-text summaries.
- Target language defaults to `zh-Hant`; `zh-Hans` and `en` are configurable. Automatic analysis has explicit enabled, include-term, exclude-term, and item-limit settings. Skips and failures retain per-item reason codes and are visible in source health.
- Provider failures are classified into stable codes with safe Chinese hints and retryability metadata. Provider response bodies are not returned or logged.
- Existing compare-and-swap checks for source metrics and article snapshots remain in the write paths.

## Changed files

- `cloud/src/ai.mjs` — shared language/model selection and safe AI failure classification.
- `cloud/src/collector.mjs` — source provenance, auto-analysis gates, and persisted outcome reasons.
- `cloud/src/worker.mjs` — API projection, error responses, source health, and sanitized diagnostics.
- `cloud/src/routes-p1.mjs` — reader/translation provenance and full-text-only summary gate.
- `cloud/public/app.js` — actionable error messages and analysis basis/status display.
- `cloud/wrangler.toml` — explicit defaults for language and auto-analysis gate terms/limit.
- `cloud/migrations/0015_shared_ai_provenance.sql` — versioned item/article provenance fields and conservative historical backfill.
- `tests/helpers/cloud-fakes.mjs`, `tests/cloud-worker.test.mjs`, `tests/cloud-p1-reader.test.mjs`, `tests/cloud-ingestion-contract.test.mjs` — migration fixture and synthetic regression coverage.
- `docs/CONTEXT_SUMMARY.md` — current G03 status and limits.

## Verification

- Focused Cloud tests: `node --test tests/cloud-worker.test.mjs tests/cloud-p1-reader.test.mjs tests/cloud-ingestion-contract.test.mjs tests/cloud-source-registry.test.mjs` — **58/58 passed**.
- Full suite: `npm test` — **344/344 passed**. The first sandboxed run could not open loopback listeners (`EPERM`); the permitted test run then passed without code changes for that environment issue.
- TypeScript: `npm run typecheck` — exit 0.
- JavaScript syntax checks for the modified Cloud modules and scoped `git diff --check` — exit 0.
- Independent read-only review: initial REJECT identified reader provenance and language-label gaps; both were corrected with direct regression coverage. Final verdict: **ACCEPT**.
- Tests use synthetic records and injected provider responses; they are contract tests, not live Gemini evidence.

## Not verified / deployment gate

- No live Gemini/Workers AI call was made, as required by G03. Actual account quota and provider availability remain unknown.
- No browser visual test was run.
- Migration `0015` has only been applied by the in-memory test fixture; remote D1 schema is unchanged and unverified.
- Worker and Wrangler configuration were not deployed. Existing Production settings and automatic-analysis behavior were not changed.
- This local increment is accepted by independent read-only review, but is not release/deployment approval.
