# T216 R2 — Source Registry & Collector Stability

Checked: 2026-11-21 (HKT)

## Local synthetic result

**PASS — collector failure isolation and idempotent intake contract.** A new `research-runner` regression fixture exercises five successful synthetic feeds alongside one feed timeout and one feed parse failure. It verifies one duplicate URL is merged, a redirected article keeps original and final URLs distinct, missing creator/publication date remain `null`, and a second run creates no duplicate article body fetches. All four unique article bodies remain captured; no AI request or approval is made.

Existing tests additionally cover disabled source behavior, feed ETag/304, source registry duplicate rejection, parser handling of RSS/Atom, HTTP 403 isolation in the daily collector, and review-gated candidate persistence. The per-source config stores recent success/failure state and error code; retry is bounded by the existing run/quota behavior.

## Verification

- `node --experimental-strip-types --test tests/research-runner.test.mjs` — exit 0, **7/7 passed** after correcting the fixture to disable analysis explicitly. The initial run failed because the fixture inherited analysis-on; no provider was called, and the corrected run passed.
- `node --experimental-strip-types --test tests/daily-radar-collector.test.mjs tests/source-feed.test.ts tests/cloud-source-registry.test.mjs tests/cloud-ingestion-contract.test.mjs` — exit 0, **24/24 passed** before the composite runner fixture was added.
- All collection fixtures used synthetic responses in temporary runtime directories. No public feed, provider, schedule, formal daily data or production service was accessed.

## Limit

The five-feed composite is an injected-service contract test, not a live network integration. Public source freshness and actual upstream availability remain Unknown. No source adapters or source count were expanded.
