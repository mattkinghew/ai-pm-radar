# RADAR-PREF-DIGEST-TRAINER — preference-calibrated digest trainer

Status: **Partial** (2026-11-12 HKT). Local behavior is covered by 293 passing tests; sandbox networking prevented local smoke and visual UI acceptance. Owner preference calibration remains Partial until Matt trains real items and reviews the resulting order.

## Goal and acceptance criteria

- Primary outcome: explicit Owner thumbs and existing item actions change `/api/digest`, `/api/daily`, and `/api/library` ordering through an explainable read-time overlay. Stored `pref_score` and `LANE_RULES` stay fixed.
- Acceptance: owner-only trainer; source/category/keyword/title/tag weights and action log; digest hides dismissed/muted items, retains `ai_calls: 0` and at most three per lane; home feed uses the same overlay; minimal card controls and reasons; deterministic tests; local smoke where available.
- Non-goals: learned-ranking goal 03, AI reranking/tagging, collector changes, new dependencies, live D1/network calls, deployment, commit, push, or visual redesign.

## Baseline and scope

- Branch: `feat/cloudflare-cloud`, 11 commits ahead of `origin/feat/cloudflare-cloud`.
- HEAD before and after implementation: `febc572c4d5738af2e89b10ad380f153998e4d39`.
- Pre-existing untracked files left untouched: `AGENTS.md.bak-20261031`, `AGENTS.md.bak-20261111`, `README.md.bak-20261031`, `last-message.md`.
- Market scan reference: `~/Desktop/radar-market-scan-2026-11-12.md`, check date 2026-11-12 Asia/Hong_Kong. It is research context, not runtime acceptance.

## Changed files / diff

- `cloud/src/curation.mjs`: added `normalizeTrainTerm` and `feedbackOverlay`; `LANE_RULES` and `scoreLane` unchanged.
- `cloud/src/worker.mjs`: shared overlay on digest/daily/library, dismissed/muted digest filter, owner-only `GET/POST /api/trainer`, tag lookup and action logging.
- `cloud/public/app.js`: digest view within the existing daily screen, visible training reasons/weights, title-token thumbs and optional keyword entry on cards. Preserves API order on the home and library screens.
- `cloud/migrations/0011_trainer_actions.sql`: additive migration rebuilds `item_actions` to permit `train_up` and `train_down`, retaining existing rows and index. `feedback_weights` schema is reused.
- `tests/cloud-lanes.test.mjs`: synthetic ordering, stored-score, validation/auth, tag/title, action-log, AI-call, lane-cap and locked-weight assertions.
- `tests/helpers/cloud-fakes.mjs`: applies migration 0011 in the in-memory test database.
- This task packet.

Tracked diff before this packet: 5 files, 121 insertions, 20 deletions (`git diff --stat`); untracked migration and packet are not counted by Git diff. No other files were edited.

## Formula and trainer contract

`feedback_adj = clamp(sum(matched feedback_weights.weight), -2, 3)`. A match is the exact source key or `cat:{category}`, or a normalized `kw:{term}` / `tag:{term}` occurring in folded title, translated title, summary, or associated knowledge-base tags. Folding is NFKC, lowercase and collapsed whitespace, using the existing curation rule. `train_reasons` lists matched `{key, weight}` pairs in stable key order. Digest/daily/library order by `(stored pref_score + feedback_adj) DESC, created_at DESC`. Daily still applies the existing mute, dedup, quota and archive rules; archive eligibility still uses stored `pref_score < 0`.

`POST /api/trainer` accepts one `{item_id, scope: "keyword"|"title"|"tag", term, vote: "up"|"down"}` from an authenticated Owner. Title and tag scopes require a matching item title or associated tag; keyword requires a match in the item's title, summary or tags. Terms are folded, 2–80 code points, and reject control/markup/injection-suspect input. The route bumps `kw:` for title/keyword or `tag:` for tag by +0.4/−0.4, using the existing per-key clamp, and records `train_up`/`train_down` with `scope:term` in `item_actions.reason`. `GET /api/trainer` lists current source/category/keyword/tag weights. Existing action deltas were not changed. The trainer route does not call `summarize` or any AI provider.

## Verification evidence

| Command | Exit | Result |
|---|---:|---|
| `node --test tests/cloud-lanes.test.mjs tests/cloud-preference-calibration.test.mjs tests/cloud-worker.test.mjs tests/cloud-p0-curation.test.mjs` | 0 | 34/34 passed before the added library/tag assertions. |
| `npm test` | 0 | 293/293 passed, including gold order and all new trainer cases. |
| `node --check cloud/src/worker.mjs && node --check cloud/src/curation.mjs && node --check cloud/public/app.js && node --check tests/cloud-lanes.test.mjs && node --check tests/helpers/cloud-fakes.mjs` | 0 | All edited JS/MJS files parsed. |
| `git diff --check` | 0 | No whitespace errors in tracked changes. |
| `git rev-parse HEAD` | 0 | `febc572c4d5738af2e89b10ad380f153998e4d39`. |
| `npm run cloud:smoke` | 1 | **Unknown** smoke acceptance: export wrote 13 local rows, then Wrangler migration was blocked by sandbox `listen EPERM: operation not permitted 127.0.0.1` and log write `EPERM` at `~/.wrangler/logs/...`. No HTTP/UI gate ran. |

## Known failures and residual risks

- Smoke blocker: command `npm run cloud:smoke`; exact error `Error: listen EPERM: operation not permitted 127.0.0.1` plus `EPERM: operation not permitted, open '/Users/mattgor/.wrangler/logs/wrangler-2026-11-12_14-19-56_830.log'`. Files involved: `cloud/scripts/local-smoke.mjs`, Wrangler's local migration runtime and its log path (none edited). Attempted once; most likely sandbox loopback/log permissions. Smallest next action: Tom reruns `npm run cloud:smoke` on the Mac host.
- Visual card/digest interaction is **Unknown** in this sandbox because the local HTTP smoke did not start; Tom should inspect it during independent review. No real Owner trainer session or production/cloud acceptance was run.
- Migration 0011 was exercised by in-memory SQLite tests but not by Wrangler's local D1 migration runner in this sandbox. Production D1 was not touched.
- Static inspection found no edits to collectors or the local-resilience HTTP 403 handler, and no change to `LANE_RULES` weights; automated tests assert the locked weights. No commit, push, deploy, live fetch, or paid call was made.
