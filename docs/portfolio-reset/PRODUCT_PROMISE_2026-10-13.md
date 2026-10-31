# AI PM Radar — Product Promise (as of 2026-10-13)

## Original promise

AI PM Radar turns selected AI and business signals into useful, source-aware, risk-aware learning content for non-technical AI PM learners, NGO and education practitioners, and SME decision-makers. Its low-cost static publishing product has since expanded toward an evidence-first intelligence pipeline: public sources or manual intake → SourceRecord → enrichment → evidence review → human approval → reusable package for downstream products.

## Intended user journey

1. Collect from supported public feeds or manually paste a public-safe URL, text, or transcript.
2. Normalize while preserving canonical URL, source identity, time, original text, and provenance.
3. Enrich with deterministic rules or explicitly permitted AI; retain uncertainty and source evidence.
4. Review claims and evidence, then approve manually.
5. Export an immutable, provenance-linked package; downstream receipt is confirmed by the receiver, not by export alone.

## As-of 2026-10-13 Owner correction

The project guide reports Owner E2E FAIL: the owner cannot smoothly use auto-collect, manual import, or AI processing. This is current Owner Evidence and overrides older engineering PASS claims for the end-user journey. Do not rewrite the older test/release history.

## Promise status

| Promise / capability | Status | Evidence and gap |
|---|---|---|
| Static daily radar with source-aware articles | Partial | Existing static site and daily JSON workflow are documented; the current owner-used runtime and content freshness are not established by the latest acceptance record. |
| SourceRecord, evidence, provenance, and review foundation | Partial | Local modules and prior scoped tests/acceptance are documented; current Owner E2E is failing. |
| Manual URL/text/transcript intake | Blocked | Owner reports the real intake path is not smoothly usable; exact failing runtime and source are unknown. |
| Auto-collection and scheduled feed path | Blocked | Owner reports unusable path; deployed revision, adapter, schedule runtime, and logs are unknown. |
| Enrichment and human approval | Blocked | Owner reports AI processing path is not smoothly usable; no current owner-runtime trace confirms it. |
| Consumer handoff and receiver readback | Partial | Earlier isolated synthetic Content Ops receiver acceptance is recorded; that does not certify the current complete Owner journey. |
| Production/runtime version and provider state | Unknown | Current deployed revision, auth/region/model, persistence, and error logs are not verified. |
| Jev classification in the Radar workflow | Planned | Evaluation only; no SDK dependency or live call is present in the Jev Pilot. |

## Product gate

The core promise is not met until the owner-used runtime completes intake → preserved source/evidence → enrichment → human review → approved export → receiver-side readback. A passing unit suite or local module is supporting Engineering Evidence, not Owner acceptance.
