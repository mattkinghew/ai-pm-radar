# Recovery R1 — Operational Preflight

Date: 2026-10-29 HKT  
Result: **PARTIAL / HOLD**. The synthetic HMAC-to-Content-Ops code path passes in an isolated temporary database. The local Origin/helper have since been restored on loopback; the LAN Archive address and Receiver CORS allowlist remain stale. No live Inbox import or deployment was performed.

## Current runtime and routing

- Canonical Radar checkout: `main`, HEAD `e9c14c5`, pre-existing dirty worktree preserved. No source code or runtime configuration was changed in this preflight.
- At the start of this preflight, `lsof` found no listeners on Radar Origin `:4320`, helper `:4310`, or Content Ops preview `:4350`. The initial sandbox health attempt was blocked (`EPERM`); this was not an Origin HTTP response.
- `https://radar.lamlab.cc` displayed the Cloudflare Access login page. This proves unauthenticated edge challenge only; no Owner login or post-Access Origin request was made. `launchctl list` showed no matching Radar/cloudflared LaunchAgent entry; process enumeration was denied, so the running Tunnel connector state remains **Unknown**.
- Origin code and `tests/mobile-production-server.test.mjs` confirm 421 is the expected response when Host does not equal the configured public hostname. The focused test passed 5/5: correct Host + forwarded HTTPS remains fail-closed with 401 absent Access JWT; wrong Host or insecure forwarded protocol is rejected. This explains the earlier loopback-Host 421, but says nothing about current Tunnel connectivity.

## Archive and LAN diagnosis

- The current Archive listener belongs to the separate Phase 1.6 candidate checkout, not canonical Radar. `GET http://127.0.0.1:4482/archive` returned **200** with the body discarded.
- Its LAN listener is bound to the prior address `192.168.0.221:4482`. The Mac currently reports Wi-Fi address `192.168.0.198`; a status-only request to the current address failed to connect (HTTP `000`). The prior-address request timed out. Thus the previously documented LAN 401 is stale; it was not reproduced from the current interface.
- No listener was stopped or restarted. Rebinding this separate checkout needs an owner-approved restart/configuration step; do not widen the bind to a public interface.

## Receiver and HMAC contract

- The Content Ops Receiver process belongs to `/Users/mattgor/Documents/ChatGPT/Content Ops Studio` and currently listens on `*:4496`. No pending-list GET, response body, persistent receiver database, or real brand content was read.
- Read-only CORS preflight to `OPTIONS /api/intake/radar/pending` returned **204** for the prior `http://192.168.0.221:4350` Origin and **403** for the current `http://192.168.0.198:4350` Origin. This confirms the running Receiver accepts the stale LAN origin and rejects the current one. CORS is not authentication; the wildcard-bound Receiver must remain private-LAN-only and must never be routed to the public Internet.
- Receiver contract tests passed **9/9**; Radar Phase 1.6 `receiver_dispatch` tests passed **3/3**. A one-off in-process synthetic integration using the actual sender and Receiver handlers, temporary SQLite files and a synthetic 0600 secret passed: explicit three-part Owner attestation → HMAC-signed request → exact `personal-ai-consultant` Receiver receipt → exact-brand pending parse → in-memory unapproved ContentItem draft → duplicate-import suppression → Receiver ack → idempotent sender replay. Temporary DB/secret were removed. This did not use the live `:4496` process, browser localStorage, Cloudflare, or real source material.
- The signed sender endpoint is fixed to `http://127.0.0.1:4496/api/intake/radar`; the Receiver's browser pending/ack path is a trusted-LAN bridge, not a cellular/cloud endpoint. Its contract docs state that the Vercel/serverless handler fails closed without durable storage. Therefore it cannot by itself satisfy phone-over-cellular delivery.

## Verification and decision

- `node --test tests/mobile-production-server.test.mjs`: **5/5 PASS** (loopback test required approved local-network execution).
- Content Ops `vitest run api/intake/radar.test.js src/radarReceiver.test.ts`: **9/9 PASS**.
- Candidate Radar `node --experimental-strip-types --test tests/unit/receiver-dispatch.test.mjs`: **3/3 PASS**.
- Synthetic integration: **PASS**, isolated/in-process only. Actual receiver browser Inbox receipt: **NOT VERIFIED**. No `import_confirmed` status was set.
- Recommendation: **GO** for the local Origin/helper health gate and isolated synthetic contract; **HOLD** for authenticated public Origin, Archive LAN recovery and real dispatch. Next authorized setup needs (1) restore/verify the Cloudflare Tunnel route without changing Access policy, (2) rebind Archive to the current trusted LAN address without public exposure, (3) update Content Ops's exact allowlisted Origin from the old LAN origin to the current app origin and restart only its owner-approved service, then (4) run the actual browser import/ack with the fixed synthetic fixture and observe the receiver-side Inbox item. A separate cellular/cloud Receiver with durable auth/storage remains a distinct architecture requirement.

