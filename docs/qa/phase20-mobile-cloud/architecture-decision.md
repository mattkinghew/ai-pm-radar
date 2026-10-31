# Architecture Decision — Reuse Protected Worker/D1, Keep Production Source Inbox Local

## Observed architecture

1. **Production Radar:** `out/` static site → Cloudflare Access → Radar Tunnel → loopback mobile origin (`127.0.0.1:4320`) and companion helper (`127.0.0.1:4310`). `npm run health:mobile` passed in this audit. Research runtime remains local to the Mac. The Mac process is therefore a production availability dependency for the site/API paths routed to it.
2. **Source Inbox today:** `components/SourceInboxWorkbench.tsx` persists text drafts in browser IndexedDB. It does not issue the Phase 1.5A D1 sync requests. `lib/cloud-sync-capability-gate.ts` is a fail-closed planning gate, not a cloud client; it requires a same-origin capability response that is not provided by the synthetic-only Worker.
3. **Earlier spike:** `experiments/cloudflare-sync-spike/` is explicitly local/experimental and is not wired to current SourceRecord v2, Source Library v4, DeliveryPackage or the production UI. Do not promote it as the integration target.
4. **Later bounded pilot:** `experiments/phase15-source-sync/` plus `experiments/phase13-one-article/worker.mjs` is the strongest existing reusable path. It uses Cloudflare Access identity from `ctx.access.getIdentity()`, exact Owner hash binding, D1 binding `SYNC_DB`, owner-scoped rows, canonical SourceRecord validation, fixed synthetic fixtures, SHA-256, compare-and-swap expected revision/hash, immutable revision/event rows, payload limits and seven-day expiry. Config also binds a separate historical clean-room DB; its data and deployment are outside this synthetic test.

## Configuration drift / deployed identity risk

- `experiments/phase13-one-article/wrangler-next-pilot-preview.jsonc` and `wrangler-phase15b-synthetic-protected.jsonc` use the same Worker name and asset directory, but do not describe the same deployment. The former disables multi-source sync and has no `SYNC_DB` binding; the latter enables synthetic sync and binds a separate D1 database.
- The protected worker hostname identifies the Worker name, not which local configuration/revision is currently deployed. Since this run could not authenticate to the Cloudflare dashboard or read the protected capability endpoint, the deployed config, code version, `SYNC_DB` binding and D1 state are **Unknown**. Do not infer them from either JSONC file or from the local test.
- Before any remote write, the authenticated read-only preflight must show the expected Worker version and `capabilities.enabled=true`, `synthetic_only=true`, `real_sources_allowed=false`, plus the expected owner-scoped limits. If any value differs or is missing, stop without a write. On the latest follow-up, the Dashboard was signed in but both the protected capabilities URL and pilot page returned `{"code":"unauthenticated"}`; the deployed identity/config therefore remains unknown, and no remote write was attempted. See `preflight.md`.

## Decision

The smallest local gateway is now implemented in `experiments/phase20-cloud-source/service.mjs` and routed through the existing Access-verified Worker. It requires a dedicated `CLOUD_SOURCE_DB`, independent opt-in flags including an operator attestation that the purge schedule is configured, exact Owner identity, same-origin writes, per-source backup/rights/retention attestations, SourceRecord/evidence validation, immutable revisions and expected-revision/fingerprint CAS. It never shares `DB` or synthetic `SYNC_DB`; every cloud write remains off by default. The cloud sync planner now emits the matching server authorization envelope only after its explicit consent gate passes.

This is **local implementation only**. Do not apply the simulation schema to any live database. No Worker deployment, Cloudflare binding/policy, production same-origin route or D1 write was performed. The production app still has no reachable `/api/cloud/capabilities` route and remains IndexedDB-only. Remote persistence stays HOLD until a dedicated D1 and route are separately approved, provisioned, deployed and verified.

The current synthetic service is **not a general draft database**: only fixed allowlisted `.invalid` fixtures are accepted, the browser requires a downloaded/reselected JSON backup and per-item attestations, active quota is five, maximum revisions eight, and retention is seven days. It therefore proves a bounded pilot mechanism, not the requested low-friction URL/text capture for arbitrary real records.

## Environment separation

| Environment | Role | Current evidence |
|---|---|---|
| Radar production hostname | Static app + local Mac origin/helper via Tunnel | Local health passed; current build SHA and authenticated public flow unknown |
| Phase 1.5 synthetic Worker preview | Protected experimental UI/API + separate synthetic D1 | Dashboard session confirmed; pilot UI/API returned `unauthenticated`; remote D1 state and deployed version unknown |
| Phase 1.5 local tests | Worker module + synthetic SQLite adapter + mocked Access | Fresh service and two-browser tests passed |
| Formal daily data | Static published JSON | Validators passed; not modified by this work |

No production hostname, Worker deployment, D1 binding, Tunnel, Access policy or formal daily file was changed by this local gateway implementation.

## Current production capability — 2026-10-30 HKT

The Radar mobile UI is now active at `https://radar.lamlab.cc/`, Build ID `dQ3HcT4SOpg2T6388yCL6`. The production same-origin `/api/cloud/capabilities` route returns JSON `api_route_not_found`; the Source Inbox Cloud panel does not call a remote API. The authenticated fixed synthetic Worker reports `real_upload_enabled=false` and `cloud_write_enabled=false`, and is limited to one fixture. It is not ready as a general draft store. Preserve the fail-closed state; implementation/deployment of a real-source gateway requires a separately reviewed scope and Owner authorization.

Historical Access finding (2026-10-18): the synthetic Worker profile includes a Static Assets binding. The handler gated routes through `ctx.access.getIdentity()`, but Cloudflare documentation reviewed then stated the internal Static Assets router does not pass `ctx.access` to the user Worker. This matched the observed Worker JSON 401 `unauthenticated`. Any Access JWT validation must verify signature, issuer, audience, expiry and configured Owner email hash; a header value alone is not trusted. The separate “Access application not found” browser error was not resolved by this local code diagnosis.
