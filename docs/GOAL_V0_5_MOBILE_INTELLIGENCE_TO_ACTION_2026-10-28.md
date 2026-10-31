# AI PM Radar — Major Goal v0.5: Mobile Intelligence to Action
Date: 2026-10-28
Status: PLANNED / OWNER EXECUTION GATE. This is a new goal, NOT proof of implementation.
Suggested version target: 0.5.0-rc.0, only after release gates; current local package baseline 0.4.1-rc.0.
Canonical repo: /Users/mattgor/Documents/Daily/ai-pm-radar

## Agent Role & Command
You are Senior AI Product Manager, Mobile UX/Product Engineer, Cloud Security Architect, Applied AI Research Lead and Technical Delivery Lead for AI PM Radar. Deliver actual working code, real-browser evidence and a usable user journey; do not stop at a PRD, TODO, demo mocks or passing unit tests. Use Traditional Chinese in Owner-facing reports. No unapproved production/cloud writes, deployments, subscription costs, new scheduled automation or credentials changes.

## Decision / Strategic Alignment
2026-12-17 primary commercial outcome: real paid AI Transformation Diagnostic / Private AI pilot evidence, without requiring automation to be finished before direct outreach. Second active business pathway: culture/aroma workshop sales to education centers and corporates. Radar exists to find and triage authentic relevant opportunities, make them actionable, and produce source-grounded briefs for Content Ops and optional reviewed Cyber Kuma learning candidates. It is NOT another general AI news website or independent commercial SaaS now.
Only two active engineering repositories in this update window: AI PM Radar + Content Ops. No new Cyber Kuma version work under this goal; consume the existing Cyber Kuma review-only bridge v1.

## Evidence Baseline — Never Rewrite
- Current local package version: 0.4.1-rc.0 with significant dirty changes; git status and current deployment require fresh preflight.
- Existing human review, SourceRecord, evidence separation, immutable DeliveryPackage and secure handoff are assets to preserve.
- Previous Phase 2.0A protected authenticated iPhone cloud persistence is PLANNED / NOT OWNER ACCEPTED. IndexedDB/local-only is not cloud success.
- Collector previous evidence: 55 deduplicated needs_review candidates as of Oct 18, not current approved or published articles. Formal daily JSON was previously stale (June/July snapshots). Verify actual date afresh.
- Candidate ranking mechanisms exist; source trust / model-derived scores are NOT fact verification.
- Existing fail-closed cloud capability gate and source-specific Owner authorization are mandatory.
- No claim that package exported means received; signed Content Ops receiver import confirmation is independent.
- Cyber Kuma bridge from v0.4.1 candidate exports review-only learning intake, NOT playable questions.

## Primary Outcome — One Complete Mobile Intelligence Loop
From an authenticated real iPhone on cellular (Mac may be off), capture one public non-sensitive URL/text/owned-file note within 30 seconds; persist an UNAPPROVED private draft into protected durable storage; read the exact record from another independently authenticated browser/device; review provenance and AI suggestions; optionally approve and package one meaningful content opportunity for Content Ops with independently evidenced receiver receipt. Separate the baseline cloud-save gate from later editorial delivery gate. Do not describe a partial chain as complete.

## Secondary Outcomes (max 2)
S1 Explainable ranking and triage on a 30+ candidate pool: top 5/10/20/all with evidence strength, professional fit, SME/NGO/education/business opportunity fit, freshness, actionability, novelty and confidence; Owner override persists.
S2 Current and historical approved brief/archive flow: up-to-date source-state counts, stale freshness warnings, manually approved dispatch, clear receiver acknowledgement. No forced daily ten, auto-publishing, or automatic truth claims.

## Strict Sequential Engineering Gates

### Gate 0 — READ-ONLY PREFLIGHT & SAFETY
Read AGENTS.md, docs/GOAL_PHASE20_MOBILE_CLOUD_INTELLIGENCE_2026-10-18.md, docs/CONTEXT_SUMMARY.md, cloud capability gates, authenticated Worker/D1 experiments, deploy records, git status, 0.4.1 learning delivery changes and receiver contract.
Confirm exact canonical deployment URL, build SHA, auth session, source store, D1 schema/migrations, backup and rollback. Test host-safe endpoints; do not weaken 421/401/Access protections. Report current local/preview/production capability separately.
Preserve all tracked/untracked work. No reset, clean, stash, broad add/commit, push or deploy.

