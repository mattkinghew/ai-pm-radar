# Device Acceptance — Phase 2.0A

## Completed synthetic browser evidence

Fresh run: `node experiments/phase15-source-sync/test-cross-device-browser-local.mjs`.

- Two separate Chromium contexts (desktop 1280px and phone-sized 390px) exercised the actual pilot Worker/UI against a local in-memory SQLite binding. Access identity was injected by the harness; this is not Cloudflare Access authentication.
- An unauthenticated request and a wrong identity were rejected before UI/API data was served.
- A fixed synthetic record was downloaded, reselected and SHA-verified before the first context created it; the record was read back from the local DB at revision 1 with `needs_review` / `not_approved`.
- A second independent context loaded the same record, changed the allowlisted summary to revision 2, and persisted it. The stale first context received 409 and did not overwrite data; refresh retrieved revision 2 and immutable history.
- A second fixture was removed only by explicit confirmation; the first fixture remained. Widths 390, 768 and 1280 had no horizontal overflow; browser requests stayed same-origin and no page exceptions occurred.

This proves local UI-to-Worker-to-SQLite behavior only. It does not prove a deployed D1 write, cross-device network read, current Access application/policy, server persistence after runtime restart, or mobile network operation.

## Pending Owner acceptance

1. Owner signs in directly through the existing Cloudflare Access flow for the synthetic preview; do not provide credentials to Codex. This run reached the Dashboard `/login` page, so no authenticated identity was available.
2. Confirm the fixed synthetic fixture list and current remote list. If the target synthetic ID already exists, do not overwrite or delete it; stop and reconcile.
3. Verify the pilot explicitly reports `SYNTHETIC ONLY`; download/reselect the fixture backup and verify SHA before one create.
4. Hard reload, then use a separate authenticated browser/device session to read back the same record and revision. Confirm URL/body/metadata are exact and review/approval remain false.
5. Retry create once only; expect a duplicate/conflict response and exactly one active row. Re-read rather than retrying blindly.
6. Verify update from second session and stale revision conflict from first. Remove only the newly created synthetic fixture after saving its receipt and confirming its ID/revision; verify the unrelated fixture list is unchanged.
7. For true cross-device acceptance, repeat readback on iPhone Safari over cellular. Separately repeat the already-saved record read while the Mac host/origin is unavailable, without stopping production services in an agent-run test.

Physical iPhone Safari cellular timing (<=30 seconds / <=3 primary taps), screenshots, deployed SHA, Owner login, remote D1 receipt, and Mac-off readback remain **Unknown**.

## Production mobile UI recheck — 2026-10-30 HKT

- Authenticated browser loaded the deployed Source Inbox and Archive at `radar.lamlab.cc`; Archive rendered 12 entries from the static 2026-07-02 edition. Source Inbox showed one browser-local synthetic record, still unreviewed/unapproved; candidate download remained disabled. No browser storage mutation was performed.
- CSS viewport emulation at 360/390/768px showed no horizontal overflow. This is not physical iPhone Safari or cellular evidence. No server-confirmed save receipt, second-device readback, or Mac-off read was obtained because the production cloud capability route returns JSON 404 and the available Worker is synthetic-only.
