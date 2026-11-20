# RADAR-DAILY-REVIVE handoff

## 1. Task, goal, acceptance, non-goals

- TASK-ID: RADAR-DAILY-REVIVE. Executor: Codex. Baseline: `feat/cloudflare-cloud` at `a24cc8d`; pre-existing dirty worktree preserved.
- Goal: `npm run daily:real` collects public RSS/HN and creates one HKT-dated, schema-valid real-source **draft** in `data/daily/`, if at least three eligible same-day candidates exist.
- Acceptance: real-source filter; injection-suspect held list; canonical URL dedupe; default top 10 by stored `pref_score` then recency; `draft` / `needs_review` / source URL / generator; atomic no-overwrite; fewer than three returns non-zero; both validators pass on a temp fixture; full tests and diff check pass. Live collection is a separate host gate.
- Non-goals: deployment, remote D1, production writes, launchd installation/loading, paid API, X ingestion, scrapers, routing-weight or stored-score changes, commit or push. No new dependency.

## 2. Changed files / diff

- `scripts/daily-from-inbox.mjs`: reads the existing inbox; takes only recognized public collector sources discovered on the current HKT date; ranks, deduplicates, and writes a draft with exclusive `wx` creation.
- `tests/daily-from-inbox.test.mjs`: HKT boundary, candidate filtering/ranking, held items, validators in a temporary directory, shortage and no-overwrite cases.
- `package.json`: `daily:real` alias and inclusion of the new test in `npm test`.
- `docs/ops/DAILY_UPDATE_WITHOUT_GROK_BOT.md`: operator command and draft/publication boundary.
- This packet. Scoped change size: new script 102 lines, new test 77 lines, runbook +14 lines, package script change +2/-1 lines. Global `git diff --stat` also shows the two untouched, pre-existing dispatch edits.

## 3. Verification evidence

- `node --experimental-strip-types --test tests/daily-from-inbox.test.mjs` → exit 0; 4/4 pass. Its test invokes both `scripts/validate-daily-json.mjs` and `scripts/validate_daily_data.mjs` on a builder-created temporary fixture, each exit 0.
- `npm test` → exit 0; 302/302 pass.
- `npm run typecheck` → exit 0.
- `npm run validate:daily` → exit 0; existing tree: 3 files / 13 articles.
- `npm run validate:data` → exit 0; existing tree: 3 files / 13 articles, no warnings or errors.
- `git diff --check` → exit 0; no whitespace errors in tracked changes. New files were also checked with `git diff --no-index --check /dev/null <file>`; no whitespace diagnostics (that command returns 1 because the new files differ from `/dev/null`).
- Live `npm run daily:real` → **Unknown**; host will run after handoff. No current-date daily, network request, or production write was made here.

## 4. Research LaunchAgent EX_CONFIG diagnosis

- Read-only checks: `plutil -lint ~/Library/LaunchAgents/com.ai-pm-radar.research.plist` → exit 0 (`OK`); `/usr/local/bin/node --version` and a direct strip-types startup → exit 0; `launchctl print gui/$(id -u)/com.ai-pm-radar.research` shows 1,022 runs, `last exit code = 78: EX_CONFIG`, and `state = not running`.
- The plist targets `scripts/research-runner.mjs --scheduled` every 300 seconds and writes stdout/stderr to `.runtime/research/runner.log`. That log ends with 2026-11-01 probe markers and contains no corresponding EX_CONFIG error line. The runner's own catch path sets exit code 1, so the observed 78 cannot be attributed to that catch from available evidence.
- Confirmed configuration gap: `.runtime/research/config.json` reports `schedule.enabled=false`. This means the research schedule is intentionally off. The root cause of launchd's **78** itself remains **Unknown** because neither the log nor the inspected plist records the failing launch step. Do not claim the disabled schedule caused 78.
- Minimal fix for the **daily draft gap**: use `npm run daily:real` manually; no research plist change is required. For the **research scheduling gap**, the exact configuration change would be `.runtime/research/config.json` → `schedule.enabled: false` to `true`, but analysis is also enabled there, so this change remains **Planned** and requires separate Owner approval before any scheduled run. It has not been made. No exact plist repair for EX_CONFIG can be responsibly specified until its launch error is captured; a read-only diagnostic session is the smallest next decision. No plist was edited or loaded.

## 5. Status and known failures

- Status: **Partial** until the host completes a live collection and confirms a new current-date real draft. The local implementation and fixture checks are complete.
- Known gap: public sources may provide fewer than three eligible same-day items; the command deliberately exits non-zero and leaves the daily absent. A 403 retains the collector's existing fail-closed behavior. Schema validity is not editorial approval or evidence of factual accuracy.
- Same-failure-twice stop rule: no repeated implementation failure observed; one patch-context mismatch while adding tests was corrected before verification.
