# Phase 2.0A — Mobile Capture & Protected Cloud Persistence

Date: 2026-10-18 HKT
Current decision: **HOLD for remote D1 / real-device gates**. Local synthetic Worker round-trip passed; it is not Cloudflare D1 persistence or Owner device acceptance.

## Evidence state

| Gate | State | Evidence |
|---|---|---|
| Repository and runtime preflight | Completed | [preflight.md](preflight.md) |
| Existing architecture / boundary | Completed | [architecture-decision.md](architecture-decision.md) |
| Synthetic API behavior contract | Completed | [endpoint-contract.md](endpoint-contract.md) |
| Local synthetic two-context browser flow | Completed | `experiments/phase15-source-sync/test-cross-device-browser-local.mjs` |
| Protected Cloudflare D1 round-trip | Blocked | Owner authorized one synthetic test, but preview remained at Access sign-in and Cloudflare Dashboard redirected to `/login`; no identity established and no remote write made |
| Physical iPhone Safari / cellular | Unknown | Owner device test pending |
| Mac-off remote readback | Unknown | Not tested |
| Backup / restore of cloud D1 | Partial | Client JSON backup was round-tripped in local synthetic UI; D1 restore not tested |
| Production Source Inbox cloud integration | Planned | Current Source Inbox remains IndexedDB/local; cloud capability gate rejects synthetic-only API |
| Ranking calibration / downstream dispatch | Planned | Phase 2.0B / 2.0C, outside this sprint |

## Decision

**GO (bounded next step):** After Owner signs in to the existing Cloudflare account in the browser and the preview shows the expected authenticated identity, re-run only the already-authorized one-time fixed-synthetic flow: inspect remote list, create only if the target ID is absent, second-session readback, one duplicate retry/conflict check, and explicit cleanup of only the newly created fixture. No Worker deployment, policy change, real SourceRecord, or production daily write. Until that authenticated session exists, retain HOLD and do not write remotely.

**HOLD:** Do not enable arbitrary SourceRecord cloud writes, change Access/Worker policy, deploy, or use real intelligence. A later real-source pilot needs a separate, exact-source Owner GO after synthetic cloud persistence, authorization, backup/restore and conflict gates are evidenced.

See [threat-model.md](threat-model.md) and [restore-runbook.md](restore-runbook.md) before any future pilot.

## Current checkpoint — 2026-10-30 HKT

- Protected Radar UI activation is complete at `https://radar.lamlab.cc/` (Build ID `dQ3HcT4SOpg2T6388yCL6`). Production health, Access redirect, authenticated Inbox/Research/Archive pages and mobile viewport emulation are verified. This does not satisfy Cloud persistence ACs.
- The deployed Radar Origin returns JSON `api_route_not_found` for `/api/cloud/capabilities`; Source Inbox still stores drafts only in browser IndexedDB. `CloudSyncOptInPanel` creates only a local ID mapping and explicitly makes no remote API request.
- The authenticated synthetic Worker capability response says `isolated_database=true`, `one_article_only=true`, `real_upload_enabled=false`, `cloud_write_enabled=false`, and `controlled_commit_enabled=false`. It is not a production SourceRecord gateway and cannot accept arbitrary captures.
- Current status: Cloud Save and cross-device acceptance remain **HOLD**. No real-source upload or D1 write is authorized by this status update. See the current build and rollback details in `../../DEPLOYMENT.md` and `../../CONTEXT_SUMMARY.md`.
