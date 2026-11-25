# T216 R1 — Approval Integrity & Data Security

Checked: 2026-11-21 (HKT)

## Review result

**PASS — local synthetic approval gates.** No implementation bypass was reproduced. The code binds content and evidence to deterministic source fingerprints; editing a material source revision clears review and both typed approvals. Cloud creation strips incoming review/approval state. Daily candidate generation requires current reviewed + explicitly approved state and complete source/evidence/enrichment. Source reuse and daily approval remain separate scopes.

The secure downstream path additionally binds SourceRecord, approved handoff and immutable package snapshots with SHA-256 seals. Legacy handoffs/packages remain readable but cannot pass secure export until a new approval/seal is created. Receiver dispatch tests reject unapproved, stale, changed, wrong-Brand and incomplete candidates; `import_confirmed` requires a source/Brand-bound receiver readback.

## Security matrix evidence

- Body/source change invalidates approval; title and evidence changes now have explicit regression coverage in `tests/cloud-sync-contract.test.ts`.
- Cross-record approval/revision reuse is rejected by source ID binding in the cloud state contract.
- Non-verbatim evidence cannot be reviewed; missing/invalid evidence blocks candidate and cloud approval paths.
- Cloud revision compare-and-swap rejects stale writes; changed revisions clear review, daily approval and reuse approval.
- Import/migration preflight does not transfer global legacy draft approvals to a cloud upload. Legacy handoff approval is reset to `needs_review`; sealed restore is checked against the restored source and package.
- Dispatch tests verify human approval, freshness, target Brand and receiver receipt boundaries; a local export or dispatch response alone does not mark `import_confirmed`.

## Verification

- `node --experimental-strip-types --test tests/cloud-sync-contract.test.ts tests/approval-integrity.test.ts tests/daily-candidate.test.ts tests/secure-handoff-delivery.test.ts tests/cloud-source-gateway.test.mjs tests/content-ops-dispatch.test.mjs` — exit 0, **43/43 passed**.
- `npm run typecheck` — exit 0.
- Tests used synthetic records and in-memory fixtures. No production D1, Access policy, Receiver, external dispatch, or formal daily data was accessed or changed.

## Limit

The SHA-256 values are integrity/staleness checks, not proof of reviewer identity; `lib/secure-handoff-delivery.ts` states this explicitly. Authenticating a human approval event would require a trusted server-side identity/audit boundary and is not established by local browser data or these tests. This is not evidence of production deployment or production approval state.
