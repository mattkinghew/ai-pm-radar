# 01 — Event clustering (embeddings + Vectorize)

## Goal
Group items covering the same real-world event (e.g. a model launch reported by OpenAI RSS, Verge, 3 X posts) into one "event card" on the home feed, beyond what URL-normalization + title SimHash (P0) catch.

## Context
- Worker: `cloud/src/worker.mjs` (`/api/daily` → `dedup()` + `applyQuotas()` from `cloud/src/curation.mjs`).
- Collector: `cloud/src/collector.mjs` (`runDaily`, `analyzePending`); cron 00:00 UTC.
- Schema: `items` (0001–0007; `url_norm`, `starred`, `read_later`, `dismissed_reason`), `feedback_weights`, `item_actions`, `mutes`, `kb_entries`.
- Bindings: `DB` (D1), `AI` (Workers AI). Free tier budget: Workers AI 10k neurons/day shared with summaries (`WORKERS_AI_DAILY_CAP=100`).

## Scope
1. Migration `0008_events.sql`: `events(id, run_date, title, centroid_item_id, size, created_at)`, `items.event_id`.
2. In `runDaily` after analysis: embed `title_zh||title + summary` with `@cf/baai/bge-m3` (multilingual; confirm current model id in Cloudflare docs) — batch, capped by a new `EMBED_DAILY_CAP` var; count usage in `ai_usage`-style table.
3. Cluster: Vectorize index (`wrangler.toml` binding `VEC`, config only) OR in-Worker cosine over the day's ≤200 vectors if Vectorize is not yet created. Threshold configurable (`EVENT_SIM=0.85`).
4. `/api/daily` returns one representative per event with `event: {id,size,sources[]}`; UI shows「N 個來源」expandable.
5. Fallback: if AI binding missing/cap reached, current SimHash path unchanged.

## Acceptance Criteria
- Unit tests with mocked `env.AI.run` returning fixed vectors: 3 near vectors → 1 event; distinct → separate.
- Cap respected; no embedding calls when `AI_ANALYSIS_ENABLED=false`.
- `npm test`, `npm run cloud:smoke` pass; `wrangler deploy --dry-run` succeeds.

## Non-goals
Creating the Vectorize index remotely (write the exact `wrangler vectorize create ...` command in the PR notes for Matt), cross-day event tracking, UI redesign.

## Verification
```
npm test
npm run cloud:smoke
cd cloud && npx wrangler deploy --dry-run --outdir /tmp/radar-dry
```

## Constraints
No deploy, no remote migrations, no push, no Vectorize/index creation on the account.
