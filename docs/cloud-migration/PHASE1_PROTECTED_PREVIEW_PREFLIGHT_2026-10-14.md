# AI PM Radar v2.1 — Phase 1.1 Protected Cloud Preview preflight
Date: 2026-10-14 HKT
Status: PARTIAL / BLOCKED BEFORE REMOTE DEPLOYMENT (SECURITY GATE)

## Requested outcome
Owner requested Phase 1.1 — protected Cloudflare Preview under US$0 budget, isolated from `radar.lamlab.cc`; deploy synthetic Worker/D1, verify real Cloudflare Access, revision safety, DB persistence, and cloud runtime quotas. Do not transfer real data, change Cloudflare production policies/domains, or call Gemini.

## Verified locally
- Remote Mac online; Radar origin still on 127.0.0.1:4320 and helper on 127.0.0.1:4310, with dedicated existing Tunnel unchanged.
- Wrangler v4.149.0 authenticated to an existing Cloudflare account through cached OAuth; `wrangler whoami` lists account/read, workers/write, d1/write, pages/write, zone/read and several other scopes. **No Access application/policy management permission appears in this output.** Neither Cloudflare OAuth tokens nor the allowed account email were displayed or copied into this report.
- The connected tools contain no Cloudflare Zero Trust/Access management connector. No dashboard session or explicit verified Access policy was available through the integration.
- Existing `experiments/cloudflare-sync-spike/` passes 20/20 local Wrangler+D1 signed synthetic JWT/revision/approval tests from Phase 1.0. This proves local code behavior, not cloud Access policy, production-record completeness, or actual quota fit.
- Added `experiments/cloudflare-sync-spike/wrangler-preview-locked.jsonc`: isolated worker name, `workers_dev:false`, `preview_urls:false`, and no public routes, D1 binding, secrets or scheduled triggers. Added `check-preview-preflight.mjs` to fail-closed check those fields. Test PASS. **These settings deliberately do NOT create an accessible Preview.**
- No deploy, remote D1, Cloudflare Access app/policy, DNS, tunnel, subscription, billing resource, real content or API key was changed in this turn.

## Critical blocker / security decision
Cloudflare can protect an entire Worker, including its Preview endpoints, with an Access application. However, current Wrangler scopes do not show the permission needed to create or inspect Access policies. A new Worker deployed with default `workers.dev` routing could expose a public endpoint; hostname-only Access can also leave preview URLs unprotected. Do NOT publish the prototype or enable routes until the Access application, subject allowlist and preview coverage have been verified.

The Phase 1.0 Worker is a minimal prototype: source record shape validator, Access JWKS rotation, append-only events and immutable evidence/approval/handoff semantics are not production-ready. Even after Access is configured, only synthetic data should be deployed for initial smoke tests.

## Minimum Owner action / permission (do not share secrets in chat)
1. Open Cloudflare Dashboard > Zero Trust > Access controls > Applications. Verify that the account is the same account as Wrangler and that the Free plan is active, with no plan upgrade.
2. Provide an explicitly authorized way to manage Access apps/policies: either create the Preview Access application in Dashboard personally, or grant narrowly scoped **Cloudflare Access Apps and Policies: Edit** and (if needed) read permission to the deployment identity. Do not paste API tokens, JWT cookies, or passwords into chat.
3. The preferred protected target is the ENTIRE isolated Worker (not only one hostname). Configure an allow policy limited to the Owner's intended email; test unauthorized identities are denied. Protect production and Preview routes including possible `workers.dev` aliases. If the Worker must exist before selecting it, create it first in a DISABLED/UNEXPOSED state with `workers_dev:false` and `preview_urls:false`, then attach Access and only enable a routable Preview after the policy has been verified.
4. Confirm that the new project is on a Free-compatible plan and has no usage-based paid upgrades, automatic model calls, or unrestricted network access. Reject any billing prompt requiring a paid plan.

