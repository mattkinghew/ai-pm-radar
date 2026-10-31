# Backup, Recovery and Rollback — Phase 2.0A

## Current evidence and limits

- The existing synthetic pilot requires a full JSON fixture download, re-selection and exact SHA check before create/update. The local browser E2E verified this path.
- This is a client-side precondition, not a server-verified backup location. It does not prove that a file is recoverable after device loss.
- No D1 export/import restore, point-in-time restore, or production data rollback was run in this audit. D1 Time Travel may retain deleted data according to the account's current policy; its current behavior was not checked.
- The pilot has a seven-day active TTL; edits do not extend it. Deleting a row may not erase platform backup snapshots.
- No production D1 schema or data was changed; no rollback action is required for this audit.

## Safe procedure for a future synthetic cloud test

1. Read current Owner-scoped list and confirm the exact fixture ID is absent. Do not overwrite an existing record.
2. Save the fixture JSON locally and verify its SHA before create.
3. Record the server-confirmed source ID, revision, hash and expiry without capturing Access tokens or source secrets.
4. Verify readback from a second authenticated context before any edit.
5. On failure, stop writes. Re-read current revision; never replay a stale update. Use the downloaded JSON only for manual comparison; do not upload it to any other service.
6. If cleanup is explicitly authorized, delete only the just-created synthetic fixture with its current expected revision and exact ID; then verify active rows are absent. State that backup residual may remain.

## Rollback boundary

For a local test, the harness uses in-memory SQLite and closes it at process exit. For a deployed synthetic pilot, do not run a dark-profile deployment or alter D1/Access as an improvised rollback. Stop and request a scoped Owner decision if the remote state differs from the expected fixture-only state. Production Origin/Tunnel remain untouched by this phase.
