# Recovery R1 — Current operational and delivery evidence

Date: 2026-10-30 HKT  
Disposition: **PARTIAL / HOLD**

## Origin and service diagnosis

- `GET /` sent to `127.0.0.1:4320` with a loopback Host returns **421**. This is the configured public-host guard. With the expected public Host and HTTPS forwarding, an unauthenticated API request returns **401**; the Origin remains fail-closed.
- The Access-authenticated browser loaded `https://radar.lamlab.cc/`. The helper status reports provider `gemini`, model `gemini-3.5-flash-lite`, and `configured=true`; this only means settings are present, not that the key or quota is valid.
- Authenticated `GET /api/content-ops/status` returns `configured=false`, an empty Brand ID list, and `content_ops_brand_allowlist_missing`. The cloud capability path returns JSON `api_route_not_found`; the local Phase 2.0 gateway is not active in the production runtime.
- A Cloudflare Tunnel process for Radar is present. This, together with authenticated page load, confirms current external UI reachability. It does not prove cloud persistence or receiver delivery.

## Archive listener

- Loopback `GET http://127.0.0.1:4482/archive` returns **200** HTML.
- The LAN listener belongs to another checkout (`ai-pm-radar-phase-1.5e-rc3/.../unified-library-phase16-candidate`) and is bound to `192.168.0.221`. The current Mac interface address is `172.20.10.3`; a request to the old LAN address timed out. The previously observed LAN 401 is stale and was not reproduced.
- No listener was stopped, restarted, rebound, or exposed. Authenticated Archive access from another LAN device remains unverified.

## HMAC Receiver contract

- Isolated synthetic E2E **PASS** using the actual Radar dispatch sender and Content Ops Receiver handler, a disposable SQLite database, a generated test-only signing secret, and a synthetic test Brand:
  1. Signed source package was accepted and a Receiver receipt returned.
  2. Receiver readback showed a draft.
  3. Exact-origin import acknowledgement changed the Receiver state to imported.
  4. A second readback showed imported.
  5. Identical sender retry returned the same draft; one row remained.
  6. Temporary database and secret file were removed in cleanup.
- This test was in-process and isolated. It did not contact the live `:4496` process, its persistent database, an actual brand Inbox, production D1, or a real source. Therefore it is **not** a live receiver receipt and does not set `import_confirmed`.

## Owner source and release gates

- The public-source AIHelp record was reviewed at evidence grade **B** and approved only for an editable Content Candidate draft. That approval does not authorize dispatch.
- The exact production Content Ops Brand ID is **unconfirmed**. Do not use `personal-ai-consultant`; it was used only by an isolated contract test. The empty production allowlist is correctly fail-closed.
- No Receiver request was made. There is no receiver-side receipt, so `import_confirmed` remains unset.
- Local cloud gateway code is not deployed: production `/api/cloud/capabilities` returns `api_route_not_found`. Source Inbox persistence therefore remains browser-local; no D1 read or write was made.

## Verification

- `npm test`: **227/227 passed**.
- `npm run typecheck`: passed.
- `npm run validate:data`: passed; 2 files, 12 articles, no warnings or errors.
- `npm run validate:daily`: passed.
- Build not run: the Next static export targets the active `out/` tree; rebuilding could replace served files and is outside this no-deployment check.
- Browser page reachability was verified through the authenticated in-app browser. Physical phone/cellular testing and cross-device saved-draft readback remain unverified.

## Decision

- **GO:** local synthetic sender/Receiver contract, authenticated production page reachability, and local automated checks.
- **HOLD:** real Content Ops delivery, `import_confirmed`, cloud cross-device persistence, authenticated LAN Archive, and physical mobile/cellular acceptance.
- No production deploy, D1 write, process restart, public port exposure, formal daily-data edit, schedule change, or automatic approval occurred.

## Addendum — later production and gateway recheck (2026-10-30 HKT)

- A new authenticated-browser navigation to `https://radar.lamlab.cc/` returned Cloudflare **502 Bad Gateway** at `2026-10-30 12:44:05 UTC`; Cloudflare reported its edge working and Host error. Earlier already-open page tabs are stale evidence for current reachability.
- Current `npm run health:mobile` passes. The Origin is loopback-only on `127.0.0.1:4320`; the helper is loopback-only on `127.0.0.1:4310`. A raw HTTP request with the default loopback Host returns 421; with `Host: radar.lamlab.cc`, `x-forwarded-proto: https`, and no JWT it returns 401 JSON. The public Host is accepted and authentication remains fail-closed.
- The Radar-marked Tunnel connector reports 4 HA connections, 589 total requests and 4 request errors. A separate Quick Tunnel targets `127.0.0.1:8790` and reports zero connections/requests. A sanitized recent local-log check found no matching Origin-connect failure categories. The exact reason for the edge 502 remains **UNKNOWN**; the active Cloudflare hostname route and origin service must be checked in the Dashboard.
- Cloud API integration state is confirmed: the Phase 2.0 service is attached to the protected Worker and uses the dedicated `CLOUD_SOURCE_DB`; however, `scripts/mobile-production-server.mjs` does not allowlist `/api/cloud/*`, and production `/api/cloud/capabilities` returns `api_route_not_found`. Thus the current production Source Inbox cannot save to cloud. Local Worker/service tests do not prove the production route is connected.
- Reverification: `npm test` **230/230 PASS**; `npm run typecheck`, `npm run validate:data` (2 files / 12 articles, no warnings/errors), `npm run validate:daily`, and scoped `git diff --check` pass. No build was run because the production static output is active and code was unchanged in this recheck.
- The Content Ops production allowlist remains empty and the exact Brand ID remains unconfirmed. No D1 request, dispatch, Receiver readback, service restart, Cloudflare route/policy change, Worker deployment, daily-data change, or `import_confirmed` update occurred. Disposition remains **PARTIAL / HOLD**.

