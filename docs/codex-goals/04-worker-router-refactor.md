# 04 — Worker router refactor

## Goal
Split `cloud/src/worker.mjs` (single `handle()` with regex routes) into route modules (`routes/items.mjs`, `routes/kb.mjs`, `routes/sources.mjs`, `routes/mutes.mjs`, `routes/ingest.mjs`) with a tiny table-driven router, without behaviour change.

## Context
Auth order must stay: bearer path first (only `POST /api/ingest/x`, `GET /api/sources`), never falling through; then Access JWT owner check; then static assets.

## Scope
Pure refactor + shared `json()`/`shape()` helpers; keep exported `handle(request, env, deps)` signature used by tests.

## Acceptance Criteria
All existing tests unchanged and passing (`tests/cloud-worker.test.mjs`, `tests/cloud-sources-x.test.mjs`, `tests/cloud-p0-curation.test.mjs`, full `npm test`); `npm run cloud:smoke` PASS; dry-run bundle size not larger than +10%.

## Non-goals
New features, framework adoption (Hono etc.) unless zero-dep size is worse.

## Verification
`npm test && npm run cloud:smoke && (cd cloud && npx wrangler deploy --dry-run --outdir /tmp/radar-dry)`

## Constraints
No deploy, no push, no remote D1.
