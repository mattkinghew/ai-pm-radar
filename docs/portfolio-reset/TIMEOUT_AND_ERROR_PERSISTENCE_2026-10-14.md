# AI PM Radar — Timeout and error-message persistence hotfix (2026-10-14)

## Owner-approved goal
The Owner requested a bounded fix for Gemini request timeouts and loss of diagnostic error copy after Source Inbox reload. Prior production observed one model_timeout at stage provider_timeout, duration 30,007 ms, attempts=1; before this fix, UI stored analysisError but its visible message depended on transient React notice state, so reload showed a generic error.

## Code changes
- scripts/source-fetch-helper.mjs: introduce GEMINI_ANALYSIS_TIMEOUT_MS=60_000 and use only for Gemini fetch. Existing ANALYSIS_TIMEOUT_MS=30_000 for OpenAI unchanged; no new retries or providers.
- scripts/mobile-production-server.mjs: PROXY_TIMEOUT_MS=70_000 (10s beyond Gemini allowance).
- components/SourceInboxWorkbench.tsx: render analysis error description from persisted form.analysisError through existing localized mapping. Map companion_timeout to analysisTimeout as well. method_points_omitted retains its existing warning. No data schema/review/approval changes.
- Tests: budget guards in tests/source-fetch-helper.test.mjs and tests/mobile-production-server.test.mjs.

## Tests
- Full npm test 125/125 PASS; typecheck PASS; validate:data and validate:daily PASS.
- Normal build and build:mobile PASS in isolated /tmp/radar-build-20261013.HV41 (no production files touched during build).
- Synthetic Chromium 390x844 browser E2E: intercepted two 504 responses for model_timeout and companion_timeout. Both showed localized timeout, persisted through manual Save and Reload, source unchanged, zero page errors. No live Gemini invocation. Screenshot evidence/2026-10-14-timeout-message-after-reload.png.

## Deployment 2026-10-14 ~15:02 HKT
Owner authorization: GO 修復 Timeout + 錯誤訊息, in the context of the proposed fix-and-deploy workflow.
- Rollback snapshot: ~/Library/Application Support/AI PM Radar/rollbacks/timeout-message-20261014-150143/
  Contains old deployed out/ (prior 2026-10-14 01:00 revision), out-live-previous/, prior-runtime source-fetch-helper.mjs and mobile-production-server.mjs. The originals are syntax-checked. Neither private .env.local nor tunnel token duplicated.
- Only Radar launcher process and its origin/helper were restarted. Cloudflare Tunnel process remained running.
- New launcher PID=12644, origin PID=12650 (4320), helper PID=12651 (4310) at verification.
- npm run health:mobile PASS. Unauthenticated public /source-inbox/ returns Access 302; direct origin API without JWT returns 401. Helper rejects empty input analysis_body_missing before a model call. Runtime module config confirms Gemini=60000, Proxy=70000, OpenAI=30000 ms. Deployed bundle includes localized timeout copy.
- No live Gemini call, Git commit/push, credentials/Cloudflare policy/schedule changes or formal daily data edits. Production service log: ~/Library/Logs/AI PM Radar/production-timeout-20261014.log.

## Owner UAT / remaining limitations
- Previous failed status persists until a new user-initiated analysis; hard refresh will update code but not re-run the model.
- Owner should refresh https://radar.lamlab.cc/source-inbox/ without clearing IndexedDB, verify saved source, then initiate one explicit AI analysis on public-safe source (provider usage possible).
- The new timeout is a bounded allowance, not proof of model performance. If provider still exceeds 60s, expect model_timeout, retained original source, and specific error copy after reload. No automatic retry.
- Human evidence review/approval and final receiver confirmation remain separate gates. Actual live-model production UAT is PENDING: whole pipeline PARTIAL.
- Detached Radar launcher is not configured to start automatically after Mac reboot; startup settings remain unchanged.
