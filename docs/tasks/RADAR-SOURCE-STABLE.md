Status: Planned (goals written 2026-11-15 16:13 HKT by Tom; Codex line will update)

# RADAR-SOURCE-STABLE (repo: ~/Documents/Daily/ai-pm-radar, branch feat/cloudflare-cloud, HEAD a24cc8d; dirty: 4 modified + 9 untracked incl. RADAR-DAILY-REVIVE / RADAR-DISPATCH-RECEIVER-URL — preserve)

Approved by Matt 2026-11-15 16:06 HKT (follow recommended order, step 1). Line B pack 1 of 4.

Primary outcome: `npm run daily:real` no longer fails the whole day because one source is broken (403/404/timeout) as long as ≥3 eligible candidates remain from other sources; every skipped source is listed with reason in a run log; Anthropic 404 resolved by using an OFFICIAL current feed if one exists, otherwise the source is explicitly disabled with a dated reason (never a guessed or third-party URL).
Non-goals: scrapers, HTML parsing of news pages, third-party feed mirrors (RSSHub, feedburner proxies, etc.), paid APIs, X ingestion, editing `cloud/` (Cloudflare Worker — record parity as Planned), launchd plists (`com.lamlab.radar.daily-local`, `com.ai-pm-radar.research` — do not touch), auto-publish, Content Ops dispatch.
Side effects: host chain will run a live `npm run daily:real` after you finish (Matt approved retrying today's collection); it may write today's daily under data/daily.

## 1. 目標檔案 Target files (verified 2026-11-15)
- scripts/daily_radar_collector.mjs (SOURCES list lines ~10–11; `process.exitCode = 3` at ~line 129)
- scripts/daily-from-inbox.mjs (untracked, preserve), tests/daily-from-inbox.test.mjs
- tests/daily-radar-collector.test.mjs
- package.json `test` script (only to add a new test file if you create one)
- docs/ops/DAILY_UPDATE_WITHOUT_GROK_BOT.md (already modified — append a section only)
- NEW docs/tasks/RADAR-SOURCE-STABLE.md (task packet + evidence, follow docs/tasks/RADAR-DAILY-REVIVE.md format)
- NEW config/source-skip-list.json (or a clearly named constant in the collector if a config dir is inappropriate — state which)
- Read-only: cloud/src/collector.mjs (same SOURCES), scripts/source-fetch-helper.mjs, AGENTS.md

## 2. 上下文與依賴 Context and dependencies
- Today 11:54 HKT host run: `daily:real` exit 3 — TechCrunch 403, Anthropic 404; inbox unchanged; no 2026-11-15 daily. Last real daily 2026-07-02.
- Probe from the Mac at ~16:15 HKT (VPN exit FR, Marseille): `https://www.anthropic.com/news/rss.xml`, `/rss.xml`, `/news/feed`, `/feed.xml` all HTTP 404; `https://www.anthropic.com/news` HTML has no `<link rel=alternate type=rss/atom>`; `https://techcrunch.com/category/artificial-intelligence/feed/` HTTP 200 application/rss+xml. So TechCrunch 403 was egress-dependent.
- Current rule: fewer than 3 candidates → non-zero exit (fail-closed). Keep that rule.
- Network in your sandbox may be unavailable; if you cannot fetch, do not guess — mark the Anthropic official-feed question Unknown and disable it with reason.

## 3. 具體需求與演算法 Requirements and algorithm
1. Per-source result object `{id, url, status: ok|http_error|timeout|parse_error|disabled, http_status?, items, reason}`; one failing source never throws out of the loop.
2. Explicit skip list (`config/source-skip-list.json`): `{id, reason, since, review_by}`; Anthropic entry `reason: "official RSS endpoints 404 on 2026-11-15; no official feed link on anthropic.com/news"` unless you find an official anthropic.com-hosted feed (cite the anthropic.com page that links it). Disabled sources are reported, not fetched.
3. Decision: eligible candidates ≥3 → exit 0 and write daily even if some sources failed; <3 → keep exit 3 (fail-closed), write no daily, and still write the run log. Document this in the task packet + ops doc ("fail-closed at day level, fail-soft at source level").
4. Run log: one JSON per run under the existing data/run-log location if one exists, else `data/runs/<date>-collector.json` (git-ignored check: if not ignored, put it under an already-ignored dir and say so); include per-source results, counts, exit decision. No secrets/headers/cookies.
5. New sources only from official feeds you can cite; none required. If you add one, it must be an official RSS/Atom URL published by that organisation.
6. Tests: one source 403 + others ≥3 items → exit 0, log lists the 403; all-but-2 fail → exit 3 + no daily; disabled source not fetched; skip-list schema validation; existing 302 tests still pass.

## 4. 限制與邊界 Constraints and boundaries
- Do not edit cloud/ or launchd plists; do not lower the 3-candidate threshold; no scraping; no new dependency. Plus Global constraints below.

## 5. 驗證標準 Verification
- `npm test` exit 0 with new tests counted (>302). `npm run validate:daily` exit 0. `git diff --check` exit 0.
- Live `npm run daily:real`: run it if network works in your sandbox and record exit + per-source summary; otherwise Unknown (the host chain reruns it).
- Task packet `docs/tasks/RADAR-SOURCE-STABLE.md` ends with `Status: <word>` line, evidence list, Unknowns (EX_CONFIG 78 stays Unknown/out of scope).

## 全域限制 Global constraints (apply to this whole pack)
- Git: NO commit, push, merge, rebase, reset, stash, checkout, restore, clean, or branch switch. Never discard or overwrite other people's dirty/untracked work; edit on top of it. Matt gives OK COMMIT separately.
- Remote: NO deploy. NO Vercel / Cloudflare (wrangler) / Supabase / Buffer / GitHub mutations. NO Tailscale Serve/Funnel changes. NO posting anywhere.
- Secrets: never open, read, cat, grep, or print `private_vault/` or any `.env*` file. Never print tokens, cookies, API keys, secret files, or hashes (including Navide owner-token hash). Generated ephemeral secrets stay in git-ignored runtime dirs and are never echoed.
- Processes: do not kill or restart anything on ports 4175, 3002, 3003, 4176. If a port you need is busy, do not kill it; record Blocked.
- Paths off-limits: TeraCLOUD `/Volumes/dav`; `20_Areas/25_Self_Management` (never open); `~/Documents/AI system project` (company clean-room — do not read, copy, or index into any personal artefact).
- Quality gates: no baseline replacement (KUMA_ART_FREEZE_BASELINE forbidden, no snapshot/golden refresh), no threshold loosening, no deleting/skipping tests to get green.
- Dependencies: NO new npm/pip/brew dependency or global tool without Matt's approval (ccusage explicitly NOT allowed).
- Budget: max 2 implementation rounds; 0 unrelated files changed; max 3 visual iterations.
- Stop rule: the same error twice = write `Status: Blocked` plus the exact error and command in the evidence file, then stop.
- Status words only: Completed / Partial / Blocked / Unknown / Planned. Any check you did not actually run = Unknown. Do not invent numbers, citations, or paths.
- Side effects allowed: only file edits inside this repo's listed target files/dirs, git-ignored runtime dirs, and test temp dirs.
- Final message (short): `Pack status: <word>`, files changed, commands run with exit codes, test counts, Unknowns, anything for Matt to decide.

## Execution handoff — 2026-11-15

- TASK-ID: RADAR-SOURCE-STABLE. Goal: a failed public source cannot veto a same-day draft when at least three eligible candidates arrive from other sources. One executor; no reviewer edits.
- Acceptance: per-source result and reason, explicit disabled-source configuration, ≥3 day gate, ignored JSON run log for both decisions, no daily below the threshold, existing tests green. Non-goals remain as stated above.
- Changed files: `scripts/daily_radar_collector.mjs` (source isolation, timeout, result and run log); `scripts/daily-from-inbox.mjs` (shared eligibility selection, exit 3 on shortage); `tests/daily-radar-collector.test.mjs` (403 success, shortage, disabled source and schema tests); `config/source-skip-list.json` (dated Anthropic entry); `docs/ops/DAILY_UPDATE_WITHOUT_GROK_BOT.md` (append-only operator note); this packet. `package.json` and other pre-existing changes preserved.
- Config choice: `config/source-skip-list.json`; `.runtime/collector-runs/` is already ignored by `.gitignore`. Each run uses a timestamp and process ID in the filename. Log fields are source ID/URL, status, optional HTTP status, accepted item count, reason, counts, and exit decision; no headers, cookies, response bodies, or secrets.
- Decision: fail-closed at day level, fail-soft at source level. Current-run eligible unique candidates ≥3 permits inbox update and `daily:real` builder; fewer than 3 exits 3, leaves inbox and daily untouched, and still writes a log. Existing daily remains protected by exclusive creation.
- `cloud/src/collector.mjs` parity: Planned; no Worker file changed. `EX_CONFIG` exit 78 diagnosis: Unknown and out of scope.

## Verification evidence

- `node --experimental-strip-types --test tests/daily-radar-collector.test.mjs tests/daily-from-inbox.test.mjs` → exit 0, 11/11 pass.
- `npm test` → exit 0, 304/304 pass (baseline 302).
- `npm run validate:daily` → exit 0, 3 files / 13 articles.
- `git diff --check` → exit 0.
- `git check-ignore -v .runtime/collector-runs/example.json` → exit 0; `.gitignore:4` ignores `.runtime/`.
- `curl -I --max-time 8 -sS -o /dev/null -w '%{http_code}\\n' https://openai.com/news/rss.xml` → exit 6, `Could not resolve host: openai.com`; live `npm run daily:real` was not run here. Host replay and today's daily are Unknown.
- Anthropic: Matt's 2026-11-15 Mac probe found four official URL candidates returning 404 and no alternate feed link on `/news`; a current official feed elsewhere remains Unknown. The source is disabled pending review, without a guessed replacement.
- After the final date-validation edit, `node --experimental-strip-types --test tests/daily-radar-collector.test.mjs tests/daily-from-inbox.test.mjs` → exit 0, 11/11 pass; `git diff --check` → exit 0.
- Final `npm test` → exit 1, 299 pass / 5 fail / 304 total. Five tests in `tests/mobile-production-server.test.mjs` each returned `Error: listen EPERM: operation not permitted 127.0.0.1`. Full output: `/private/tmp/radar-source-stable-npm-test.log`. The earlier full run passed 304/304 before the final strict-date validation edit; final full-suite status is therefore failed, not passed.

## Known failures and Unknowns

- Live sources, same-day candidate count, and host daily output: Unknown because this sandbox cannot resolve the feed host.
- Official Anthropic feed existence beyond the checked endpoints: Unknown. Cloud parity: Planned. Research LaunchAgent EX_CONFIG 78: Unknown/out of scope.
- Failure: five repeated loopback bind errors in one final full-suite run. Command: `npm test`. Exact error: `Error: listen EPERM: operation not permitted 127.0.0.1`. Files involved: `tests/mobile-production-server.test.mjs` (unchanged), `/private/tmp/radar-source-stable-npm-test.log`; no source-stability code path appears in those failures. Attempted: one earlier full run (304/304), then final full run (299/304), then focused tests (11/11). Most likely blocker: sandbox loopback listen permission. Smallest next decision: rerun `npm test` on the authorized host with loopback binding available; do not weaken or skip the tests. Stop rule applies after the repeated `listen EPERM` errors.

Status: Blocked
