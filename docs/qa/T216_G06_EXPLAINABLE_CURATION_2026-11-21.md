# T216 G06 — Explainable scoring and quarantine

Checked: 2026-11-21 (HKT)

## Scope and implementation

- Added migration `0017_explainable_curation.sql` with versioned score breakdown storage, independent `curation_status`, a recoverable quarantine, and an append-only release audit table. Existing rows without a lane or already marked as injection-suspect are backfilled into quarantine; rows are not deleted.
- Rule-derived dimensions are explicit: relevance (matched lane-rule weights scaled to 0–100), actionability (matched action rule IDs), promo/noise (only explicit negative-rule or injection flags), and novelty (unknown because the Worker has no corpus-wide novelty check). Missing evidence is represented as `unknown`; a matched zero-weight lane rule may produce an observed relevance score of 0 with its rule ID.
- The four-dimension coverage count is an observed-signal coverage indicator, not a probability or accuracy estimate. Items are quarantined when relevance is unknown, observed relevance is below 20, or an injection signal is present. Explicit release changes only curation visibility; editorial status, review status, claim status and approval remain unchanged.
- The normal daily and digest lists omit quarantined items. The quarantine view is recoverable through the daily UI/API, and the owner can explicitly release a record after a confirmation. Existing mute, not-interested, trainer and feedback-weight behavior remains available; matched feedback weights and keys are visible on cards.

## Synthetic fixture result

`tests/fixtures/g06-curation-marked.synthetic.json` contains five fictional cases: useful pricing signal, promotional/injection noise, a low-weight boundary item, relevant body with no supplied title, and an unrelated Traditional Chinese camera-settings note. The fixture exercises 2 `main` classifications and 3 `quarantine` classifications. This is a deterministic contract fixture, not an estimate of production precision, quarantine recall, or user relevance; population-level performance remains Unknown.

The Worker regression confirms that unknown relevance is not returned as numeric 0, quarantined items do not enter the normal daily list, all three quarantined items remain retrievable, explicit release is audited, and release leaves the sample as `draft` / `NEEDS_SOURCE_REVIEW` / `unverified`. No row is deleted.

## Verification and limits

- Final focused set (G06, P0 curation, lanes, preference calibration, ingestion contract, Worker, X, P1 reader, daily candidate builder and collector): `node --test ...` **103/103 passed**, exit 0.
- `npm run typecheck -- --incremental false`: exit 0. Changed JavaScript `node --check` commands and scoped `git diff --check`: exit 0.
- Full `npm test` was attempted twice before this final focused run and stopped on the same sandbox `listen EPERM` in the mobile production-server tests (353 passed, 5 blocked). Per the task stop rule, it was not repeated. `tests/cloud-g06-curation.test.mjs` is now included in `npm test`; its behavior and the related focused set were run directly above.
- Independent read-only review: **ACCEPT**. Reviewer confirmed quarantine recovery, unknown relevance represented as `null` at the API, candidate blocking, release without review/verification/approval changes, and dimension/feedback visibility. Reviewer reused the provided 103/103 and typecheck evidence; it did not rerun them.
- No live source ingestion, AI/model call, browser visual UAT, remote D1 migration, production deployment, or formal daily-data modification was performed.
- Migration `0017` has only been applied by the local in-memory test fixture. Production schema state remains Unknown.
