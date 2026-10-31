# Phase 1.9 — Stable Operations & Verified Content Delivery

Date: 2026-10-17 HKT
Result: PARTIAL / HOLD for external production connectivity and real-source delivery.

## Runtime and routing evidence

- Canonical Radar checkout inspected: `main` at `e9c14c5`, with pre-existing dirty files preserved. The Phase 1.8 Archive/Dispatch runtime is a separate checkout, `feature/radar-unified-contentops-phase17` at `5c06509`; the running Archive and LAN proxy processes use that checkout. No files were changed in either checkout during diagnosis.
- Radar Origin and helper are running from `npm run start:mobile` on `127.0.0.1:4320` and `127.0.0.1:4310`. `npm run health:mobile` passed and reported the protected origin fail-closed and helper status only; no API key was read or emitted.
- Direct `GET http://127.0.0.1:4320/` returned 421 because the strict Origin requires the configured public hostname, not a loopback Host header. With `Host: radar.lamlab.cc` and `X-Forwarded-Proto: https`, unauthenticated `/api/status` returned 401. This is expected Host enforcement plus fail-closed Access verification; changing it to allow loopback Host would weaken the boundary.
- Unauthenticated `https://radar.lamlab.cc/`, `/archive`, and `/api/status` returned Cloudflare Access 302. This confirms the edge login gate, not that an authenticated request reaches the Mac Origin.
- No `cloudflared` process or matching Tunnel LaunchAgent was observed. Therefore post-login Tunnel-to-Origin connectivity is NOT VERIFIED; the edge 302 must not be reported as a healthy origin connection. Do not start or reconfigure the production Tunnel without Owner authorization.
- Archive route is exactly `/archive`: `http://127.0.0.1:4482/archive` returned 200; `/archive/` returned 404. Trusted-LAN `http://192.168.0.221:4482/archive` returned 401 without the local owner credential. The LAN proxy is separate from Radar's public Tunnel and was not changed.

## Phase 1.8 HMAC contract and synthetic E2E

- Existing sender signs the immutable source ID, source SHA-256, exact target Brand ID, approval timestamp, and content fingerprint with HMAC-SHA256. Signed POST requires Bearer authentication, an HTTPS source, exactly three bounded takeaways, a recent approval timestamp, and an allowlisted Brand; SQLite enforces source/Brand uniqueness, identical replay, and changed-revision conflict. Browser import preserves the receiver draft ID and creates an editable `draft`, then acknowledges; reimport is deduplicated.
- Backend accepted the exact `personal-ai-consultant` Brand filter. This says nothing about a queued record or successful Inbox import. No receiver body was retained by diagnostic probes.
- Isolated synthetic E2E passed using a temporary SQLite database, generated test-only 0600 secret, and ephemeral loopback port: signed delivery → durable receipt → exact-brand pending parse → Inbox draft mapping → ack → identical replay and duplicate import. Unsigned, tampered, expired, cross-brand, and changed-source attempts were rejected. Temporary DB and secret were removed. This was not a browser click-through and did not write to the live receiver or Brand Inbox.
- Receiver currently listens on `0.0.0.0:4496`. A no-auth request with a spoofed allowlisted LAN `Origin` reached the pending route and returned 200; response body was discarded. The Phase 1.8 contract explicitly treats exact Origin/CORS as a trusted-LAN boundary, not authentication, and requires that port never be exposed to the Internet. Keep it LAN-only; this task made no receiver-side changes.
- A prior Content Ops UAT note says a real bundle was imported through the file-import path and the signed receiver queue was empty at that earlier time. It is not evidence of a signed delivery and is not a current queue readback.

## Verification

- Radar: `npm test` — 202/202 passed; `npm run typecheck` — passed; `npm run health:mobile` — passed.
- Content Ops receiver/UI contract tests: 9/9 passed.
- Phase 1.8 sender tests: 3/3 passed.
- Isolated synthetic end-to-end contract harness: 1/1 passed.
- No production build, daily validators, authenticated external browser flow, or real-source dispatch was run; no product/runtime files or formal daily JSON were modified.

## Gate decision

- GO: local Origin/Helper health and isolated synthetic sender/receiver/Inbox contract.
- HOLD: authenticated public HTTPS reachability, because no Tunnel connector was observed and no logged-in post-Access probe was performed.
- HOLD: real-source dispatch, until the Owner reviews and explicitly approves a public, rights-cleared SourceRecord and the receiver-side Inbox item is observed. Never set `import_confirmed` from sender/export evidence alone.
