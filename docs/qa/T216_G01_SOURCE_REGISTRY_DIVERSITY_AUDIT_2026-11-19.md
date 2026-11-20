# T216 G01 — Source Registry and Diversity Fixture Audit

Checked: 2026-11-19 (HKT)

Scope: source type contract and browser-free synthetic coverage. No production D1, live fetch, or deployment was used.

## Registry correction

- Legacy X seed rows could contain `type='x'` while `adapter_type='rss'` because the adapter column was added later with an RSS default. Migration `0013_source_registry_type_contract.sql` rebuilds the source table without deleting rows and sets both fields to the canonical adapter. The migration includes a manual rollback mapping that retains `adapter_type`.
- New RSS, X, GitHub Search, GitHub Releases, and YouTube Channel rows store matching `type` and `adapter_type`. `userFeeds()` also keeps legacy X rows from being treated as RSS if a database has not yet applied the migration.
- X registration checks canonical duplicates, including prior rows with a legacy storage type. Source-health output continues to use the canonical source type.

## Synthetic topic hit table

All four hits below use the existing built-in RSS registry and configurable `LANE_RULES` signals. Responses are synthetic fixtures; they do not assert that these publishers actually published the example items.

| Topic | Synthetic fixture title | Assigned lane | Result |
|---|---|---|---|
| AI news | AI model release from a synthetic lab (`openai` built-in feed) | `TECH_NEWS` | Hit |
| Side-income monetization | Side hustle tests a productized service and pricing (`simonwillison` built-in feed) | `MONETIZATION_GAP` | Hit |
| One-person company | A solopreneur builds a one-person business workflow (`techcrunch-ai` built-in feed) | `APPLY_NOW` | Hit |
| Deals / free resources | Official free credits for a synthetic workshop (`coursera-ai` built-in feed) | `FREE_RESOURCE` | Hit |

The same fixture run also exercises synthetic GitHub Search and YouTube Channel adapters and creates a manual capture through the existing route. The X watchlist is loaded from migrations; the fetch spy confirms no `@handle` is requested as RSS.

## Evidence and limits

- Regression command: `node --test tests/cloud-source-registry.test.mjs tests/cloud-sources-x.test.mjs tests/cloud-lanes.test.mjs tests/cloud-worker.test.mjs` — 40 tests passed. The registry test covers RSS/X/GitHub/YouTube type equality on create and read.
- Full suite: `npm test` — 325 tests passed, 0 failed.
- Independent review: **ACCEPT** (read-only, 2026-11-20); reviewer compared only G01 changes against the G00 dirty-worktree baseline. Rollback was documented but not executed.
- The audit proves fixture capability and source-contract behavior only. It does not prove current production source distribution, successful live collection, or that real-world topic precision is adequate.
- No production files, D1 rows, schedules, or Cloudflare resources were changed.
