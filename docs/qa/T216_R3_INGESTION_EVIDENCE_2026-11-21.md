# T216 R3 — Universal Ingestor & Evidence Provenance

Checked: 2026-11-21 (HKT)

## Contract audit

**PASS for implemented local text/transcript paths; unsupported formats remain unclaimed.** Paste Text, URL metadata/manual fallback, Markdown/TXT text, and SRT/VTT parsing are handled by the existing SourceRecord normalizer and subtitle parser. Timestamped transcript evidence is retained. `lib/universal-ingestor.ts` currently provides timestamped transcript chunks and Markdown/book chapter chunks; this does not establish PDF ingestion or arbitrary YouTube transcript acquisition.

AI evidence is checked against the captured source snapshot. Only exact text or the documented whitespace/newline normalization is accepted; translated, case-altered or invented quotes fail. Snapshot mismatch prevents stale analysis from applying. New analyses remain `needs_review`, `not_approved`, and not verified. Daily candidate and cloud review paths require evidence before approval.

## Verification

- `node --experimental-strip-types --test tests/universal-ingestor.test.ts tests/source-inbox.test.ts tests/cloud-sync-contract.test.ts tests/daily-candidate.test.ts` — exit 0, **47/47 passed**.
- Coverage includes SRT/VTT timestamps, Markdown chapter/page locators, empty/invalid input fallback, evidence mismatch, whitespace-only evidence normalization with source span retention, stale snapshot rejection, and review/approval remaining unset after analysis.
- Synthetic content only; no provider call, external source, or formal daily JSON write.

## Limits

PDF ingestion and automatic YouTube transcript retrieval are not verified as supported by the inspected code/tests. No claim is made for formats beyond the current normalizer, subtitle parser and explicit chunking utilities.
