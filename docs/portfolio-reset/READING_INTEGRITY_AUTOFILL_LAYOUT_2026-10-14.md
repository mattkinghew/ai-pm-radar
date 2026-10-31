# AI PM Radar — Article summary integrity, safe autofill, card layout (2026-10-14)

## Owner observations
Screenshots of the authenticated production website showed: generated Chinese source-fact snippets did not represent an accurate full-article synthesis; some inference fields still displayed English; the daily candidate export was blocked because manual review/approval, a source name or creator, and Evidence Grade were incomplete; homepage Top 5 right-hand card overran its column with long non-wrapping risk text.

Important deployment distinction: production out/source-inbox/index.html was built at 2026-10-14 15:00 HKT while the reading-first zh-Hant prompt and simplified Review UI were modified locally after 16:00 and were NOT deployed. Screenshots do not prove the new reading-first prompt failed. Earlier local Gemini success confirms provider returned a draft, but neither completeness nor factual accuracy was independently established.

## Primary outcome
Make the existing article intake → Chinese quick read → source-backed claim review → manual approval → daily candidate export path more reliable and less repetitive. No schema migrations, no additional model calls, no automatic evidence grading, no automatic approval.

## Changes made (LOCAL CANDIDATE, not deployed)
1. scripts/source-fetch-helper.mjs: strengthen existing zh-Hant narrative instruction. A usable summary must read the entire body, synthesize 2–4 substantive Chinese sentences, cover at least two distinct body details when possible, and not paraphrase only the headline / menu / 9-guide table of contents. When imported text lacks adequate body, explicitly flag incompleteness instead of making up facts. Existing verbatim evidence and method-excerpt matching remain unchanged.
2. components/SourceInboxWorkbench.tsx: for NEW captured URL or pasted text with a URL, when explicit creator metadata is missing, prefill the source-site DOMAIN derived from the validated URL; do not fabricate a human author or publisher brand. Never replace an explicitly known creator. For EXISTING saved drafts with an empty creator, add a one-click domain-fill button inside Review and a provenance explanation. All other exported gates intact. Grade starts as ungraded and always requires the human to select A/B/C. Review and approval remain explicit, independent operations.
3. components/SourceInboxWorkbench.tsx and lib/i18n.ts: the reading card states that the AI can only summarize the imported body, displays imported character count and warns about truncated headline/nav-only capture. This is a content coverage warning, NOT a full-text completeness detector.
4. app/globals.css: prevent long hero Top 5 text, URLs, risk notes, and card content from forcing min-content width/nowrap overflow; wrap card copy and bound columns; adjust large title to responsive sizes. Keep site palette, source forms, and identity consistent.
5. tests/source-fetch-helper.test.mjs: regression assertions about Chinese synthesis, title-only/incomplete source behavior, and original-language verbatim evidence requirements.

## Verification
- npm test: 125/125 PASS.
- npm run typecheck, validate:data, validate:daily: PASS.
- npm run build:mobile in isolated /tmp/radar-build-20261013.HV41: PASS. Main production out/ unchanged.
- Playwright headless Chromium homepage at 360,390,768,1280,1536: PASS; document scroll width equals viewport width; hero right edge stays within viewport. Evidence: evidence/2026-10-14-home-cards-no-overflow-1536.png.
- Playwright simulated new-import 390 workflow: pasting fictional content + URL → one MOCK analysis → Chinese summary and source domain example.org in Review, Evidence Grade ungraded → human selects C and marks reviewed → approves and downloads single-article candidate JSON → reload retains approval, source and grade. No paid provider calls. Evidence: evidence/2026-10-14-review-source-domain-390.png.
- Playwright existing-draft 390: paste without URL, add URL in source details, Review initially creator empty, use domain button → aiposthub.com entered with explicit not-verified-author explanation; Grade still ungraded; Save/Reload persist. PASS.
- Existing reading-first 390 E2E also validated reviewed approval and reload (2026-10-14 earlier report).
- No provider keys/Access/Tunnel/schedule changes, no Git stage/commit/push, no live Gemini, no official daily data edits.

## Limitations and release gate
- Prompt improvements are NOT an accuracy guarantee. The Owner must confirm whether the REAL import contains enough article BODY rather than titles/nav and evaluate new live draft against the original article, after controlled deployment. A provider may still ignore the prompt.
- Existing saved English drafts are preserved verbatim; the new Chinese instruction only applies to a NEW explicit AI analysis request and can consume model usage.
- Domain is traceable source WEBSITE identification, not a verified creator/publisher; manual review must check it. Evidence grade C is an example in synthetic QA, not an automatic default or grading recommendation.
- The production homepage currently shows an outdated July 2 daily Top 5 from its static dataset. This UI/layout repair does not refresh or publish current daily data.
- This v2 is NOT DEPLOYED and awaits explicit Owner deployment approval; production currently continues running its 15:00 stable build. Owner browser UAT after deployment is PENDING.

## Owner-authorized reading interface v2 production deployment — 2026-10-14 ~17:54 HKT

Owner explicitly authorized: GO 部署閱讀介面 v2.

- Previous protected static build was dated 2026-10-14 15:00 HKT; running Radar launcher PID 12644, origin PID 12650, helper PID 12651.
- Backup: ~/Library/Application Support/AI PM Radar/rollbacks/reading-v2-20261014-175254/
  - out/: previous deployed static build.
  - out-live-previous/: previous deployed static files moved at cutover.
  - source-fetch-helper.mjs.prior-runtime: syntax-checked reconstruction of previous deployed helper, removing only four reading v1/v2 prompt sentences while retaining the 422 evidence fix and Gemini 60-second timeout.
  - source-fetch-helper.mjs.candidate: new helper source; NO .env.local, API keys or tunnel token were copied.
- Final validation before deployment: 125/125 tests PASS; typecheck, validate:data, validate:daily PASS; isolated npm run build:mobile PASS. Isolated build folder /tmp/radar-build-20261013.HV41 synced from current Radar source.
- Protected static site staged, old Radar launcher terminated, out/ directories swapped, Radar-only launcher restarted. New launcher PID 32639, origin PID 32654 at 4320, helper PID 32655 at 4310. Cloudflare Tunnel and Access configuration were not changed.
- npm run health:mobile PASS. Production JS bundle includes source coverage notice and domain autofill. Helper includes original-language verbatim evidence, zh-Hant summary, full-article synthesis instruction, Gemini timeout 60000 and proxy timeout 70000 ms.
- Cloudflare Access unauthenticated public /source-inbox/ returns 302 login redirect; direct origin API without a JWT returns 401. Helper malformed empty analysis input returns analysis_body_missing BEFORE any paid provider call. NO live Gemini requests initiated during deployment.
- Deployment log: ~/Library/Logs/AI PM Radar/production-reading-v2-20261014.log.
- No Git commit/stage/push, formal daily updates, credential changes, runner schedule changes, or other deployments. Protected website remains reachable; detached Radar launcher does not auto-start after Mac reboot.
- Actual Owner authenticated-browser and live-provider acceptance PENDING. The zh-Hant prompt does not auto-translate persisted English drafts; Owner must explicitly request a NEW AI analysis, potentially consuming provider quota. The source must include enough article body to summarize; Owner must compare output against primary source and manually grade/approve evidence. Deployment health PASS; whole end-to-end product UAT PARTIAL.
