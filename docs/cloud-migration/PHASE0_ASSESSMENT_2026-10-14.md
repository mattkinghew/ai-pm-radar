# AI PM Radar v2.1 — Phase 0 Cloud Migration Assessment
Date: 2026-10-14 (HKT)
Status: ASSESSMENT COMPLETED / PLATFORM MIGRATION NOT STARTED
Owner outcome: Mac powered OFF, iPhone can open Radar, sign in, read and add SourceRecords, and Mac/iPhone can sync drafts, evidence, review and approved-source data.

## 1. Scope and baseline evidence
This phase is READ-ONLY assessment plus documentation. No cloud instance, schema, auth, domain, API routing, credential, schedule, Git stage/commit/push, model call, or live data migration was created or changed.

Inspected current project at /Users/mattgor/Documents/Daily/ai-pm-radar (package 0.4.0; HEAD 43882ad, extensive pre-existing dirty/untracked worktree), deployment docs and Source Intake/Library/Research contracts, and official Next.js, Vercel, Supabase and Cloudflare provider documentation. Some existing assessment values are design assumptions, not proof of live remote service capability.

Evidence/implemented today:
- Current site is Next.js 16.2.9, next.config.ts has output: export with trailingSlash.
- Mac loopback protected origin 127.0.0.1:4320, helper 127.0.0.1:4310, dedicated Cloudflare Tunnel and Cloudflare Access JWT. API routes are implemented in scripts/mobile-production-server.mjs and source-fetch-helper.mjs, NOT app/api Next.js Route Handlers.
- Browser IndexedDB ai-pm-radar-source-inbox (version 3): stores workbench/current, subscriptions, feed-items, source-library. Source Library version 4; SourceRecord version 2.
- Current workbench contains one active form and an array of material cards. reviewedFingerprint, approvedFingerprint, rejectedFingerprint are top-level workbench fields, not guaranteed persistent per-item approval state after selecting another material. This is a data-integrity migration blocker, not a mere styling issue.
- Approved reusable Source Library entries contain approved SourceRecord snapshot + content fingerprint + research_briefs, downstream_handoffs, delivery_packages, intelligence_assessments. Separate explicit reuse approval differs from daily candidate approval; exported package is not receiver import confirmation.
- Existing JSON exports: workbench draft backup (lib/source-draft-storage.ts), Source Library backup (lib/source-library-backup.ts, ResearchBriefs UI), SourceRecord and Daily Candidate individual downloads. Export is manual and browser-specific.
- Daily formal data is from build-time data/daily/*.json. There are 2 formal daily JSON files currently in the repo. Candidate download does not update the public site or publish to data/daily.
- Research Runner config/state/log is in .runtime/research on the Mac; files observed: 3, total approximately 304,083 bytes, CONTENT NOT INSPECTED. Uses filesystem writes, rename, lockfiles and process spawning. No serverless-safe persistent runtime currently exists.
- Current Gemini request limit is 60,000ms; local proxy budget 70,000ms. Source fetch protects against private IP, DNS rebinding via pinned lookup, redirect abuse, oversized HTML, and timeout. These must survive API refactor.
- Site protected service was active on 2026-10-14 during this assessment; no configuration modified.
- No .vercel/project.json in this repo, no supabase/ directory or Supabase client dependency. Read-only connected Vercel list_projects filtered for radar returned no visible project; available account scope may be incomplete.
- Environment variable NAMES only were reviewed. No key/token values were accessed or copied.

UNKNOWN / cannot assert from source code:
- Real IndexedDB count, size, unique SourceRecord IDs, backup completeness of actual Owner browser profiles or iPhone; Chrome + Safari local databases are separate.
- All prior UI approvals remain correct across multiple source-card switches; needs specific regression and reconciliation audit before import.
- Supabase account/project entitlement, availability of a billable Vercel team, domain ownership/control and available plan; none provisioned/changed.
- Whether Cloudflare Access continues at final cloud hostname, or is replaced by private Supabase Auth and an optional secondary access layer.
- Actual live Gemini latency and region compatibility from candidate Vercel function region, true cost, and runtime compatibility of pinned DNS lookup; require limited authorized preview tests.
- Authenticated real-device iPhone Safari behavior and Mac-off reliability.
- Source licensing/privacy permissions for any imported nonpublic text.

## 2. Decision: cloud-first split deployment (CONDITIONAL)
Recommended TARGET, not an authorized deployment:
- Vercel Next.js app (no static export), with server-side API Route Handlers / Node runtime for capture and on-demand AI analysis; disable caching for private user content.
- Supabase Auth (private Owner allowlist, explicit nonpublic signup policy) + PostgreSQL (Authoritative SourceRecord and versioned review state), strict RLS and ownership checks.
- Browser IndexedDB becomes local *cache/recovery* after confirmed cloud persistence; initial phase may require network to edit, offline writes defer until synchronization and conflict logic validated.
- Cloudflare can remain authoritative DNS; prepare a Vercel preview hostname first. Keep existing radar.lamlab.cc production tunnel untouched until cutover authorization, domain/SSL verification, Mac-off mobile pass, and fallback rehearsal.
- Gemini API key remains exclusively server-side. Do NOT replicate it to any NEXT_PUBLIC variable.
- Preserve current approval/evidence invariants and provenance. Do not migrate or run background Research Runner in initial website/sync slice; design separate durable queue/scheduler if authorized later.

Alternative: stay on Mac + add Supabase data sync: fails Mac-off acceptance. Alternative: Cloudflare Workers + D1/Auth: could reduce commercial hosting cost, but requires a larger compatibility rewrite for current Node-only pinned DNS HTTP client and full research runtime. Re-evaluate only if budget constraints make Vercel+Supabase unacceptable.

## 3. Runtime/API compatibility matrix
Route / workflow | Current implementation | Target disposition | Risk / acceptance
- GET /api/status | Mac helper + Cloudflare JWT proxy | Authenticated cloud health (minimal nonsecret metadata) | Low; deny anonymous owner status.
- GET /api/fetch | Node helper, DNS checks + pinned lookup + limited response | Node.js function, reuse proven parser with equivalent network protections | HIGH; SSRF/redirect/DNS rebind, URL size, DNS/socket APIs, region egress. Refuse unsafe targets; manual paste formal fallback.
- POST /api/analyze | Node helper Gemini, 60sec timeout, schema+verbatim evidence validation | authenticated Node function with explicit maxDuration >60sec, max body and no automatic paid retries | HIGH; provider timing, function limits, region, secrets, quotas. Simulate 504/422 before one consented live call.
- POST /api/feed | RSS retrieval in helper | authenticated on-demand route; keep max feeds/items and SSRF checks | Medium; P1 if unused in first foundation milestone.
- /api/automation/status,state,export,config,run,feedback | reads/writes Mac .runtime/research; run spawns process | NOT directly portable; read-only placeholder/disabled until durable store, job/queue/scheduler redesigned | HIGH; never emulate local disk persistence in ephemeral function.
- Research Brief UI | approved Source Library from IndexedDB plus local research runtime | cloud-backed approved snapshots + handoff references; no reanalysis required | Medium; links and version/fingerprint.
- Daily Radar | build-time JSON/SSG | preserve existing public/static daily content initially; publishing still explicit separate pipeline | Medium; never auto-publish on approval.
- Existing Cloudflare JWT gate | origin-specific Access JWT | Supabase server-verified session + RLS; optionally extra access gate | HIGH; prevent preview URL bypass and cached private session leaks.

Vercel documentation as of assessment: with Fluid Compute, Hobby Functions can be configured for up to 300 seconds; without Fluid Compute old Hobby maximum is 60 seconds. Confirm actual account/project config and test at 65s synthetic; recommendation: Node route maxDuration 80-90 seconds with Gemini internal 60-second timeout and overhead, subject to plan. This is a design hypothesis, not proof on this account. Source: https://vercel.com/docs/functions/limitations and https://vercel.com/docs/functions/configuring-functions/duration.
Next.js static export does not provide ordinary dynamic API routes: https://nextjs.org/docs/app/guides/backend-for-frontend.

## 4. Proposed authoritative schema: small and versioned
Phase 1 design contract only (not SQL applied):
- source_items: source_id TEXT existing ID preserved; owner_id UUID; canonical_url, original_url, created_at, current_revision INTEGER, current_fingerprint; unique owner_id+source_id. No guessed merge solely on URL.
- source_revisions: owner_id, source_id, revision, immutable SourceRecord v2 JSONB, fingerprint, changed_at, changed_by, reason, optional user-facing change summary; unique (owner_id, source_id, revision). Keep verbatim raw text and provenance.
- draft_states: owner_id, source_id, editor_form JSONB, base_revision, updated_at, local_device_id, server_revision. Pending/unreviewed edits must not mutate approved immutable snapshots. One active draft per (owner_id, source_id), not global workbench approvals.
- review_events: owner_id, source_id, source_revision, source_fingerprint, evidence_grade, explicit action reviewed/rejected/approved_for_daily/approved_for_reuse, actor, timestamp. Append-only audit. Approval bound to EXACT fingerprint; any relevant edit makes it stale.
- library_entries: owner_id, source_id, fingerprint, approved_version, approved_at, immutable approved SourceRecord and references to handoffs; can initially retain current Library v4 snapshot in JSONB with future normalisation.
- handoffs/delivery records: preserve immutable source fingerprint, downstream approval independent, statuses exported and import_confirmed separate, record receiver evidence explicitly.
- daily_candidates: explicit separately approved candidate by date and source, not automatic publishing. Real publishing to data/daily separate later.
- Optional later: research_materials, subscriptions, feed cache, research runner durable job state, offline sync queue. Do not invent these as already live.

RLS design gate: authenticated role only; explicit grants plus SELECT/INSERT/UPDATE/DELETE policies scoped to owner_id = auth.uid(), with both USING and WITH CHECK for writes, tests that owner A cannot read/update/insert rows for owner B, and no anonymous access. Index owner_id/record identity. Never expose service_role in browser; verify auth token in functions. No public SQL views accidentally bypassing RLS. Source: https://supabase.com/docs/guides/database/postgres/row-level-security.

## 5. Conflict, approval and migration invariants
- Preserve stable SourceRecord ID, captured body, original/final URL, provider metadata, exact evidence, timestamps, versions, consent/rights note, handoff references. JSON Schema/record-version validation before upload.
- Do not mistake source domain fallback for proven publisher/author; evidence grade remains manual. AI narrative does not mark source verified.
- On every cloud write require current server_revision (compare-and-swap). If stale, return 409 with both revisions for explicit user decision. No silent last-write-wins; no automatic merge of review events or approved snapshots.
- Different source cards must have independent revision/review state; existing top-level workbench fingerprints need migration/remapping. Reject mixed cross-card global approvals rather than assuming each item is approved.
- After a material edit (source, claims, evidence, assessment), invalidate corresponding approvals; preserve old audit trail and require fresh human review.
- Reuse approval != Daily Candidate approval. Neither implies actual downstream receiver import. Source Library should be queryable from Mac and iPhone by same signed-in owner.
- Migration must be IDEMPOTENT using owner_id+source_id+content fingerprint; no duplicate record creation from retry. Treat duplicate URL with divergent content as a review conflict, not automatic collapse.
- Files/filesystem and backup: verify draft export/import and Source Library backup round-trip in a synthetic fixture first, then perform Owner-consented browser export for genuine data. Never pull Chrome/Safari profile data silently.
- Show a read-only migration manifest BEFORE actual import: item counts, schema versions, content hashes, corrupt/unknown, duplicates, stale approval fingerprints, estimated bytes, and quarantine counts. All private content should remain local until explicit migration consent.
- No production destructive cleanup; preserve old browser IndexedDB, current Mac .runtime and data/daily and full pre-cutover site backup. Keep old site reachable by separate protected fallback hostname or at least rollback DNS procedure.
- Ownership/freshness: server timestamp and integer revision are authoritative; a client clock or transient state cannot approve data.

## 6. Phase 0 readiness / Go-No-Go
COMPLETE: repository/runtime architecture inventory; source-level storage and backup model; API mapping; design schema, auth, RLS, revision and conflict policy; staged migration and rollback plan; rough pricing and known limits below.
PARTIAL: provider integration can be evaluated against official docs and synthetic tests but has not run on a Vercel preview; actual protected authentication and cloud DB RLS not created or tested.
BLOCKED: browser-specific real data volume and valid export count; real iPhone session; cloud project creation/billing/owner allowance; secure preview domain and serverless deployment all require separate explicit authorization or Owner action.
NO-GO for direct production DNS cutover, copying any live browser IndexedDB directly to cloud, activating any schedule, or claiming end-to-end Mac-off PASS.

Phase 1 preconditions:
[ ] Owner approves cloud provider(s), allowed monthly budget and their project ownership.
[ ] Decide whether any commercial lead generation/revenue will use Vercel (Hobby prohibited for commercial use).
[ ] Owner confirms private signin identity/email and desired second-factor approach; test callback and secure session lifecycle on Mac/iPhone.
[ ] Backup manifest/export for existing browser Source Library, draft, subscriptions/feed items; test export/import checksums and migration quarantine.
[ ] Isolated cloud Preview HTTPS + Supabase Auth/RLS deny tests + no credentials in client + preview protected.
[ ] Cloud API synthetic SSRF/timeout/evidence test; then one explicit consented live Gemini test with cost/latency.
[ ] Two-device conflict and approval/fingerprint invalidation; Mac-off login/read/import/update tests.
[ ] Dry-run restore from pre-cutover backup and domain/Access/DNS fallback verified.
[ ] Only THEN request a fresh, distinct user authorization to change radar.lamlab.cc DNS/Access production routing.

## 7. Pricing/availability and tradeoffs (USD, verify at purchase)
Supabase Free: $0, 500MB DB, 1GB file storage, 2 active projects; auto-pauses after roughly 1 week of insufficient activity, NO automatic backups. It is NOT reliable for the literal requirement of always-available service during long inactive periods. Source: https://supabase.com/pricing and https://supabase.com/docs/guides/platform/free-project-pausing.
Supabase Pro: from $25/month for first project, no inactivity pause and includes daily backups (7-day retention); potential usage-based overages.
Vercel Hobby: free with usage limits and suitable only for NONCOMMERCIAL personal projects. Commercial activity including advertising sale of services requires Pro/Enterprise. Source: https://vercel.com/docs/limits/fair-use-guidelines.
Vercel Pro: $20/month platform fee including one deploying seat/credit, usage may add fees. Source: https://vercel.com/docs/plans/pro-plan.
Budget scenarios:
- Noncommercial prototype: Vercel Hobby + Supabase Free ~US$0/month hosting/base DB, excluding Gemini. NOT guarantees 24/7 DB availability; only a test phase, not strict Owner objective.
- Always-on production (conditional commercial usage): Vercel Pro ($20) + Supabase Pro ($25) = ~US$45/month base before compute/egress/AI/add-ons, not guaranteed invoice cap. Consider whether that recurring commitment is proportionate for a single user.
- Lower-cost alternative architecture: Cloudflare/Workers + suitable persistent DB; requires a separate architecture comparison/benchmark and potentially more refactoring of Node-only capture. No price claimed without a verified plan and workload.

Vercel account scope checked read-only: no Radar projects returned by the connected list_projects search; absence in this view is NOT proof the user has no other projects/accounts. Supabase account project/entitlements not accessible in this assessment.

## 8. Proposed Phase 1 sequence (do not execute without new GO)
P1.0: Owner exports and reviews a safe metadata-only inventory/backup manifest (no automatic cloud upload), confirms policies/budget and cloud identity.
P1.1: Create isolated Vercel Preview + private Supabase project; set secure session, RLS, tests and two-user deny matrix; existing radar.lamlab.cc stays untouched.
P1.2: Implement server-backed SourceRecord/drafts/library with expectedRevision, human approval/fingerprint, migration dry-run; Mac/iPhone signed-in sync using SYNTHETIC sources first.
P1.3: Replace /api/fetch and /api/analyze with authenticated Node.js route handlers; execute synthetic security/timeout/evidence fixtures; one explicit opt-in live Gemini call; do not activate Research Runner.
P1.4: Owner-approved migration of chosen real non-confidential data, verify counts/hash/provenance, Mac-off authenticated iPhone end-to-end acceptance; only then separately authorize domain cutover and reversible rollback.

## 9. Official references reviewed (2026-10-14)
- Next.js BFF/static export caveats: https://nextjs.org/docs/app/guides/backend-for-frontend
- Vercel Function duration limits: https://vercel.com/docs/functions/limitations
- Vercel maxDuration: https://vercel.com/docs/functions/configuring-functions/duration
- Vercel fair-use commercial policy: https://vercel.com/docs/limits/fair-use-guidelines
- Vercel Pro: https://vercel.com/docs/plans/pro-plan
- Supabase Auth/SSR: https://supabase.com/docs/guides/auth/server-side
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase pricing/free pause: https://supabase.com/pricing
- Vercel third-party Cloudflare DNS guidance: https://vercel.com/kb/guide/migrate-to-vercel-from-cloudflare
- Vercel domain setup: https://vercel.com/docs/domains/working-with-domains/add-a-domain

## 10. Final decision
Phase 0: COMPLETE as architectural assessment and written delivery. CONDITIONAL technical feasibility. Phase 1 cloud foundation is READY FOR SCOPING, NOT READY FOR PRODUCTION CUTOVER. No current cloud project, migration, or Mac-off UAT has been performed.