No production deployment, Cloudflare policy/Tunnel change, D1 or live Receiver write, formal daily-data change, real source dispatch, or process stop was performed.

## Local Origin recovery follow-up

- `npm run start:mobile` initially refused to start because `out/.radar-mobile-build.json` was missing/invalid. Ran the existing `npm run build:mobile`: Next.js 16.2.9 compiled, TypeScript passed and all 22 static pages generated; the mobile `/api` marker was written. Build ID: `MLDs_0T8EdmQO2zJywsWJ`. This regenerated ignored `.next/` and `out/` build outputs; no source or runtime config was edited.
- Restarted via `npm run start:mobile`; Protected Origin and companion helper are active only at `127.0.0.1:4320` and `127.0.0.1:4310`. `npm run health:mobile` passed and reports Gemini / `gemini-3.5-flash-lite` / configured=true (configuration presence only; no key validity, quota or live AI call was tested).
- Fresh status-only probes: default loopback Host `GET /` → **421**; public Host + forwarded HTTPS, no JWT `GET /api/status` → **401**. This directly confirms the 421 is host enforcement, not an Origin process crash; access control remains fail-closed.
- After restoration: `npm test` **207/207**, `npm run typecheck`, `npm run validate:data` (2 files / 12 articles, no warnings/errors), and `npm run validate:daily` passed. No authenticated browser request was made. The local services remain running; the Cloudflare Tunnel and post-Access public Origin remain **Unknown / NOT VERIFIED**.

## Local mobile submit regression follow-up

- At 390×844 CSS viewport, synthetic paste-text submission initially failed with `TypeError: value.trim is not a function`. `ImportPanel` passed the click event as the first argument to `createTextDraft(value = inputValue, ...)`; wrapped the text callback so it calls `createTextDraft()` with the current controlled value. URL submission was already wrapped and is unchanged.
- Repeated browser flow: paste synthetic text + `https://example.com/synthetic-mobile-qa` → create draft → SourceRecord card appears → reload → same draft restored from browser storage. Card remained **未審核 / 未批准**; AI analysis was not requested. CSS viewport checks at 360×800, 390×844 and 768×1024 showed `documentElement.scrollWidth` equal to `innerWidth` (360/390/768 respectively), with no horizontal overflow; screenshot inspection at 360px showed the nav wrapping and content remaining readable. Browser console had no errors after the fix. This is local synthetic UI evidence only; no live fetch, Gemini call, approval, candidate export, or physical-device test.
- `npm test` **207/207** and `npm run typecheck` passed. `git diff --check` passed for the touched source/docs. The temporary dev app/helper at `127.0.0.1:49782` / `:49783` were stopped with Ctrl-C. Existing `start:mobile` Origin/helper at `127.0.0.1:4320` / `:4310` were not changed or stopped.

## Local Worker Access JWT diagnostic

- The local Worker path uses `ctx.access.getIdentity()` when Access context exists; otherwise it validates the `Cf-Access-Jwt-Assertion` using RS256, exact issuer/audience, time claims, and the configured Owner email SHA-256. Cloudflare documents this assertion header/JWKS validation pattern and notes `ctx.access` is not propagated through the Static Assets router.
- The four local Wrangler variants require `CLOUD_ACCESS_REQUIRED` and contain an Owner hash, but none declares `CF_ACCESS_TEAM_DOMAIN` or `CF_ACCESS_AUD`. The JWT fallback deliberately returns 401 if either is absent. Dashboard/runtime values and the deployed request's identity/header were not inspected, so the production cause remains **UNKNOWN**; absent runtime bindings are a plausible, not proven, cause. No policy/config edit or deployment was made.
- Added a synthetic regression for absent issuer and audience bindings. `node --test experiments/phase13-one-article/test-worker-local.mjs` passed **16/16**. Existing tests also cover valid signed JWT, tampering, wrong issuer/audience/time/email, spoofed/malformed token and fail-closed identity handling. This is local Worker evidence only.

## Recheck after mobile UX verification

