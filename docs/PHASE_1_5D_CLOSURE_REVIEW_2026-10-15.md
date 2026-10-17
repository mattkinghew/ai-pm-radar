# AI PM Radar — Phase 1.5D Closure Review / Single Real-Source Gate

Date: 2026-10-15
Decision: LOCAL SECURITY + INTAKE CANDIDATE PASS; **PHASE 1.5D PARTIAL (one receiver E2E gate remains)**.
Not authorized by this decision: deployment, D1 writes, Git commit/push, scheduling, new adapters, additional API costs.

## Proven and scope of PASS
- Owner conversation explicitly reported PASS for the Markdown/VTT evidence-picker UAT on 2026-10-15.
- Local project: branch main, HEAD 43882ad3c6aab0da5c0785677910338f8b7ddc51, package 0.4.0, uncommitted changes preserved.
- 202/202 Radar tests, 21/21 phase-1.5D focused tests, TypeScript, data validators, build and mobile build passed in immediately preceding engineering slice (dated logs). Closure review separately re-ran focused tests 21/21 PASS.
- Local source page HTTP 200: http://127.0.0.1:3000/source-inbox/
- Content Ops Studio 0.9.5 receiver: 25/25 focused handoff/source tests PASS this closure review; runtime started at http://127.0.0.1:5173/ on loopback only.
- Synthetic isolated Radar→Content Ops receiver contract smoke from prior slice: 1 candidate, 0 duplicate, status needs_review. THIS DOES NOT MEAN A REAL RECEIVER IMPORT.
- SHA-256 covers controlled UI export path; old direct legacy helper exports and v1 fixture format are NOT cryptographically authenticated without explicit secure wrappers. SHA-256 of writable local data alone does not authenticate reviewer identity or authorization.

## One remaining original acceptance gate
**One public or properly licensed actual article** must be human reviewed, source reusable approved, independently approved as a content_candidate handoff, exported as SHA-256-sealed delivery, downloaded/read back, imported into a designated isolated test Brand through Content Ops UI, and re-import/duplicate/reload checked.

This step requires actual Owner review and receiver-side evidence; do not simulate, preapprove or automatically mark import_confirmed.

## Exact Owner UAT route (both localhost)
A. On Radar: http://127.0.0.1:3000/source-inbox/
1. First download local Inbox backup. Select ONE real public article (previously approved accessible entry such as an existing W3C article is acceptable). Do NOT use employer/customer/confidential content.
2. Confirm source title, original/final URL, captured_at, verbatim quote and claim, then explicitly mark the source reviewed and approve **for reusable Source Library**. The daily publishing approval is a separate gate.
3. In http://127.0.0.1:3000/research/ open that approved Library source.
4. In its Handoff workspace choose `content_candidate → Build draft`. Fill the intended audience/derived fields and human notes; click Mark reviewed then Approve (this is independent of source approval).
5. Create Delivery Package. In Export Options download **Content Ops Intake JSON** (not plain DeliveryPackage JSON). Verify JSON root `packageType="content-ops-handoff", version=1, sourceSystem="ai_pm_radar"`; preserve package_id, source_record_id and SHA-256 metadata.

B. On Content Ops: http://127.0.0.1:5173/
6. Download workspace backup before changing anything. Create/use an isolated synthetic test Brand, not a live business Brand.
7. Open Inbox / Sources → **More intake options · manual form and handoff package** → **Import Handoff Package**. Choose the JSON file exported from Radar. Click Preview package; confirm one content_candidate, chosen Brand and source identity.
8. Click Import to Inbox ONCE. Confirm the new Source item has `status=needs_review`, matching externalId/sourceSystem/title and preserved `metadata.radarDelivery`. Ensure no Content Item is approved/published by import.
9. Reload Content Ops. Confirm the item persists under the selected test Brand; other Brands do not show it. Preview the same file again and verify it is recognized as a duplicate. **Do not** tick Import anyway.
10. Record evidence: source_record_id, source URL/captured_at, exact evidence quote and locator, handoff_id, package_id, full package_sha256, Content Ops Source ID + Brand, receipt/importedAt, duplicate count. The Radar exported state is not the Content Ops receipt.
11. Only if the owner actually observed successful receipt, mark local delivery `import_confirmed` manually. Retain screenshots/notes in a clean-room location with no secrets.

## Stop / failure conditions
- No saved draft backup, missing evidence, stale or legacy unsealed approval, browser console error, Content Ops wrong Brand, invalid JSON or changed package => STOP, do not bypass approvals or auto-approve.
- If local servers are down restart in separate Terminals:
  Radar: `cd /Users/mattgor/Documents/Daily/ai-pm-radar && npm run dev:local`
  Content Ops: `cd "/Users/mattgor/Documents/ChatGPT/Content Ops Studio" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`
- Localhost URLs are only reachable on the Mac; `https://radar.lamlab.cc` has NOT been redeployed and may not include these changes.

## Closure decision criteria
Upon signed-off Owner evidence of step 1–11 (and no security blockers), mark `Phase 1.5D — Local Closure ACCEPTED`; then request SEPARATE authorization for any Git/release/deploy or Phase 1.6. Do not convert automated test PASS into real-source E2E PASS.

No code changed in this closure review; only this document was added. No Cloudflare or production changes.
