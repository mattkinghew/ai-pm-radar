# GOALS — Travel Mobile RC1 (Owner 指定版本標籤：2026-10-18 07:30 HKT)
Execution instruction for the project Agent. Source baseline was read-only checked on 2026-10-18 ~02:35 HKT; recheck at execution, do not call it 07:30-verified.

## Global login-blocker policy — AUTH-DEFERRED
- Do not let Cloudflare Access, Vercel SSO, OTP, browser sign-in, Tunnel, vendor token, or upload permission stall feature engineering. Keep existing protection INTACT. Complete source inspection, minimal scoped changes, synthetic fixtures, local unit/integration/browser flows, responsive test, build, artifact allowlist, backup and rollback first.
- If external sign-in is unavailable, record exact blocked checkpoint and error (sanitized), mark external auth/real cloud writes/real cellular UAT/deploy as BLOCKED or UNKNOWN. Continue offline/local-safe tasks and package immutable candidate with SHA and tests.
- Never bypass SSO, loosen RLS, disable Access, hard-code credentials, mock a signed-in state as production PASS, expose 0.0.0.0/private port to public internet, or upload secrets/private data to fix sign-in.
- Later authentication recovery is a separate gate: complete authenticated preview read/write (if authorized), real iPhone Wi-Fi OFF, second-device/restore as relevant, rights check, and rollback; only promote/upload protected preview/production after Owner GO. Missing sign-in must not be reclassified as Completed.
- Existing dirty changes: inspect git status/diff, do not reset/clean/stash/force merge, do not commit/push owner work without explicit permission; prefer isolated candidate and allowlisted build. No employer/client data. One Primary Outcome, <=2 Secondary Outcomes. Avoid unrelated features.
- End with Completed / Partial / Blocked / Unknown / Planned, changed files, test transcript, exact build stamp, local preview and external verification difference, pending GO, and manual travel fallback.

## Project: AI PM Radar Phase 2.0A (active engineering #1)
Canonical: /Users/mattgor/Documents/Daily/ai-pm-radar. Baseline main e9c14c5, 63 pre-existing dirty paths; recheck. Read AGENTS.md, docs/TRAVEL_MOBILE_RELEASE_GOAL_2026-10-18.md, docs/GOAL_PHASE20_MOBILE_CLOUD_INTELLIGENCE_2026-10-18.md and docs/qa/DAILY_10_SOURCE_TO_UI_GAP_2026-10-18.md.

PRIMARY OUTCOME: on iPhone Safari via protected remote Source Inbox, paste a safe public URL/text within 30 seconds, preserve its exact provenance as an unapproved owner-owned draft with an honest save-state receipt, and reopen it after reload; prepare secure synthetic D1 cross-device draft contract without enabling unauthorized live writes.
SECONDARY 1: Surface true latest private candidate counts/date/Top 5,10,20,All with an honest stale label on July static public feed; never publish unapproved October collector drafts. SECONDARY 2: manual approved content_candidate bundle export for Content Ops; mark transport exported, not delivered until signed receiver ACK.

SCOPE/ORDER:
R0. Inspect deployed-origin map and 4320/4310/4482, cloudflared tunnel dependence; 302 Access != Origin PASS, direct wrong-Host 421 not necessarily app failure. Record build SHA, actual static daily feed and secure capabilities.
R1. Mobile quick capture above fold (URL/plain text and existing permitted file input), accessible Save Draft; IndexedDB local receipt clearly LOCAL ONLY, export JSON and import/restore tested. URL-only capture works when extraction blocked; preserve immutable origin and deduplicate retries.
R2. Use existing protected D1 experiment patterns only with synthetic data: same-origin authenticated owner scope, list/create/get/compare-and-swap revision, idempotency, origin/CSRF, invalid/oversized, unauthorized/cross-owner denied. Keep `cloud_write_authorized=false` for real SourceRecord data, and get explicit source-specific Owner GO before new real cloud writes. Do not introduce a parallel production backend.
R3. Optional AI enrichment with evidence locators and Unknown status; provider failure must not delete draft or auto-approve. Do not add costs/keys.
R4. Verify collectors independently: date/run ID, count fetched/deduped/needs_review/approved/published and age; historical 55 local candidates and October 16–17 10 selected cloud drafts do not prove public updates. Show honest UI filters/freshness, never pad to fixed 10 published.
R5. Generate sanitized preview artifacts; only after auth recovery and Owner GO perform actual cellular login, secure cloud save/second-device readback and Mac-offline test.

AC: 390px UI no overflow; <=30s capture; provenance intact, reliable local export/import; synthetic D1 negative tests pass; dated candidate vs approved/public distinction, no false cloud receipt, documented signed or manual Content Ops handoff. Tests: npm test, npm run typecheck, npm run validate:data, npm run validate:daily, npm run build:mobile, npm run health:mobile (where scripts exist). Real cloud cross-device is BLOCKED/UNKNOWN until authorized external proof.
NON-GOALS: opaque new scoring model, forced 10 published, mass crawler rewrite, disabling Access, turning on production cloud writing, live auto-approval, new paid provider, broad deployment.