### Gate A — T0: GENUINE MOBILE CAPTURE + DURABLE CLOUD READBACK
Build one compact above-the-fold Quick Capture screen with Paste URL / Paste Text / Upload allowed files, Save Draft, optional notes. Source canonical URL, input kind, timestamp, owner identity and original text/metadata must be preserved.
Safari share-sheet integration only if truly supported; paste/manual fallback is mandatory. URL-only capture is valid but cannot pretend full article was fetched.
Explicit states: pending_local → sending → cloud_saved(server receipt, revision and timestamp) / conflict / failed_retry. No local IndexedDB toast may say Cloud Saved.
Reuse existing authorized same-origin Access/Worker/D1 architecture when validated. Bind server-side owner identity, protect origin/CSRF, idempotency, length/type/rate-limit/quota, SSRF/remote-fetch, revision compare-and-swap, audit and backups. No client-side service keys.
Existing real SourceRecord capability stays fail-closed. A separate draft-only private pilot route requires independent test and Owner authorization; never bypass the real-source consent contract.
Tests: iPhone Safari cellular capture <=30 seconds after pasting and <=3 primary taps; true server receipt, another device gets identical record with Mac disconnected, no duplicate on retry, conflict does not clobber, anonymous/other-user/oversized/poisoned inputs rejected. If actual iPhone cannot be tested, mark OWNER UAT BLOCKED rather than passing via emulator.
STOP before any live real-source upload or production security setting change until synthetic protected round-trip and explicit source-specific Owner GO.

### Gate B — T1: AI RESEARCH, EVIDENCE & RANKING
Only after A evidence. Reuse Collector, rules and optional authorized existing AI extraction; no new crawler/model subscription by default.
Support a reviewable unlimited-by-product-design candidate pool (paginated/quota bounded; 30–50 realistic records for UAT), not exactly 10 articles. Stages: captured, extracted, evidence_required, reviewed, approved, dispatched, archived and independently published. Distinguish fact, quote, AI interpretation and unknown fields.
Score facets: Professional Fit 25; Evidence Strength 20; Practical Actionability 15; Freshness 10; Novelty 10; Source Provenance 10; Downstream Content/Diagnostic Fit 10 (all preliminary weights / 100, calibrate with Owner after 30–50 reviewed records).
Show why ranked, evidence IDs, date freshness, duplicate lineage, confidence, missing data as Unknown, Owner rating/override and audit history. Filtering by category/priority/date/review status + Top 5/10/20/All. Categories must be personally relevant: SME AI readiness/privacy/receipt workflows, NGO/education use cases, cultural/parent-child/corporate workshop opportunities, AI PM job learning as secondary.
Use manual top-10 labels to compute precision@10, user review time and perceived irrelevant/noisy rate. Do not claim validated ranking from heuristic scores or synthetic labels alone.

### Gate C — T1: ACTIONABLE BRIEFS & CONSUMER DELIVERY
Only after A/B evidence. Homepage mobile reading with clearly dated actual approved content, empty/stale signals and truthful count per source stage. No fabricated daily edition or fixed-ten floor.
Review-approved SourceRecord → separately approved content_candidate → signed/hashed DeliveryPackage → Content Ops exact Brand routing → receiver-side acknowledgement / import readback. The target personal consulting Brand ID may only be used if verified in actual receiving workspace. Do not claim exported = imported or posts published = paid leads.
Deliver a compact editorial opportunity brief: ICP, actual operational pain, sourced claim/evidence locator, uncertainty, unique angle, action and optional manual DIAG CTA. Content Ops owns copy/media/publishing. For Cyber Kuma learning_pack keep review-only handoff; no automatic game QA or playable card generation.
No background schedule activation until security/uptime tests plus Owner GO. Test Mac-offline independence and historical archive only on actual external access if available.

## Product Gates — Separate Engineering / Actual Runtime / Owner Use
Engineering: tests, typecheck, data validation, build and mobile build pass; security negative tests; old records/fingerprints unchanged.
Runtime: actual authenticated HTTPS request/response, backed durable record read after reload/on separate device, screenshot, source fingerprint, clear server receipt, and confirmed receiver acknowledgment.
Owner product: capture on physical iPhone in <=30s; review top 20 and find >=5 clearly actionable items in <=10 minutes (provisional target); understand why each is ranked, no false Cloud Saved or Verified tag.
Business: at least one Owner-accepted brief used in Content Ops; leads, client interviews and payments remain Unknown until separate evidence. Radar success is lower research effort / better relevance, not article volume.

## Non-goals
No new general Agent/RAG/SaaS framework, auto-post, cold-message automation, unlimited API spending, forced ten/day, automatic review/approval, direct employer/client data, new cloud migration without security reason, production cloud writes, open ports, social accounts automation, duplicate Cyber Kuma knowledge generator, unapproved git push/deploy.

## Required Output
1. Verified baselines and Gap Matrix; 2. code for active gate; 3. screenshots/browser traces; 4. synthetic vs public-real source evidence distinct; 5. backup/recovery and exact build identity; 6. handoff contract tests with Content Ops; 7. owner instructions for 390px iPhone; 8. clear Completed/Partial/Blocked/Unknown/Planned, risk and GO/HOLD.
Do not run Gates B/C in parallel with an unresolved protected cloud capability gate. Continue safe preparatory work without misrepresenting Owner proof.