- With approved read-only loopback access, fresh `npm run health:mobile` passed: Origin `127.0.0.1:4320` is listening/fail-closed; helper reports Gemini / `gemini-3.5-flash-lite` / configured=true (presence only). No live model call.
- Opened the exact fixed-synthetic pilot URL documented in `docs/qa/phase20-mobile-cloud/preflight.md`; the browser showed the Cloudflare Access sign-in page. No Access session was established and no capabilities, fixture, list, create, update, or delete API was called. The page was closed without signing in. The authorized remote synthetic E2E remains pending Owner completion of Access sign-in.
- Current local reruns: Worker security **16/16**, source-sync service **12/12**, full local two-browser synthetic test **PASS**. The browser simulation used the actual Worker UI, two isolated contexts, local in-memory SQLite, version/conflict/readback/cleanup assertions, 390/768/1280 widths, same-origin requests, and zero JS exceptions. It does not prove remote D1 or cellular connectivity.
- Official Cloudflare documentation states that Workers Static Assets' internal router does not pass `ctx.access` to the user Worker, but the Access JWT fallback is present in local source. Whether deployed issuer/audience bindings and the assertion header are present remains **UNKNOWN**; no deployment/config changes were made.

## Recovery R1 Playwright capture and persistence recheck

- Fresh `npm run health:mobile` passed before this check. The production static Origin/helper remain bound to loopback; an unauthenticated request to the protected Origin's loopback IP correctly returned **421** because the request Host was not the configured public host. I did not spoof Access identity or use the protected production Origin as an unauthenticated test surface.
- A temporary local Next development page was started on `127.0.0.1:55231` in Webpack mode. Headless Chrome loaded `/source-inbox/`, submitted one fictional text fixture, observed browser-local save, reloaded the page, and verified the exact body was restored from IndexedDB. Review/approval actions were not invoked.
- At 390, 768 and 1280 CSS-pixel widths, document width matched viewport (no horizontal overflow). Browser console/page errors: **0**. Network inspection recorded only the local app assets plus a read-only loopback `GET /automation/status`; there was no `/analyze` request or non-loopback origin. No real article, Gemini call, remote Access/D1 request, approval, or candidate export occurred.
- Screenshots are stored in `docs/qa/recovery-r1-mobile-2026-10-29/` (Source Inbox import and reloaded synthetic-draft states at 390/768/1280). They are local browser viewport evidence only, not physical iPhone or cellular acceptance.
- An initial Turbopack browser run emitted a `ChunkLoadError` and was discarded as failed evidence. The Webpack-mode rerun completed the persistence assertions without console errors. Both temporary local dev sessions were stopped with Ctrl-C; the existing production Origin/helper were not stopped.
- Remote fixed-synthetic D1 acceptance is still **BLOCKED pending Owner Access sign-in to the exact pilot page**. No remote capabilities/list request or D1 operation has occurred in this recheck.
- Fresh engineering checks after this UI run: `npm test` **207/207**, `npm run typecheck`, `npm run validate:data` (2 files / 12 articles, no warnings/errors), and `npm run validate:daily` passed. An isolated `/tmp` copy, excluding `.env*`, runtime, `out/`, `.next/`, Wrangler state and unrelated Deal Radar files, completed `next build --webpack` and generated 22/22 static pages. The served repository `out/` and `.next/` were not overwritten. A repo-wide `git diff --check` reported trailing whitespace only in pre-existing dirty Deal Radar files; the changed `docs/CONTEXT_SUMMARY.md` scoped check passed.
- Prepared—but did not deploy—a clean static mobile candidate using the existing `npm run build:mobile` from an isolated source copy with local dependencies. Build ID `g4j-6B8TJ6WUW_PqWQtUt`; archive SHA-256 `32639b14372e5431facd48d49dab34fbb11f3a98817ecb1dd2a6b24dad42de14`; artifact path `docs/qa/recovery-r1-mobile-2026-10-29/artifacts/ai-pm-radar-recovery-r1-mobile-static-candidate-2026-10-29.tar.gz`. The 237-entry archive includes the `/source-inbox/` page and mobile build marker; inspection found no environment files, runtime, `.next`, `.git`, Wrangler state/config, or SQLite files. Production `out/`, Origin, Cloudflare, and formal daily data remain unchanged.

## 2026-10-30 Access/JWKS diagnostic follow-up

