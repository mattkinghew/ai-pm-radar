# Phase 1.5C — Real-source Sync Governance & Readiness
Date: 2026-10-15 HKT

STATUS: ACCESS-PROTECTED READ-ONLY GOVERNANCE PREVIEW DEPLOYED / LOCAL QA PASS / OWNER SIGNED-IN MAC/IPHONE UAT PENDING / REAL CLOUD UPLOAD NOT AUTHORIZED.

## Owner scope and architecture
Owner said "pass, next Real-source Sync Governance & Readiness" following Phase 1.5B. The previous Owner-reported Mac/iPhone synthetic UAT PASS was documented, while the synthetic D1 observed afterward was empty (0/0/0). This does not reconstruct the Owner's authenticated session history. Phase1.5C therefore creates an OFFLINE governance readiness gate for a locally selected original SourceRecord v2, NOT a live real-source upload workflow.

Live URL: https://radar-phase13-one-article-dark.lamms280.workers.dev/real-source-readiness/
Worker: radar-phase13-one-article-dark
New deployed version ID: e1484f3f-3f00-4691-a48f-01db310691fe
Previous rollback version: 803cf61c-b573-45e0-b9eb-dcea31d72861

The existing Cloudflare Access All-traffic Owner policy protects this route. The Worker verifies exact Owner identity before returning HTML, app.js or engine.js. The browser page uses CSP connect-src none, form-action none and frame-ancestors none, so source JSON contents and checkbox status are processed ONLY in temporary local browser memory. No localStorage, IndexedDB, telemetry, source POST, fetch to a remote AI or persistent user data service. Files can be downloaded by the Owner to their chosen local directory. The actual React Source Inbox includes a link to this offline gate.

## Real SourceRecord v2 governance gate
1. Owner selects one full local JSON. Strict local checks include source ID/version, material_status=captured, source URL/title/creator/captured time/metadata, required arrays, analysis schema, confidence, Review/Approval status and original body.
2. Each Evidence text_reference from source evidence and claim-level evidence must exactly occur within raw text/transcript. Missing, unsupported or unverifiable evidence produces BLOCKED; missing provenance or human review can produce UNKNOWN. Claims may still be factually wrong even with matched quotes.
3. Conservative risk-indicator patterns flag email addresses, plausible API secrets, HKID, HK mobile numbers and confidentiality keywords. This is NOT a complete PII/DLP/copyright scan; false negatives and false positives are possible. Flagged content produces BLOCKED rather than automatic clearance.
4. Owner downloads FULL ORIGINAL JSON bytes and must reselect the file to verify byte-level SHA256. Different content or incomplete backup produces HOLD. Downloaded files and proof of durable restoration are Owner responsibilities; file chooser and SHA alone do not prove disaster recovery.
5. Nine independent HUMAN attestations: rights to store/transform full source (not merely public visibility); lawful purpose and minimization; manual scan of personal information; no confidential employer/customer content; human Evidence review; local backup re-import; initial seven-day retention; provider Time Travel residual acknowledgement; named controller/reviewer/deletion responsibility.
6. Evaluation returns HOLD with BLOCKED, UNKNOWN and pending human controls, OR LOCAL_GOVERNANCE_REVIEWED. Both ALWAYS return cloud_write_authorized=false and real_upload_enabled=false. Even a PASS is a request for a fresh per-source Owner approval, never automatic upload.
7. Downloadable governance report contains only policy version, SourceRecord ID and original file SHA256, risk indicator names and outcome/attestation codes, no full SourceRecord body, URL, Evidence quotation, creator name or rights narrative. This report is self-attestation, not a server-signed evidence log or legal opinion.
8. Reopening/reloading the page clears all file and attestation state. The status/metadata remain local and are not stored in Radar IndexedDB or Cloudflare D1.

## Evidence / Assumption / Unknown
| Dimension | Evidence verified | Assumption | Unknown / next gate |
| --- | --- | --- | --- |
| Source authenticity | v2 structure and provenance fields checked | Provided metadata authentic | Author/license authenticity external |
| Claim accuracy | Evidence quote appears verbatim in source | Quote correctly supports claim | Semantics and independent source truth |
| Rights | rights_note present; Owner explicitly attests | User has actual permission | License scope and permitted cloud processing |
| Sensitive data | Pattern-based conservative DLP, manual checkboxes | Manual review performed thoroughly | Unrecognized PII, images, unstructured secrets |
| Backup | Exact original full byte SHA256 matches selected backup | Backup is durably stored | Restore under device loss and revocation |
| Review/Approval | Previous reviewed/approved state flagged UNKNOWN | Reviewer has authority | Immutable cloud consent ledger absent |
| Cross-device sync | Prior synthetic tests had 409/CAS, per-article history | Engine transferable | Real-source signed-in CAS and conflict UAT not authorized |
| Retention | Original one-article D1 retains 7-day due timestamp | Hourly cascade purge works | Live deletion at Oct22 pending; D1 Time Travel residual |
| Security | Access is verified before serving resources; CSP forbids network calls | Current policy remains correctly configured | Legal DPIA/data residency/processor/production reviews |