## Resume plan after Access gate passes (separate checkpoint)
A. Create dedicated `radar-phase11` Worker/D1 using only synthetic records; leave existing `radar.lamlab.cc` unchanged. Do not expose preview until Access confirmed.
B. Replace fixture/static JWT public keys with production-appropriate Cloudflare Access JWKS verification and rotation; test issuer, aud, expiry, signature and exact owner allowlist on every request.
C. Verify anonymous requests (including URL aliases) are denied; owner can read/write; second synthetic identity cannot read or mutate; stale revision produces 409; edit invalidates approval. Confirm D1 persists across multiple requests.
D. Measure hosted Worker CPU/wall time, D1 operations and costs against Free plan; stop on quota or policy violations.
E. Keep source URL fetch, Gemini, real data migration, automatic scheduling, full Source Library v4 and production DNS cutover explicitly OUT OF SCOPE until separately accepted.

## References
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/choose-application-type/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

## Final result
Phase 1.1 **preflight COMPLETE**; actual **Protected Cloud Preview BLOCKED**, not silently deployed. No claims of Mac-off acceptance, external Access policies, live D1 persistence, Gemini or cloud latency. Waiting for user to enable Access app/policy administration through an authorized method.

## 2026-10-14 19:29 HKT — Owner follow-up: private Worker provisioned without public ingress

Owner requested next action. Current Cloudflare account confirmed authenticated by Wrangler OAuth; a READ-only deployment-name check returned Worker not found (code 10007). `wrangler deploy --config experiments/cloudflare-sync-spike/wrangler-preview-locked.jsonc --dry-run` succeeded, showing no bindings. Then authorized dark deployment succeeded:

- Worker: `radar-phase11-preview-locked` (isolated new name; no replacement of Radar production).
- Deployment version: `909aa9dd-d18a-4a58-b3b5-9e626c77da51`.
- Wrangler output: `No targets deployed for radar-phase11-preview-locked`.
- Worker configuration explicitly declares `workers_dev: false`, `preview_urls: false`, with NO routes, NO triggers, NO D1 binding or secrets.
- Cloudflare `wrangler deployments list` confirmed the single uploaded version. Local `check-preview-preflight.mjs` PASS. Production static build timestamp unchanged; old Radar origin and helper remained listening.
- Inaccessible Worker is **NOT** a live protected Preview, a Mac-off test or an active database. It intentionally does not have a public URL; the API handler returns misconfigured DB if invoked without D1, and no source is imported. No Gemini token, customer data, keys or Auth policy changes.

