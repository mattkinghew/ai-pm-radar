# 03 — Learned ranking from actions

## Goal
Replace the hand-tuned weight bumps (source / `cat:` keys in `feedback_weights`) with a small, explainable model trained from `item_actions` + review statuses, improving the home-feed order and the "推薦給你" picks.

## Context
- Signals: `item_actions(action in star|unstar|read_later|unread_later|not_interested|restore, reason)`, `items.status` (approved/rejected), `mutes`.
- Current rank SQL: `RANK` in `cloud/src/worker.mjs` = score + source weight + category weight.
- Features available: source, category, handle, score, reco_score, side_income_new, title tokens (keywords), dup_count.

## Scope
- Nightly (inside `runDaily`) compute per-feature weights with a regularized logistic regression or Beta-smoothed CTR in plain JS (no deps); store in `feedback_weights` with key prefixes `src:`, `cat:`, `kw:`; keep clamp [-2,3].
- `score_explain` field in `/api/daily` items (top 3 contributing features, 繁中).
- Reason-aware: `too_much_x` lowers X share target (bounded 15–30%), `duplicate` tightens SimHash distance.

## Acceptance Criteria
Deterministic unit tests on synthetic action logs; offline replay script `node cloud/scripts/replay-ranking.mjs` showing precision@10 vs current; `npm test` + `npm run cloud:smoke` green.

## Non-goals
LLM-based reranking, embeddings (goal 01), UI redesign.

## Verification
`npm test && npm run cloud:smoke`

## Constraints
No deploy, no remote D1, no push.
