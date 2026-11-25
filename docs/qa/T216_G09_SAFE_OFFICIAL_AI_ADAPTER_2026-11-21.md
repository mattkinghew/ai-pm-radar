# T216 G09 — default-off official HTTP adapter

Checked: 2026-11-21 (HKT)

## Result

- Added an isolated `generatePublicGemini` adapter in `cloud/src/ai.mjs`. Existing `summarize` and `generate` paths do not call it, so it is not enabled by this change.
- It requires `PUBLIC_HTTP_AI_ENABLED=true`, an explicit `scope` of `public` or `synthetic`, a positive `PUBLIC_HTTP_AI_DAILY_CAP`, and an explicit `PUBLIC_HTTP_AI_MODEL`. Missing configuration fails before the network call.
- It rejects non-public scope, empty/over-12,000-character input, and invalid/over-4,000-character prompts; it does not silently truncate input. Output is capped at 1,024 tokens. It uses the existing D1 AI usage reservation/refund, has one provider attempt, and does not fall back to Workers AI.
- The destination remains the fixed official Google Gemini API host and `generateContent` path; redirect following is disabled (`redirect: "error"`). The API key is supplied only in the `x-goog-api-key` request header and is not placed in the URL or logged.
- No UI, route, Cloudflare variable, key, or live provider call was added. This adapter is currently an isolated server-side seam for later explicitly authorized selection; it does not claim a user-facing feature is enabled.

## Official API reference

Google's current API overview describes REST and `x-goog-api-key` authentication, while identifying Interactions API as its default interface and `generateContent` as legacy-but-supported. This increment deliberately preserves the existing generateContent contract and does not migrate or invoke a provider live:

- [Gemini API overview](https://ai.google.dev/gemini-api/docs)
- [Gemini API REST authentication and generateContent reference](https://ai.google.dev/api/generate-content)

## Tests

- `node --experimental-strip-types --test tests/cloud-g09-official-ai.test.mjs` — **4/4 passed**.
- Cases cover default-off/no-fetch, private scope, absent budget, input limit, fixed official endpoint, header-only test key, response mapping, output cap, quota exhaustion, redirect rejection option, and no provider fallback on HTTP failure.
- Package test suite excluding only the sandbox-blocked mobile server test — **366/366 passed**; `npm run test:phase-1.5d` — **29/29 passed**; `npm run typecheck -- --incremental false` and both daily validators — exit 0.
- `npm run build` and `npm run build:mobile` — exit 0 in an isolated `/private/tmp` copy so the checkout's existing `.next/` and `out/` were not overwritten; Next compiled and prerendered 83/83 pages.
- Tests use a fake in-memory D1 and injected transport. No outbound request or real secret was used.
- Independent read-only review: **ACCEPT** for this local default-off adapter seam; reviewer made no edits and performed no network/provider call.

## Limits and dependency

- `scope` is an explicit caller attestation; there is no new end-user route. Any future caller must derive it from trusted source/provenance policy, not accept a browser-provided classification.
- G08 remains **Partial**: collector feeds and source discovery preview still have redirect-follow paths whose destinations are not revalidated. G09 was tested browser-free and remains default-off; it does not resolve that G08 finding or authorize live use.
- No deployment, remote D1 write, API key, paid fallback, external package, or production configuration change occurred.

## Follow-up — Cloudflare redirect mode compatibility (2026-11-21 HKT)

- Current Cloudflare Workers `Request` documentation states that `redirect: "error"` is unsupported and throws before sending the request; `redirect: "manual"` returns 3xx for application handling. The pre-follow-up mock test asserted `"error"`, so it did not catch the Workers runtime incompatibility.
- Changed the shared Gemini request to `redirect: "manual"`. The existing `!response.ok` check rejects 3xx without reading its body or following `Location`; this applies to the isolated default-off adapter and existing Gemini routes.
- Added a synthetic regression proving a 302 to a loopback URL yields `gemini_http_302` after exactly one request. Test-first run failed on both redirect-mode assertions before the fix; afterward the focused suite passed **67/67**, TypeScript, JavaScript syntax, and scoped diff checks passed.
- `./node_modules/.bin/wrangler deploy --dry-run --config cloud/wrangler.toml --outdir /private/tmp/radar-g09-wrangler-dry-run` exited 0 and compiled the Worker bundle without upload. Wrangler emitted a local log-write `EPERM` warning before reporting dry-run completion; no log file was inspected.
- No live Gemini request, adapter enablement, deployment, or account operation occurred. G08's independent feed/source-preview redirect gap remains open, so this correction does not authorize G09 enablement or close the G08 dependency.
- Official reference: [Cloudflare Workers Request API](https://developers.cloudflare.com/workers/runtime-apis/request/) (last updated 2026-11-18 at time of verification).

### Independent narrow review

- Verdict: **ACCEPT** for this redirect compatibility change only. The reviewer verified the code path, regression wiring and official Workers Request documentation. The injected-fetch test does not simulate Cloudflare redirect behavior; no deployed runtime behavior is claimed.
- No deployment or external call occurred. G08 and overall Engineering RC gaps remain open.