### Manual Access activation checkpoint (before ANY public ingress)
1. Open Cloudflare Dashboard > **Workers & Pages** > `radar-phase11-preview-locked` > **Access** (Worker-specific tab, NOT account-wide "Protect all Workers").
2. Click **Protect this Worker behind Access**; select **All traffic** (production + previews), NOT `Previews only`.
3. Choose a policy with an explicit allowed Owner email identity (prefer exact verified email, not whole domain or Everyone; account membership is wider than one person's identity if other members exist). If necessary, edit the rule under Zero Trust > Access controls > Applications before any public route is enabled.
4. Confirm **Apply Access** and verify this Worker shows Access ENABLED for All traffic. Avoid enabling `workers.dev`, Preview URLs, public routes or billed add-ons yet.
5. Tell the assistant only `Access All traffic enabled for radar-phase11-preview-locked`; optionally send a redacted screenshot (hide user email/IDs). Never paste Auth JWT, API tokens, passwords, private key or cookies.

Once Access is verifiably enabled, operator may prepare isolated D1 Free and a deliberately exposed Preview URL under the Worker-level Access policy, then test unauthed redirect/denial and separate identity tokens, quotas, and synthetic data. This requires checking the precise new hosted URL and a fail-closed server-auth check before any user data migration. NO cutover to radar.lamlab.cc without a separately authorized release.

Official Cloudflare Worker-level Access guide, updated 2026-10-12: https://developers.cloudflare.com/workers/configuration/cloudflare-access/ . Cloudflare says Worker-level Access protects all domains, workers.dev and preview URLs; select All traffic for both production and previews. It also states management permissions are needed for Workers and Access apps.

## Owner screenshot follow-up — 2026-10-14 ~19:33 HKT

Owner-provided screenshot shows `radar-phase11-preview-locked` in the Worker **Access** tab, All traffic selected, with an Allow policy. The selected policy appears to use `Email domain` selector (some values redacted); screenshot alone cannot prove exact-email exclusivity. An `Email domain` rule targeting a broad email provider such as `gmail.com` would authorize many identities, not just the Owner. **Do not expose Workers URLs until exact-email or Cloudflare-account-only allow policy has been corrected and reverified.** Do not copy AUD/JWKS or bearer tokens from screenshot.

Read-only Cloudflare CLI inspection confirmed D1 list was initially empty. Created one isolated synthetic D1 database named `radar-phase11-synthetic-20261014` in APAC region. This resource was created under Owner's authorized Phase 1.1 technical Preview scope, without changing billing plan, production DB or domain. Existing dark Worker remains unbound and unexposed: `workers_dev:false`, `preview_urls:false`, no public routes. Cloudflare Access Worker-level All traffic is also active according to Owner UI screenshot, but hosted anonymous denial has NOT been tested since there is no public URL.

Applied only `experiments/cloudflare-sync-spike/schema.sql` to the NEW remote D1; no real SourceRecord. Remote D1 schema created successfully, DB size initially ~24 KiB, empty table.

Cross-request APAC D1 smoke test using **only a fictional single record**:
- INSERT synthetic source: success.
- Separate remote SELECT read back record with revision=1.
- CAS revision 1 -> 2: one row updated.
- Stale CAS with expected revision=1: zero rows updated.
- DELETE test row: success.
- Final SELECT COUNT: **0** (empty restored).

This proves actual remote D1 persistence and basic SQL compare-and-swap, not Worker-to-D1 bindings, JWT policy enforcement, iPhone sync, or full SourceRecord approval. No Gemini calls, account plan upgrades, or production changes. Spending not independently confirmed from a billing statement (account quota charges remain subject to Cloudflare Free/Paid plan policies).

### Pending required Owner input (single next gate)
Open `radar-phase11-preview-locked` > Access > Manage access / Manage Access application > edit Allow policy. Replace any broad `Email domain: gmail.com` (or similar) with **Emails: <Owner's exact Cloudflare-login email>**, or use Cloudflare account membership if only the intended person is a member. Ensure no secondary Allow policy widens access. Then send a screenshot showing the policy selector types/action only, with addresses redacted. Once exact scope is validated, continue with Worker-level authenticated Preview binding and full negative authentication tests; do not switch radar.lamlab.cc.

## 2026-10-14 — Phase 1.1 resumed after exact-email Access policy fix

### Scoped remote Preview created and protected
Owner reported correction to exact-email Access Allow policy. Cloudflare Worker-level Access was set to All traffic. The assistant enabled ONLY an isolated workers.dev route for radar-phase11-preview-locked, with no custom domain, Preview URLs, schedules, external API calls or real client data.

Remote Worker: radar-phase11-preview-locked, final deployed version ff46ace4-7194-4d3a-82e1-f99f6e2a1485.
Protected URL: https://radar-phase11-preview-locked.lamms280.workers.dev
Remote D1: radar-phase11-synthetic-20261014 in APAC, DB binding active.
Security env: CLOUD_ACCESS_REQUIRED=true, SYNTHETIC_ONLY=true and SHA256 of authorized Wrangler account email (stored as nonsecret digest only; NO literal email, Access cookie, private key, API token or Gemini key).
Auth: Worker rejects any request without authenticated Cloudflare ctx.access identity and matching email hash. Cannot authenticate by forged HTTP identity headers or local synthetic JWT in cloud mode.
Synthetic upload restriction: accepts only qa_ prefixed source IDs, example.invalid/synthetic source URL and text explicitly containing Synthetic. This is NOT the production complete SourceRecord validator.

### Deployment and test evidence
- Wrangler local synthetic JWT/D1 suite 20/20 PASS; cloud Access.dev context and spoofed-headers checks PASS.
- Playwright Chromium local UAT 8/8 PASS: create, explicit Review, explicit Approval, stale revision 409, edit invalidates Approval, reload, separate browser context reading same D1, and rejecting non-synthetic uploads. 390px: no horizontal overflow or JS page errors.
- Remote anonymous tests after final deploy: HTTP 302 redirect to verified Cloudflare Access login for /, /preview.js and /api/records, including one-record API. No unsecured access to UI, JS or API.
- Remote D1 COUNT remains 0 immediately after deploy; user Owner authenticated testing still pending.
- Original radar.lamlab.cc, its Tunnel, mobile origin and Gemini Helper untouched. No subscribed paid upgrades, real data upload, live model calls, daily update, schedules, Git commit or push.

### Next acceptance gate — Owner action required
1. On Mac Chrome/Safari open https://radar-phase11-preview-locked.lamms280.workers.dev and log in via Access. If user sees 401 despite successful Access login, report screenshot without credentials; it may mean the Access identity differs from CLI owner identity.
2. Press 1. 建立合成來源 (revision 1, needs_review); 2. 人工 Review (revision 2); 3. Approval (revision 3, approved true).
3. Press 測試舊版本衝突 and confirm HTTP 409; press 4. 修改並重設批准 and confirm approved false and needs_review.
4. Open the same URL on iPhone signed into same Access account; refresh and verify same record/revision. For strict Mac-off requirement, user must fully shut down Mac and repeat login, read, and creation of one synthetic record. Assistant must not turn off Owner Mac.
5. Send screenshots showing the synthetic record count/status/revision but no email, JWT, cookie or API token.

Owner's real authenticated Mac/iPhone Cloudflare session, cloud Worker CPU quota performance, and actual Mac-OFF UAT remain PENDING. The live protected Preview is NOT the full Radar application and no real Source Library migration has started.

### Safe rollback
From experiments/cloudflare-sync-spike use the existing wrangler-preview-cloud-closed.jsonc deployment configuration to close workers.dev and previews again; isolated D1 is retained. Deleting remote D1 requires separate Owner approval. Official docs: https://developers.cloudflare.com/workers/configuration/cloudflare-access/

## 2026-10-14 Owner Mac+iPhone screenshot UAT and remote D1 metadata check

The Owner supplied 2 Mac Chrome and 2 iPhone Safari screenshots from the protected synthetic Preview. Both devices displayed:
- PASS: stale expectedRevision denied with HTTP 409.
- Modification and approval reset succeeded with HTTP 200.
The Cloudflare Access-protected page loads on both devices. Screenshots do not display the SourceRecord ID or revision detail below the controls, and do not establish Mac-OFF operation.

The assistant made read-only Cloudflare D1 aggregate SQL queries, retrieving NO email, signed subject, raw text or source IDs:
- total SourceRecords: 2
- min revision: 1, max revision: 11
- needs_review count: 2
- reviewed count: 0
- approved count: 0
- revision distribution: 1 at revision 11 and 1 at revision 1, both needs_review.

Interpretation: actual remote D1 persistence and successful iteration are established; cross-device protected API and status messages are evidenced. Exact same-record/version synchronization across Mac and iPhone remains to verify by comparing source_id and revision on both devices. A Mac shut-down test is also still required, because the screenshots do not show the Mac switched off.

Minimum remaining owner UAT:
1. Mac: scroll to the cloud SourceRecord JSON and note source_id and revision of the selected synthetic record.
2. iPhone: Refresh cloud data; compare the same source_id and revision.
3. Shut Mac fully down, then use iPhone Safari to reload and create ONE synthetic record. Check count increases, and after Mac reboots check the extra record is visible there.
4. Screenshot the QA source_id and revision and record_count if useful, hiding account identity and any authentication information.

Classification: PHASE 1.1 PARTIAL PASS; Mac-OFF, exact record comparison and full production migration are not yet accepted. Original radar.lamlab.cc untouched. No cloud resource created or data modified as part of this inspection.
