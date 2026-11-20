# T216 G02 — Ingestion Contract, Title Provenance, Status, and Duplicate Paragraphs

Checked: 2026-11-20 (HKT)

## Scope and baseline

This is a local, synthetic, browser-free implementation and verification. The pre-existing dirty worktree recorded in the G00 baseline was preserved. No production D1, live source fetch, model call, browser UAT, deployment, or daily JSON was used or changed.

## Implemented contract

- Added nullable `title_source` provenance to items and reader articles, constrained to `feed`, `og`, `page`, `x_text_truncation`, `user`, `synthesized`, and `inferred`. Existing non-X rows remain NULL when their historical title provenance cannot be established; legacy X rows are backfilled from existing X identity fields.
- RSS items with a URL but no feed title remain ingestible. The first excerpt line is labeled `inferred`; a URL placeholder is labeled `synthesized`. Feed and official API titles record `feed` or `page`; reader extraction distinguishes Open Graph from `<title>` metadata.
- X text-derived titles are recorded as `x_text_truncation`. Manual user-entered titles, excerpt-derived titles, and URL placeholders have separate provenance labels.
- Repeated, consecutive paragraph text is collapsed in RSS excerpts, X ingestion, manual capture, and inbox import. The returned item shape also applies the same display cleanup to stored excerpts. The source’s semantic text is otherwise left intact.
- Cards now label editorial state and content-review state separately. The action reads `標記為已審核`; star and read-later remain independent actions. Canonical URL dedupe stays in place and has regression coverage.
- Capture article history and existing compare-and-swap writes remain in use. Migration `0014_item_title_source.sql` must be applied before deploying this code; it has not been applied to production.

## Regression evidence

- `node --test tests/cloud-ingestion-contract.test.mjs tests/cloud-worker.test.mjs tests/cloud-p1-reader.test.mjs tests/cloud-lanes.test.mjs tests/cloud-source-registry.test.mjs` — 62/62 passed before final reader-title additions.
- `node --test tests/cloud-ingestion-contract.test.mjs tests/cloud-p1-reader.test.mjs tests/cloud-worker.test.mjs` — 47/47 passed after reader-title storage changes.
- Final `npm test` — 333/333 passed.
- `npm run typecheck -- --incremental false` — exit 0.
- `node --check` on the changed Worker, collector, curation, reader, P1 route, UI and regression test — exit 0.
- Scoped `git diff --check` plus whitespace check of the new migration — exit 0.

The tests cover URL retention for title-less RSS, inferred/feed/X/user/synthesized/OG/page provenance, paragraph collapse across the covered input routes, API item shape, separate UI status labels/action wording, and canonical URL dedupe. The fixtures are synthetic and do not establish current production content quality or state.

## Independent review

**ACCEPT — local G02 increment (read-only review, 2026-11-20).** The reviewer confirmed the title provenance and migration contract, missing-title URL retention, distinct editorial/content status labels, consecutive paragraph cleanup, canonical URL dedupe, T209/capture-history compatibility, and SQL binding/migration order. The reviewer did not inspect or deploy production D1; production remains Unknown. Card copy was checked by source-string assertions, not browser visual UAT.

## Limits

- Production migration and UI deployment are not performed or authorized by G02; production behavior remains Unknown.
- No visual or real-device UI validation was performed.
- Titles with historical provenance that cannot be proven are intentionally marked `未記錄`, not guessed.
