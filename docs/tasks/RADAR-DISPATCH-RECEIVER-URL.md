# RADAR-DISPATCH-RECEIVER-URL

Status: Completed (local synthetic verification, 2026-11-14)

## Goal and acceptance criteria

- `CONTENT_OPS_RECEIVER_URL` selects the Content Ops Receiver for POST dispatch and GET import readback. Unset or blank keeps `http://127.0.0.1:4496/api/intake/radar`.
- Invalid URLs and URL credentials are rejected. Non-loopback hosts require HTTPS; `127.0.0.1`, `localhost`, and `::1` may use HTTP.
- A non-empty `CONTENT_OPS_VERCEL_BYPASS_TOKEN` is sent as `x-vercel-protection-bypass` only for HTTPS requests. The token is absent from status, receipt, and error messages.
- Existing HMAC, receipt, and receiver import confirmation behavior remains green.

## Non-goals

No real network requests, production configuration or deployment, Content Ops Studio edit, secret-file or HMAC-contract change, new dependency, commit, push, or merge.

## Changed files / diff

- `scripts/content-ops-dispatch.mjs`: resolve and validate the Receiver URL; apply it and the conditional bypass header to both requests; report `loopback_only`, `https_configured`, or a fail-closed invalid configuration without exposing configuration values.
- `tests/content-ops-dispatch.test.mjs`: cover the unchanged default, custom HTTPS POST/GET, rejected URLs, HTTP loopback, header rules, and token-safe errors with injected `fetchImpl`.
- `docs/tasks/RADAR-DISPATCH-RECEIVER-URL.md`: this handoff packet.

## Verification evidence

- `git rev-parse HEAD` -> exit 0 -> `a24cc8de2fe22365003dfee4c5f9f72ae6e8a9e2`.
- `git status -sb` -> exit 0 -> `feat/cloudflare-cloud` ahead 12; only the two intended tracked files modified and this packet added. Pre-existing untracked `.bak` files, `last-message.md`, and `docs/qa/RADAR_AGENT_GOVERNANCE_ALLOWLIST_2026-11-12.md` remain untouched.
- `node --experimental-strip-types --test tests/content-ops-dispatch.test.mjs` -> exit 0 -> 8/8 passed.
- `npm test` -> exit 0 -> 298/298 passed, 0 failed, 0 skipped.
- `git diff --check` -> exit 0 -> no whitespace errors.
- Tests use injected `fetchImpl`; no real Receiver request was made. No commit, push, or deploy performed.

## Known failures and gaps

- No known local test failures. Production Vercel bypass and live Receiver acceptance: Unknown; no production URL or network request was used.
- One overlapping `npm test | tail -n 10` diagnostic displayed `listen EPERM` and its pipeline exit code was not a valid test result. The subsequent standalone `npm test` completed 298/298 with exit 0.
- `npm run build` and production Owner acceptance were not run: Unknown; neither is an acceptance criterion for this packet.