- Rechecked existing local services without stopping them. This checkout's Origin/helper are loopback-only at `127.0.0.1:4320` / `:4310`; `npm run health:mobile` passed. Other listeners on 3000, 4482 and 4496 were left untouched.
- Host-safe status probe returned **401** with configured public Host and forwarded HTTPS, without an Access JWT; an intentionally wrong Host returned **421**. This confirms the historical 421 is the expected Host guard.
- Owner-authorized diagnostic deployment targets only the fixed synthetic Worker. Current version: `2ffaa86e-b30c-480d-9d21-fd92aa4fadc9`. Authenticated browser request returns fixed enum `access_jwks_unavailable`; the verifier receives the assertion but cannot obtain usable JWKS. The public Access JWKS endpoint was readable in the browser. The Worker-side failure could still be non-2xx, transport, or response parsing/size; authentication remains **NOT FIXED**.
- Added local enum-only branch diagnostics and regression coverage. `node --test experiments/phase13-one-article/test-worker-local.mjs` passed **18/18**; Source Sync service tests passed **12/12**; full `npm test` **207/207**, typecheck, and both daily validators passed. Wrangler `--dry-run --keep-vars` passed with 34 assets; sandbox log-file `EPERM` did not change the exit-0 result. The finer local diagnostic stage is not deployed. No token/identity was logged; no D1, Access policy, Tunnel, Production Radar or Content Ops write occurred.
- **HOLD:** further status-level diagnostics and the final auth fix each require separate authorization before another external deployment. No remote D1 read/write or receiver import was attempted; `import_confirmed` remains unset.

## 2026-10-30 Worker JWKS transport result

- A separately authorized diagnostic-only deploy to the same synthetic Worker completed; current version `74971c01-25e8-4aed-b85f-3cd98960a371`. Authenticated browser request now returns `access_jwks_request_failed`, so the verifier fails during the Worker-side JWKS request, before comparing `kid`. This is not a signature-key mismatch result.
- The Access JWKS endpoint returned a JSON key set in a direct browser visit. Host Node fetch reported DNS `ENOTFOUND`; that does not establish the Worker runtime's exact DNS error. Do not infer a policy, key, or account defect from this alone.
- Current action boundary: do not deploy again or change Access settings until separately authorized. No D1 operation or receiver write was made.
- Homepage saved-draft summary now includes `今日待審核` (capture date interpreted in Hong Kong time); focused tests and typecheck passed. Build remains deferred to avoid overwriting the currently served `out/` tree.
- Fresh `npm run health:mobile` returned `ECONNREFUSED 127.0.0.1:4320`; `lsof` showed no listener on 4320/4310. An isolated Webpack build passed with 22 static pages. Temporary static preview on `127.0.0.1:43933` was stopped after read-only visual inspection; no draft was entered.
- Controlled `npm run start:mobile` then started only the Radar loopback Origin/helper, and `npm run health:mobile` passed (Origin fail-closed 401, helper Gemini configuration present). The parent was stopped with Ctrl-C. This does not establish Tunnel/remote availability.

## 2026-10-30 Authorized synthetic Worker fix verification

- The Owner authorized one fix deployment, limited to `radar-phase13-one-article-dark`; diagnostics were removed and no D1 access was performed. Deployed version: `203c5fb9-32d4-4f50-81ed-cddc84db3836`.
- Using the existing Access-authenticated browser session, a read-only GET to `/api/source-sync/v1/capabilities` returned the expected capability JSON: enabled, synthetic-only, real sources disallowed, Access required, owner-scoped, and human review required. No authentication diagnostic fields were present. This is direct evidence that Access verification succeeds on the deployed Worker.
- Local verification: Worker tests **18/18 PASS**; `npm run typecheck` passed. No D1 operation, Access policy edit, production deployment, Tunnel change, or Content Ops write occurred.
- **GO** for the fixed synthetic Worker's authenticated read-only capabilities check. **HOLD** for remote D1 round-trip, cross-device persistence, Content Ops receiver receipt/`import_confirmed`, and physical iPhone/cellular acceptance. Do not label any content imported without receiver-side evidence.

## 2026-10-30 JWKS root cause and local repair

- Cloudflare Workers Request API docs state `redirect: "error"` is unsupported and throws before any subrequest is sent. This precisely explains the deployed verifier's prior `access_jwks_request_failed`; it was not a DNS or `kid` mismatch diagnosis. Host Node DNS failure is separate and not causal evidence for the Worker.
- Local verifier now uses `redirect: "manual"` and rejects 3xx without following the Location. Worker API responses no longer expose temporary diagnostics. RS256 and all Owner/claim checks remain fail-closed. The deployed synthetic version is still `74971c01-25e8-4aed-b85f-3cd98960a371`; local correction is not deployed.
- Regression test reproduced the old behavior before the patch; after patch Worker tests passed 18/18, `npm test` 207/207, typecheck passed. Any deployment of this fix needs separate Owner authorization. No D1/policy/production changes were made.
