# Recovery R1 — Mobile runtime diagnosis and rollback point

Date: 2026-10-30 HKT  
State: **DIAGNOSED / NOT DEPLOYED**

## Current runtime evidence

- `npm run health:mobile`: protected Origin listening/fail-closed at `127.0.0.1:4320`; local helper reports Gemini `gemini-3.5-flash-lite`, `configured=true` (presence only).
- Read-only Access-authenticated GET `https://radar.lamlab.cc/api/content-ops/status` returns `{"code":"api_route_not_found","error":"Unknown API route."}`.
- Current listeners are Radar-owned: launcher PID `10891` (`node scripts/run-mobile.mjs`), Origin PID `10892` (`node scripts/mobile-production-server.mjs`), helper PID `10893` (`node --experimental-strip-types scripts/source-fetch-helper.mjs`). All started `2026-10-30 12:49:37 HKT` from this repo. No process was stopped.
- The live Origin Node process loaded its route map at startup. Current `scripts/mobile-production-server.mjs` was modified at `14:22:21 HKT` and now maps the three `/api/content-ops/*` routes. The process predates that change, so it continues serving the old in-memory route map. Current `out/.radar-mobile-build.json` is dated `12:30:51 HKT`, also predating the route addition. Together these explain the live 404; this is not an Access sign-in failure.
- Origin HTTP 421 is the expected guard when Host differs from configured `radar.lamlab.cc`; code returns 421 before authentication. Do not relax the Host check. Wrong/missing forwarded HTTPS is separately rejected; Access verification remains fail-closed.

## Prepared build and rollback evidence

- Isolated mobile candidate: `/private/tmp/ai-pm-radar-r1-mobile-candidate-2026-10-30.tar.gz`.
- Candidate build ID: `CPl_G-9Wax5rHnH_gfQOD`; 215 static files; output tree SHA-256 `98b643fad36fd5d540bd4f26fac64513b9723365bda8d3d41e1386e15c56ac6d`; archive SHA-256 `f168f4de56711df856e95336be236de7c986b0873287883913a450f659c82802`.
- Before any authorized replacement, current static output was copied without changing it to `/private/tmp/radar-live-out-rollback-2026-10-30.tar.gz`; archive SHA-256 `1a286cc5f358dc8bbdbb9f197a3c1e2f9e75f028ac69951c6d004b741cd1dadf`.
- Rollback point captures the current `out/` only. It does not include the helper's environment, runtime state, Cloudflare configuration, or D1. No secret file was copied.

## Activation and rollback gate

No production deployment or restart is authorized by this record. After explicit production-release approval, the intended controlled sequence is:

1. Reverify the exact build/archive hashes and preserve the active `out/` rollback archive.
2. Build the authorized mobile output with `npm run build:mobile`.
3. Stop only the confirmed Radar launcher through its owning terminal/session; do not kill unrelated Node processes.
4. Start with `npm run start:mobile`; verify health and both child services.
5. Through authenticated `https://radar.lamlab.cc`, verify Source Inbox, Research Brief, `/api/status`, `/api/content-ops/status`, and candidate gates before any dispatch.
6. If verification fails, stop only that Radar launcher, restore the recorded `out/` archive, and restart the same launcher. Recheck Access and fail-closed behavior.

This sequence has not been executed. The active Tunnel, production Origin/helper, Access policy, schedule, D1, formal daily JSON, and Receiver were not changed or contacted in this diagnosis.

## Other current acceptance evidence

- Synthetic D1 revision 2 remains in the fixed pilot Worker until `2026-11-06T08:12:15.231Z`, per Owner decision; deletion was not attempted. Time Travel may retain copies beyond row expiry/deletion.
- One live short synthetic analysis through the local helper returned HTTP 200 with Gemini `gemini-3.5-flash-lite`; source ID/version echoed, existing draft/evidence validator passed, usage 799 input / 1,182 output tokens. It was not applied to a SourceRecord or saved browser draft.
- Local static preview at CSS 390×844 proved synthetic text capture and IndexedDB reload preservation, with review/candidate gates still closed. It had no helper/API, so it is not a production or connected-AI UI test.
- Public Google Cloud AIHelp Owner UAT SourceRecord remains `needs_review`, `not_approved`, and `analysis.status=not_requested`. No real dispatch or Receiver receipt exists; `import_confirmed` remains unset.
