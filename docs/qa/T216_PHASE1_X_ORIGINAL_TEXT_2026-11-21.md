# T216 Phase 1 — X Original Text Preservation

Checked: 2026-11-21 (HKT)

## Finding and change

The X ingest route derived its display title from post text, but stored only `raw_excerpt` truncated to 4,000 characters. The full supplied source text was therefore not recoverable from the controlled item record.

- Added nullable `items.original_text` in migration `0018_x_original_text.sql`.
- X ingestion stores the exact accepted input text in `original_text`; title derivation and the bounded `raw_excerpt` continue to use collapsed display text.
- Inputs over 20,000 characters are rejected per row rather than silently stored as a truncated original.
- Owner item detail responses expose the field; list endpoints omit it to avoid returning every full post with the card list. Opening the collapsed “X 完整原文（未改寫）” section fetches the single record and renders its text as text content, including when AI summary fields exist.
- Existing `external_id=x:<post_id>`, source URL, handle, and published timestamp behavior remains in place. No potential duplicate is deleted by this change.

## Verification

- `node --test tests/cloud-sources-x.test.mjs tests/cloud-ingestion-contract.test.mjs tests/cloud-d1-schema.test.mjs tests/cloud-worker.test.mjs` — exit 0, **54/54 passed**.
- Coverage proves verbatim multi-paragraph text longer than 4,000 characters survives storage and owner readback, bounded excerpt remains separate, and over-limit rows are rejected without partial records.
- `npm run typecheck -- --incremental false` — exit 0.
- `node --check` on the changed Worker, UI, and tests; scoped `git diff --check` — exit 0.
- Current package suite excluding only the sandbox-blocked `tests/mobile-production-server.test.mjs` — exit 0, **362/362 passed**.

## Independent review

**ACCEPT** — read-only review of this original-text increment. Reviewer confirmed verbatim storage, bounded excerpts and list payloads, stable X identity, owner-only detail retrieval, safe text rendering, and over-limit rejection. No files were edited by the reviewer.

## Limits

- This closes the original-text truncation gap only; it does not certify every Phase 1 acceptance item or overall Engineering RC.
- Migration 0018 has not been applied to Production. Existing records remain `original_text = NULL` unless their complete original is independently available; this patch does not reconstruct historical text from excerpts.
- No deployment, remote D1 change, live X fetch, model call, or browser visual test was performed.
