# AI PM Radar v2.1 — Phase 1.2B Cloud Source Sync Integration
Date: 2026-10-15 HKT
Status: DEPLOYED TO ACCESS-PROTECTED SYNTHETIC PREVIEW; LOCAL QA PASS; OWNER LIVE MAC/IPHONE UAT PENDING.
Production radar.lamlab.cc remains unchanged.

## Cloud deployment
- Existing isolated Worker: radar-phase11-preview-locked.
- New UAT page: https://radar-phase11-preview-locked.lamms280.workers.dev/cloud-sync/
- API namespace: /api/cloud/*, including health, fixture, list, read, create, review, approve-daily, approve-reuse, edit, history, immutable Source Library v4 snapshot read.
- New Worker version: d4a5cf91-1ecc-440f-9618-c9e604a8a76a.
- Prior Worker version for rollback: ff46ace4-7194-4d3a-82e1-f99f6e2a1485.
- Existing APAC D1: radar-phase11-synthetic-20261014. Additive v1.2 tables: cloud_source_heads, cloud_source_revisions, cloud_source_review_events, cloud_library_snapshots. Existing source_items still held 2 Phase 1.1 synthetic records when checked before and after schema migration. New tables initially empty.
- D1 SQL backup before schema: ~/Library/Application Support/AI PM Radar/cloud-phase12-backups/phase11-synthetic-d1-pre-v12-20261015.sql; restricted chmod 600 and directory chmod 700. This backup contains synthetic test data and is not for public sharing.
- Cloudflare Access Worker-level All traffic remains enabled. Signed ctx.access.getIdentity verified and bound to allowed owner email SHA256, without embedding plaintext email or tokens.
- Synthetic-only guard permits only predetermined, fully structured SourceRecord v2 test text and two canned summaries. Arbitrary article text or URL cannot be submitted; 20 full synthetic records per authenticated owner maximum.
- New routes preserve existing Phase 1.1 /, /preview.js, /api/records. No custom domain, scheduled tasks, Gemini, production APIs or real data migration.

## Security evidence
After deployment, unauthenticated requests to /, /preview.js, /api/records, /cloud-sync/, /cloud-sync/app.js, /api/cloud/health, /api/cloud/fixture and /api/cloud/records all returned 302 to verified Cloudflare Access login. New cloud API additionally requires Access-supplied identity and pinned email digest; browser-supplied identity headers cannot bypass authentication. JSON content type, same-origin request validation and 100KB request cap enforced. D1 has no PostgreSQL RLS; every application read/write is explicitly owner-scoped.

## Functional design
- cloud-api.mjs imports real project SourceRecord v2, Source Library v4, exact evidence and daily candidate blockers; not merely a reduced toy source validation contract.
- schema-v12.sql stores versioned SourceRecord snapshots, human Review and separately scoped Daily/Library approval events, history immutability via triggers, CAS expectedRevision, per-owner keys and approved v4 Library snapshots.
- Writes use D1 transactional batch with conditional CAS and history insertion. Simultaneous same-revision edits: only one succeeds, the other returns HTTP 409.
- Cloud UAT page cloud-sync.html / cloud-sync-client.js supports creation, review, both independent approvals, controlled synthetic edit, 409 warning, history, Library v4 snapshot, reload and cross-device select by source ID.
- Editing a reviewed/approved source resets CURRENT review/daily/reuse approvals, while preserving previous immutable historical Library v4 snapshots. Downstream consumers MUST check the current fingerprint and approval event, not merely the presence of an old snapshot.

## Tests
- Root Radar npm test: 143/143 PASS; typecheck, data and daily validators PASS.
- Phase 1.1 backward-compatibility: 20/20 local Worker/D1 tests and 8/8 local browser tests PASS.
- Phase 1.2B full Cloud API: 26/26 local Wrangler + D1 checks PASS: create full v2 source; review; daily and reuse independent approvals; validated immutable v4; bad URL/text/CORS/content-type rejected; v4 history persists after edit; simultaneous CAS accepts one and rejects stale one; per-source isolation.
- Access identity tests: 4/4 PASS (missing Access context, wrong allowed identity, correct identity, identity resolution failure).
- Browser Mac/iPhone simulation PASS: create/review/approve/edit/reload, old Mac conflicting edit HTTP 409, refreshed Mac sees iPhone change and previous approvals invalidated; responsive checks at 390/768/1280 no horizontal overflow and no JavaScript errors.
- Cloudflare Worker bundle dry-run PASS, 26.27KB gzip.
- Evidence screenshot: docs/cloud-migration/evidence/phase12b-cloud-source-ui-mobile-390.png. Synthetic only.

## Defects caught and corrected
- During negative input test, a module constant named URL shadowed built-in URL constructor and returned HTTP 500; renamed SOURCE_URL, repeated all 26 integration tests PASS.
- Browser test initially inspected a collapsed details element via innerText; switched to textContent. Full responsive browser UAT PASS; UI implementation was not defective.

## Pending Owner UAT
1. Mac: open cloud-sync preview and complete Cloudflare Access. Create full synthetic v2 source. Confirm revision 1, pending review and no approvals.
2. Review -> revision 2; Daily approval -> revision 3 with Library still not approved; Library approval -> revision 4 with both approvals true; verify Library v4 snapshot.
3. iPhone: same URL and same Access identity; reload cloud and confirm exact same synthetic source ID and revision 4.
4. iPhone edits synthetic summary -> revision 5 and both approvals false. Mac still at v4 attempts edit -> HTTP 409. Reload Mac -> v5 and approvals false; history and prior Library v4 still readable.
5. Mac fully shut down: iPhone must still read or create synthetic SourceRecord; verify again from Mac after reboot.
6. Observe actual Cloudflare Workers CPU metrics and D1 usage to confirm free quota headroom. Do not share Access cookies, JWTs, passwords or other credentials.

## Explicitly excluded / next gate
Actual production SourceInboxWorkbench, browser IndexedDB, Source Library backups and user data have NOT been migrated or wired to cloud. No Gemini API cloud deployment, new billing plan, schedules, Daily publish, content fetch, production DNS/Tunnel modification, Git stage/commit or push. Next step after Owner PASS is Phase1.2C: opt-in real workbench sync, backup/restore and conflict resolution, with separate authorization for any genuine data upload.

## Safe rollback
Rollback the isolated Worker to prior version ff46ace4-7194-4d3a-82e1-f99f6e2a1485 using Wrangler rollback with --name radar-phase11-preview-locked --yes. Do NOT modify original source_items. Schema tables are additive and can remain unused until explicit deletion approval.

## Final security hardening / deployment verification (2026-10-15)
- A policy gap was identified before final acceptance: an old Library v4 snapshot might otherwise be read as if it were CURRENT-approved after source edit. Fixed API: GET /api/cloud/records/:id/library now requires current SourceRecord fingerprint and current reuse approval event; after edit returns 409 library_approval_stale. GET /api/cloud/records/:id/library-history exposes metadata-only history with current_approved flags; old snapshots remain immutable and traceable but do not authorize downstream reuse.
- Local full Cloud API suite **27/27 PASS**, including stale Library denial, archived snapshot metadata, concurrent stale CAS, real SourceRecord v2 and Library v4 validation. Full local browser Mac/iPhone simulation re-run PASS at 390/768/1280. Signed Access identity 4/4 PASS. Root tests 143/143 and original Phase 1.1 integration + UI backward compatibility PASS.
- Final Worker version: d568fb77-39bc-4fed-a91a-2b9dca10c648. Current deployed version confirmed via Wrangler deployments list.
- The first postdeploy smoke script had a zsh reserved-variable naming bug (status), so it exited early after successful upload; re-ran an independent anonymous request matrix and verified all requested paths return HTTP 302 via Cloudflare Access. No unprotected API observed, and final version verified active.
- Read-only D1 totals after final deployment: 2 old Phase 1.1 synthetic records; 0 new Phase 1.2B source heads; 0 revisions; 0 Library snapshots. No real records migrated.
- Original Mac production localhost:4320 and Helper localhost:4310 both listening. Tunnel/official radar.lamlab.cc unchanged. No plan upgrade, Gemini, real source upload or Git push.
- **Current final status: Protected Cloud Preview deployed + automated QA PASS; authenticated Owner Mac/iPhone UAT still pending.**