## Files changed
- experiments/phase15c-real-governance/engine.mjs — pure, fail-closed policy engine and sensitivity risk hints.
- experiments/phase15c-real-governance/test-engine.mjs — 10 policy unit/negative tests.
- experiments/phase15c-real-governance/pilot-ui/index.html, app.js, embedded.mjs and build-ui.mjs — static local-only review UI, SHA256 backup and redacted report.
- experiments/phase15c-real-governance/test-browser-local.mjs — real Chromium Mac and iPhone separate contexts with mocked Access, zero source-content network calls and no database access.
- experiments/phase13-one-article/worker.mjs — three static governance routes behind Owner identity; no real source POST/PUT.
- components/OneArticleCloudWorkspacePanel.tsx — new protected governance page link from the actual React Source Inbox.
- experiments/phase13-one-article/wrangler-phase15b-synthetic-protected.jsonc — explicit REAL_SOURCE_SYNC_ENABLED=false; general real upload and controlled commit remain OFF. Existing synthetic-only D1 binding unchanged.

## Validation and release evidence
- Full Radar npm test: 187/187 PASS. Typecheck, validate:data and validate:daily PASS.
- Existing pilot Worker tests: 13/13 PASS; legacy read-only Chromium page: 2/2 PASS.
- Phase1.5 multi-source synthetic service tests: 12/12 PASS; actual independent Chromium Mac/iPhone simulated sync create/update/409/delete flow PASS.
- Phase1.5C policy engine: 10/10 PASS, including malformed records, missing or misleading Evidence, bad backup, inadequate provenance, prior approvals, sensitive email/HKID/mobile/API-secret examples and incomplete required v2 fields.
- Actual Mac/iPhone Chromium governance UI PASS: original JSON import, downloaded byte-identical backup and file chooser readback, tampered backup BLOCKED, all nine attestations leading to local-only PASS, metadata-only report, no real upload authority, automatic state clearing on reload, sensitive content BLOCKED, responsive 390/768/1280 no overflow, zero JavaScript exceptions. Only same-origin HTML/JS GET requests, no content POST/PUT.
- Isolated Next.js mobile build PASS and original actual React Source Inbox independent browser regression PASS. Production out not rebuilt.
- Protected Cloudflare deployment version e1484f3f-3f00-4691-a48f-01db310691fe. Postdeployment anonymous Cloudflare Access 22/22 GET/POST paths BLOCKED (HTTP302), including new HTML, JS and engine.
- Independent read-only D1 postdeploy verification: original real clean-room article 1 document / 2 revisions / 2 events, Revision2 SHA 9249bd0181fd7197d93ad6f64f5f689cb4bca3eb1c3faf171adab116c0f7ed13 and original expiry 2026-10-22T06:12:29.952Z (14:12:29 HKT) unchanged.
- Separate synthetic Phase1.5B D1 observed current 0 documents / 0 revisions / 0 events. No new D1, live write or original source migration in Phase1.5C.
- Official radar.lamlab.cc protected Mac origin localhost:4320 and companion helper normal, original production source-inbox build timestamp unchanged 2026-10-14 17:53:25. No Git commit/stash/reset/push, paid plan change, new model requests or Access policy relaxation.

## Owner UAT
1. Open the URL on Mac after Cloudflare Access login. Confirm explicit statement REAL SOURCE CLOUD UPLOAD OFF and no submit/upload action.
2. Select one PUBLIC-SAFE, Owner-authored clean-room SourceRecord v2 JSON; do not select employer or customer confidential information.
3. Confirm source ID and SHA, blocked/unknown and sensitivity flags. Page must not display complete raw text.
4. Download the full original file and select it again; SHA should PASS. Deliberately select a modified file first to confirm BLOCKED.
5. Check only truly justified human attestations; unresolved rights/PII cases must remain HOLD. Even with all conditions met, expect LOCAL_GOVERNANCE_REVIEWED but cloud_write_authorized=false.
6. Download the redacted governance report. Verify no original raw text, full URLs, creator identity or credentials. Reload to ensure source and checkboxes vanish. Repeat viewport check on iPhone.
7. Keep current multi-source synthetic pilot separate; it is allowed to persist only six exact fixed demo fixtures, not arbitrary real data.

## Unresolved / risk
- Owner signed-in real Mac/iPhone UAT of Phase1.5C PENDING. Simulated Owner browser does not prove actual Access authentication of all Owner devices.
- This workflow has NO immutable consent ledger, no independent license/PII auditor, no approved per-source cloud write, and no formal data-protection legal review. There is no real-source automatic clearing.
- At/after 2026-10-22 14:12 HKT, perform a separate real D1 expiry/cascade delete verification. D1 Time Travel residual may remain under account-specific retention.
- Next possible Phase1.5D is a per-source signed approval/read-only shadow decision with independent rights/privacy evidence and full backup/restore proof. Any actual non-synthetic upload or cloud permission change requires a NEW explicit Owner GO.
- Emergency security rollback: deploy experiments/phase13-one-article/wrangler-dark.jsonc to disable public ingress, leaving both D1s intact. Prior release version 803cf61c-b573-45e0-b9eb-dcea31d72861 is also a scoped rollback option.

## Phase 1.5D continuation — Owner-reported PASS (2026-10-15)
Owner replied "pass, 下一個階段"; this records Owner-reported Phase1.5C acceptance, not independently captured signed-in evidence. Phase1.5D deployed offline exact-byte SourceRecord + governance report Shadow Approval workflow under Cloudflare Access. Review candidate lasts 24 hours by local clock but never authorizes a real article upload. Worker 0c55a650-f9b8-4129-a4ac-190a5fa51a08, anonymous access 29/29 blocked, original real D1 1/2/2 and original expiry unchanged, synthetic D1 0/0/0. Full UAT and limitations: PHASE15D_PER_SOURCE_APPROVAL_SHADOW_ONBOARDING_2026-10-15.md.
