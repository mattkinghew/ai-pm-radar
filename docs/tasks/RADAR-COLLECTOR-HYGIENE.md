# RADAR-COLLECTOR-HYGIENE

Status: **Partial** (2026-11-12 HKT). Local code and mocked checks pass. Wrangler local smoke is Unknown because the sandbox blocked its listener and log path; Tom's independent Mac host rerun is pending.

## Goal and acceptance criteria

Primary outcome: RSS, YouTube official Atom, and GitHub Releases/Search reuse per-source HTTP `ETag` / `Last-Modified`, send `If-None-Match` / `If-Modified-Since`, and treat 304 as a successful no-new-items result.

Acceptance: mocked 200, 304, and missing-validator paths; unchanged local HTTP 403 stop with `http_403`, no later request, and byte-for-byte unchanged existing inbox; official AGENT_GOVERNANCE allowlist note; `node --check`, `npm test`, `npm run cloud:smoke`, and `git diff --check` recorded. Cloud timeout remains 10 seconds; collector concurrency remains six and new adapters remain capped at 30 per run.

Non-goals: HTML scraping, new feed guesses, new dependency, Pack 1 trainer changes, ranking weight or stored score rewrite, live ingestion, remote D1, deployment, commit, or push.

## Baseline and scope

- Branch: `feat/cloudflare-cloud`; HEAD before and after: `febc572c4d5738af2e89b10ad380f153998e4d39`.
- Pre-existing Pack 1 dirty files preserved: `cloud/public/app.js`, `cloud/src/curation.mjs`, `cloud/src/worker.mjs`, `tests/cloud-lanes.test.mjs`, `tests/helpers/cloud-fakes.mjs`, `cloud/migrations/0011_trainer_actions.sql`, `docs/tasks/RADAR-PREF-DIGEST-TRAINER.md`.
- Pre-existing untracked `AGENTS.md.bak-20261031`, `AGENTS.md.bak-20261111`, `README.md.bak-20261031`, and `last-message.md` remain untouched. No reset, clean, stash, staging, or commit.
- `scripts/source-fetch-helper.mjs` already supported conditional public-feed GET and 401/403 denial; it was not edited.

## Changed files / diff

- `cloud/src/collector.mjs`: D1-backed HTTP validator cache for built-in/user RSS, GitHub Search/Releases, and the existing YouTube Atom URL. The cached URL must match before validators are sent. 304 skips body parsing and produces no items.
- `scripts/daily_radar_collector.mjs`: local RSS validators persist inside the version-1 inbox after a successful run; 304 counts as a successful source check. A 403 still returns before writing the inbox.
- `cloud/migrations/0012_source_http_cache.sql`: additive per-source cache table; no remote migration was run.
- `tests/cloud-lanes.test.mjs`: mocked 200→304 across all four source kinds, no-validator behavior, and URL-change behavior. Existing Pack 1 assertions remain.
- `tests/daily-radar-collector.test.mjs`: mocked local 200→304 and a real local CLI invocation that exits 3 on 403 without changing inbox bytes.
- `tests/helpers/cloud-fakes.mjs`: applies migrations 0011 and 0012 in the in-memory fake; the 0011 entry belongs to the pre-existing Pack 1 changes.
- `docs/qa/RADAR_AGENT_GOVERNANCE_ALLOWLIST_2026-11-12.md`: records the supplied OWASP ASI and NIST AI RMF first-party URLs. No RSS/Atom feed for them was evidenced, so no source was seeded or scraped.
- This task packet.

Task-scoped tracked diff before this packet: 5 files, 198 insertions, 17 deletions (`git diff --stat -- cloud/src/collector.mjs scripts/daily_radar_collector.mjs tests/cloud-lanes.test.mjs tests/daily-radar-collector.test.mjs tests/helpers/cloud-fakes.mjs`). New migration and docs are untracked and absent from that Git stat.

## Verification evidence

| Command | Exit | Result |
|---|---:|---|
| `node --check cloud/src/collector.mjs && node --check scripts/daily_radar_collector.mjs && node --check tests/cloud-lanes.test.mjs && node --check tests/daily-radar-collector.test.mjs && node --check tests/helpers/cloud-fakes.mjs` | 0 | All edited JS/MJS files parsed. |
| `node --experimental-strip-types --test tests/daily-radar-collector.test.mjs tests/cloud-lanes.test.mjs tests/cloud-worker.test.mjs` | 0 | 34/34 passed, including conditional GET, cloud runDaily, locked weights, and local 403. |
| `npm test` | 0 | 295/295 passed after the final test edit. |
| `git diff --check` | 0 | No whitespace errors in tracked changes. |
| `git rev-parse HEAD` | 0 | `febc572c4d5738af2e89b10ad380f153998e4d39`. |
| `npm run cloud:smoke` | 1 | Local export wrote 13 rows to ignored `cloud/.import/import.sql`; Wrangler local D1 migration did not start. Smoke acceptance is Unknown. |

`LANE_RULES` numeric weights are covered by the unchanged locked-weight assertion in `tests/cloud-lanes.test.mjs`. No live GitHub/YouTube/OWASP/NIST fetch, paid API, remote D1 command, or deployment was run.

## Known failures and reviewer gate

- Failure: local smoke could not run. Command: `npm run cloud:smoke`. Exact errors: `Error: listen EPERM: operation not permitted 127.0.0.1` and `EPERM: operation not permitted, open '/Users/mattgor/.wrangler/logs/wrangler-2026-11-12_15-39-43_895.log'`. Files involved: `cloud/scripts/local-smoke.mjs`, Wrangler local runtime/log path, and additive migration `cloud/migrations/0012_source_http_cache.sql`. Attempted once; no retry because the sandbox permissions are unchanged. Most likely blocker: sandbox loopback and out-of-workspace log access. Smallest next action: Tom reruns `npm test` and `npm run cloud:smoke` independently on the Mac host and reviews this packet, diff, and evidence.
- D1 migration 0012 was applied by the in-memory SQLite test fake but not by Wrangler local D1. Production/Owner acceptance remains Unknown. No UI was changed, so no visual gate applied.
