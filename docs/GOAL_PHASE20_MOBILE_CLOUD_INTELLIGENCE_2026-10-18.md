# AI PM Radar — Phase 2.0: Mobile Capture, Protected Cloud Persistence & Intelligence Ranking
Date: 2026-10-18
Status: IN PROGRESS — protected static mobile UI is activated; durable cloud capture and cross-device persistence remain HOLD. This is NOT a declaration that cloud writes or mobile sync are production-ready.
Priority: T0. Active Engineering Project 1/2.
Owner business outcome: Feed trusted, defensible content opportunities into Content Ops → professional personal IP → AI Transformation Diagnostic discovery / paid pilot.

## Product North Star
From a mobile browser outside home LAN, capture a public URL, text or owned file in <=30 seconds; see an explicit saved receipt and read the exact same draft on another authenticated device; request human-supervised AI extraction/evidence/scoring; decide to approve/archive/dispatch; return later to all historical records.
Research pool is NOT limited to ten. Support Top 5/10/20/All display while strictly separating Captured / AI-enriched / Reviewed / Approved / Published states.

## Evidence-based baseline (do not reinterpret historical tests as current UAT)
- Local browser Source Inbox + IndexedDB v3 exists. `lib/source-library-storage.ts` currently accepts approved reusable Source Library entries; do not force unapproved captures through it.
- Existing Cloudflare Access / protected Worker / D1 and revision + immutable-event designs exist under experiments/cloudflare-sync-spike and experiments/phase15-source-sync. Existing `lib/cloud-sync-capability-gate.ts` explicitly fail-closes unsanctioned *real* cloud SourceRecord writes and demands source-specific Owner consent + verified backup + expected_revision. Read and preserve it.
- Existing rule-based `lib/intelligence-routing.ts` 5-dimension scoring exists; `lib/ai-analysis.ts` has model-derived 1–10 score suggestions. They are advisory, not automatic trust/approval.
- Latest locally executed Collector yielded 55 deduplicated needs_review candidates in .runtime; formal `data/daily/` still only has 2026-06-25 and 2026-07-02 static editions. This does NOT prove daily scheduled cloud collection or current-date publication.

## Phase 2.0A — Mobile Draft & Cloud Save (THIS sprint's only Primary Outcome)
**Primary Outcome:** One public non-sensitive URL/text can be captured on an iPhone's cellular Safari, stored as an *unapproved private draft* through a validated same-origin, authenticated, durable database API, and read back unchanged from an independently authenticated browser/device.

### Scope
1. Preflight: read AGENTS.md, docs/CONTEXT_SUMMARY.md, current scripts/mobile-health, Cloud capabilities, D1 revision schemas and current git status; verify canonical deployed origin/version. Audit which existing experimental Cloud API already satisfies a secure CREATE/LIST/GET/update-by-expectedRevision and Access identity binding. Prefer extending protected D1 revisions rather than creating a second backend, but only after verifying actual deployed Worker and schema. No guessed production IDs.
2. UX: /source-inbox mobile Quick Capture above the fold: Paste URL / Text / manual File upload (restrict allowed MIME and size). Detect/share-target capability only when supported; **fallback paste/upload must always work on Safari**. No compulsory metadata fields: title optional, source URL, optional tags/note, 'Save Draft'. Automatic capture of page content is optional and must gracefully degrade to URL-only plus 'needs_manual_input'.
3. States: local pending → sending → cloud_saved with explicit server revision/updatedAt → cloud_sync_failed/retry/conflict. Show server-confirmed receipt, not toast on local IndexedDB write. Store original source/provenance before enrichment, keep AI output derived.
4. Cloud: authenticated same-origin Access session on HTTPS; bind server-side owner_sub, validate CORS/CSRF/Origin and canonical URL, SSRF block remote fetching, payload bytes/quotas/timeouts and rate limit; immutable historical revisions or compare-and-swap expectedRevision; idempotency key; no direct client D1 credentials/model keys; optional encrypted draft queue/backoff and safe private backup/export/import.
5. SAFETY GATE: current `cloud_write_authorized=false` and real SourceRecord cloud capability fail-closed remain in force until test-only synthetic D1 end-to-end passes, access control and backup/rollback pass, and Owner explicitly authorizes ONE public non-sensitive actual source. Do NOT silently enable live writes or broaden Worker permissions. A draft-only private pilot route, if separately introduced, must be independently authorized and must NOT bypass the SourceRecord approval contract.
6. Cross-device integrity: upload one new safe test draft, hard reload, log in from another browser/device on cellular, verify exact source URL/body/brand/status/metadata and matching revision; edit on second device; fail safe on concurrent edit; retry doesn't duplicate.
7. Security: no employer or client records, no public/private_vault, no raw API keys in source, no cloud publishing/downstream dispatch from unapproved drafts. Leave Mac-offline independence as Unknown until external tests with Mac actually offline.