## Addendum — Tunnel route and connector status (2026-10-30 HKT)

- Read-only Cloudflare Dashboard inspection confirms `radar.lamlab.cc` is a proxied CNAME to the existing Radar Tunnel. Its hostname route targets `http://127.0.0.1:4320/`, matching the current production Origin. Tunnel-side Access JWT protection is enabled and an audience is configured; values are intentionally not recorded.
- The Dashboard showed **0/1 replica log connectors live** while the hostname continued returning **502 Bad Gateway**. A local `cloudflared` process exists, but the available process evidence does not reliably establish that its token-file belongs to this exact Tunnel. This is consistent with a missing/stale or mismatched connector, but does not prove which one.
- A separate Quick Tunnel still targets `127.0.0.1:8790`; it is unrelated and was not changed. No DNS, Tunnel, Access policy, process, Worker, D1, or production file was changed. The exact 502 cause remains **not conclusively identified**.
- Local Tunnel-process mapping could not be rechecked in this shell because process-list access was denied. No token, token-file contents, Access audience, or redirect credentials were read or recorded.
- Disposition remains **HOLD** for external availability and content delivery. The next safe repair step requires explicit authorization to inspect/restart only the confirmed Radar connector, or owner-side confirmation that the Radar Tunnel service is running with its matching token-file.

## Addendum — fresh external Tunnel result (2026-10-30 HKT)

- A newly created browser tab requested `https://radar.lamlab.cc/` and received Cloudflare **Error 1033** at `2026-10-30 14:57:59 UTC` (Ray ID `a52b468dcdfd4c58`). Cloudflare states it cannot resolve the configured Tunnel and advises ensuring `cloudflared` is running and can reach the network. This is stronger evidence for an unavailable/unconnected Tunnel connector than the earlier generic 502, but does not identify which local process/token is responsible.
- Fresh `npm run health:mobile` passes: Origin listening fail-closed on `127.0.0.1:4320`; helper reports Gemini `gemini-3.5-flash-lite`, `configured=true` (presence only). This proves local service health, not Tunnel connectivity.
- A new local HTTP guard probe was denied by the execution environment (`EPERM`) before reaching the Origin; prior 421/401 guard evidence remains historical, not freshly repeated here.
- No connector restart, Cloudflare change, deployment, D1 operation, dispatch, or formal data change occurred. External availability and cloud save remain **HOLD**.
- Targeted local verification: `node --test tests/cloud-source-gateway.test.mjs tests/mobile-production-server.test.mjs` **15/15 PASS**. The gateway tests use an in-memory test DB; the Origin tests bind only loopback. No production D1 was contacted.
- A safe process-name listing showed two `cloudflared` PIDs, but did not identify which belongs to Radar. Automatic approval review rejected a subsequent diagnostic that would correlate process arguments with the `.env.local` token-file setting, because that reads credential configuration. No workaround was attempted. Owner-side confirmation or separate approval is needed before connector action.

## Addendum — external reachability recovered; data paths remain partial (2026-10-30 HKT)

- Without any restart or configuration change by this session, a later authenticated Dashboard read showed Tunnel `ai-pm-radar` with **1 healthy replica** (uptime shown as 6 minutes) and the `radar.lamlab.cc/` route still targeting `http://127.0.0.1:4320`. A fresh browser navigation to `https://radar.lamlab.cc/` loaded the current Radar UI. This supersedes the earlier 1033 for present page reachability; it does not establish why the connector became healthy.
- A fresh same-origin browser request to `/api/cloud/capabilities` returned JSON `api_route_not_found`. The Source Inbox therefore still reports browser-local saving and cross-device sync not enabled; no cloud persistence was attempted.
- The loaded Research Brief shows snapshot date **2026-10-18**, **55** Collector candidates, and a stale-snapshot warning (>24 hours). Its run status is “尚未執行”; no runner or AI analysis was started. The Home page still displays the **2026-07-02** daily edition. No formal data, runtime, schedule, AI switch, or D1 state was changed.
- Current disposition: **PARTIAL** for external UI reachability; **HOLD** for cross-device persistence and Content Ops delivery. The exact production Brand ID is still unconfirmed; there is no Receiver receipt and `import_confirmed` remains unset.
- Read-only request to the existing `radar-phase13-one-article-dark` Worker: `/api/cloud/capabilities` returns `{"code":"not_found"}`; `/api/source-sync/v1/capabilities` returns version 1 with `synthetic_only=true`, `real_sources_allowed=false`, `access_required=true`, and `owner_scoped=true`. Thus that deployed Worker is the synthetic-only Source Sync contract, not the local Phase 2.0 cloud SourceRecord gateway. No real SourceRecord should be sent to it, and no Worker deployment was made.
- Cloudflare Dashboard Worker deployment details show bindings `ASSETS`, `DB`, and `SYNC_DB`; no `CLOUD_SOURCE_DB` binding is configured, and the Worker has no custom domain/route. The local Phase 2.0 service deliberately requires a separate dedicated D1 binding, so it cannot be enabled by pointing it at the existing pilot/synthetic databases.