### Acceptance Criteria / independent gates
AC1. Actual authorized iPhone Safari cellular capture time <=30 sec for URL or pasted text with <=3 primary taps after pasting; screenshot + timing + exact deployed SHA (Owner UAT).
AC2. Server confirms saved revision, a second browser gets same record without relying on local IndexedDB, repeated save has no duplication; refresh and reconnection safe.
AC3. Access denied without session, cross-owner 403/404, invalid input and oversized file rejected; no PII/secret in public logs.
AC4. Existing reviewed/approved SourceRecords, fingerprints, immutable DeliveryPackage, Cloud safety flags and archived data remain unchanged.
AC5. Backup before any pilot, recovery/rollback test and failure states recorded. Production promotion requires separate Owner GO.
Deliver files changed, tests and HTTP trace without credentials; label synthetic, actual private-pilot, real UAT and production separately.

### Secondary Outcomes (no more than two)
S1. Mobile source Inbox filters/status labels usable at 390px, 768px and one physical device; no horizontal scrolling and buttons meet touch target.
S2. Reuse existing URL fetch/Gemini extraction as optional async action, with transparent provider/model status and pending/manual fallback; not required for basic Save Draft.

## Phase 2.0B — Explainable Scoring & Ranking (NEXT sprint, not concurrent with 2.0A)
Primary Outcome: owner can reliably sort and review a 30+ item candidate pool by personalized and explainable utility, without confusing heuristic relevance with verified truth.
1. Stage quality hard gates: valid canonical URL, duplicate detection, capture completeness, source date/age, evidence locators, relevance and safe source handling. Duplicate/cross-post lineage, not destructive delete. Unknown publication date clearly labeled.
2. Separate distinct signals: Professional Fit (AI PM / NGO / education / SME), Evidence Strength, Practical Actionability, Freshness, Novelty vs own library, Source Provenance quality, Downstream Content/Diagnostic Fit. Proposed v1 weights: 25/20/15/10/10/10/10 (sum 100). These are a calibration hypothesis ONLY, review with Owner after 30–50 diverse real articles.
3. Model 1–10 suggestion must include rationale/evidence IDs; use deterministic normalized 0–100 aggregation and confidence/unknown flags. Penalize unsupported claims; missing metadata is Unknown (not fabricated 0 facts); preserve both AI original suggestion and Owner manual override with audit trail/time.
4. Feedback on owner selections: Useful / Not relevant / Save for later / Source concern, stored as preference signal in private user scope, not automatically rewriting evidence or approval. Show breakdown and 'why ranked'; alternate newest, highest relevance, strongest evidence and unreviewed filters.
5. Measure: Owner ranks 30 realistic records, manually labels top 10 relevance, compare precision@10, perceived noise/duplicate rate and time to select 5 actionable opportunities vs old heuristic; reweight only if supported.
Non-goals: LLM-only scoring, auto verify all sources, spam engagement as quality, opaque personalization, purchased vectors, production model spending without explicit GO.

## Phase 2.0C — Daily / Archive / Downstream Visible Delivery (AFTER 2.0B)
Primary Outcome: current approved editions appear on mobile with correct date/status, backed by an actual dynamic snapshot + explicit publishing gate and traceable Content Ops dispatch.
- Separate Collector fetched / deduplicated / eligible / AI-enriched / owner-approved / public-published counters. Top N = user UI preference 5,10,20,All; NO intake/day upper bound, but enforce service quotas/pagination to prevent high-cost runs.
- HKT collection target ~06:00 only if schedule operationally verified; freshness warning for stale snapshots. On shortage show actual count and state, never invent ten.
- Protected review queue + immutable approved snapshot into public website or protected owner reading view according to explicit release policy. Verify when Mac sleeps/offline; never assume local Origin tunnel is independent cloud service.
- Explicit separate SourceRecord approval and content_candidate dispatch; Content Ops signed receiver/import acknowledgment needed before 'Delivered'; source facts/interpretation/rights audit preserved.
- One Owner-approved real source, one Content Ops Draft, one Publishing Pack (separate approval), one manual live post with real URL, optional DIAG inquiry as measured fact if exists; no guaranteed leads.

## Non-goals for current sprint
No new general Agent platform, no mandatory social connectors/auto-post, no arbitrary 10-item floor, no unbounded AI processing cost, no new cloud vendor unless existing D1 fails a documented security/function comparison, no Production config/Tunnel changes without release authorization.

## Evidence package & state reporting
Under docs/qa/phase20-mobile-cloud: preflight.md, architecture-decision.md, endpoint-contract.md, device-uat.md, ranking-calibration.md, threat-model.md, restore-runbook.md, dispatch-e2e.md. Do not mark files 'completed' until evidence exists.
Report: Completed (tested)/Partial/Blocked/Unknown/Planned; source counts separately for fetched, unique, reviewed, approved, displayed; do not equate HTTP200 with authenticated data persistence.

## Owner GO / HOLD
Start with read-only audit + synthetic preview build and scoped non-destructive implementation. Halt before enabling ANY new real-data cloud write, deploying to public production, spending tokens, creating subscriptions, scheduling jobs or changing Access/Worker policy. Request a specific Owner GO supported by successful synthetic protected round-trip evidence.
