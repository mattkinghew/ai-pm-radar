# AI PM Radar — Travel Mobile RC1 / Long-form Agent Mission
Created 2026-10-18. Status: PLANNED, not deployed by this document.
Primary Outcome: Using Safari on mobile cellular away from home, Owner can enter a URL/text into protected Radar, reliably save a private draft with honest LOCAL-vs-CLOUD receipt, find and reopen it, request AI processing, inspect evidence and reach a review decision. During the trip the public reading page is visibly fresh or truthfully labels staleness; article pool is NOT limited to 10.
Co-primary commercial dependency (not another deliverable): approved source can later become Content Ops personal consulting Brand draft with source fingerprint and human approval.

## Mandatory read-first
AGENTS.md; docs/CONTEXT_SUMMARY.md; docs/GOAL_PHASE20_MOBILE_CLOUD_INTELLIGENCE_2026-10-18.md; docs/GOAL_DAILY_TEN_REAL_INTELLIGENCE_2026-10-18.md; docs/qa/REMOTE_ACCESS_RECOVERY_2026-10-18.md; lib/source-library-storage.ts; lib/cloud-sync-capability-gate.ts; lib/intelligence-routing.ts; experiments/phase15-source-sync/schema.sql; existing tests. Canonical repo /Users/mattgor/Documents/Daily/ai-pm-radar, HEAD previously e9c14c5 with 62 dirty paths. Confirm actual CURRENT SHA and don't treat it as current deployed artifact automatically.

## User workflow / mobile screen contract
Entry: https://radar.lamlab.cc/source-inbox (or verified actual route; don't invent a new public route).
- From iPhone Safari on 4G/5G, login via existing Cloudflare Access. On first screen have obvious URL paste, free-text paste, small local file input (existing supported types), one 'Capture' action. No 15-field form required to collect.
- Auto fetch/YouTube/PDF text extraction is optional. URL-only capture must work when site blocks extraction. Mark captured content scope / unavailable reason; no hallucinated article body.
- After each save show backend truth: Local draft with backup needed / Cloud saved + server revision ID / Pending retry / Conflict / Failed. Local IndexedDB does not count as D1 saved.
- AI enrich button creates cited Chinese digest + English optional, topic tags, entity/context, key claims with evidence links, uncertainties and provider/model/version. If model fails, offer manual notes/review and retain original data. Never overwrite source facts with AI interpretation.
- Private candidate Review: approve, reject, save for later. Separate candidate, approved library, editorial daily snapshot, downstream content approval. Keep exact immutable origin URL, checksum, review trail.
- 'Today' should not present 2026-07-02 as today. Display last actual approved day + staleness alert and count. New collector candidate pool and review/approved lists with user-selected Top 5/10/20/All, pagination, source/age/score sorting.

## Release plan: safe sequential gates
G0 — Read-only verification and recovery (P0): inspect git/status/diff, current Access/Tunnel/Origin logs, 4320/4310/4482 and Mac-online requirement, production origin host validation; examine actual Cloud D1 Worker scope/capabilities. Confirm that cloud writes are explicitly gated; do not disable auth. Collect HEAD and URL/proxy mapping. Route to static public page is NOT substitute for private Library.
G1 — Zero-risk capture fallback: existing IndexedDB Draft capture and local export/import in Safari. Ensure a simple owner-readable backup JSON is downloadable/read back after browser restart. Clearly label browser-only and no cross-device guarantee. Pass this gate even if cloud is blocked so Owner can study during trip with honest limits.
G2 — Protected synthetic D1 pilot: use current same-origin Access capability guard and D1 revision schema. Provide minimal REST create/get/list/update with owner_sub, immutable revisions, expected_revision concurrency, idempotency, limits (<=1MB), secret-free client, CSRF/Origin checks, strict per-owner reads. Test unauthenticated fail, cross-owner fail, duplicate retry, conflict. Do not use employer/customer content.
G3 — Actual mobile cloud readback ONLY after Owner approves the source-specific small public URL/test record AND backed-up checkpoint. Real production cloud flag currently fail-closed; don't change it before an explicit security GO. Owner mobile Safari saves, Mac independently reads from cloud, Mac switched off test proves independence if architecture claims it.
G4 — Collection + daily feed: Collector already returned 55 needs_review candidates in .runtime on 2026-10-18, whereas data/daily only 2026-06-25/07-02. Do NOT mark auto publication PASS. Verify actual 06:00 HKT schedule separately; publish only human-approved dated snapshot, with no 'always 10' constraint. Show at least 20 unique pending candidates in private review with freshness and origin; if insufficient, show honest count. Public feed can remain last approved date until reviewed; never auto publish unsupported AI summaries.
G5 — Scoring and downstream compatibility after core availability: reuse intelligence-routing 5 dimensions and ai-analysis suggestions; add provenance quality, professional fit (AI PM/NGO/education/SME), evidence, freshness, novelty, practical value & Diagnostic fit as calibrated weights, not unquestioned 'trust'. Show reasons and owner override. Preserve signed content_candidate contract, only dispatch after separate manual approval; the Content Ops receiver returning a receipt is distinct from export.
G6 — Isolated private preview deployment with release artifact allowlist. Inspect all untracked files; NEVER whole-repo upload. Preserve last known good site and rollback. External 302 is not validation of signed-in fetch/read/write.

## Acceptance criteria
A. Private URL authenticated on owner cellular Safari; a 30-second paste capture successful; no horizontal overflow / button overlap at 390px; no auth bypass.
B. One local capture persists after reload/export+readback. Cloud storage is PASS only with D1 server revision, second-device readback, retry idempotency, denied unauthenticated/cross-owner and explicit source consent.
C. Model summary shows evidence locators and Unknowns; fail-safe when AI is unavailable, no source loss.
D. Fresh/private candidate inbox and dated approved/public reading separated; Top N settings work without arbitrary candidate upper limit (quotas/pagination allowed).
E. Authorized signed Radar→Content Ops content_candidate produces an exact-brand receiver or explicit manual-import fallback, not false imported status.
F. Build/test gates: npm test, npm run typecheck, npm run validate:data, npm run validate:daily, npm run build:mobile, npm run health:mobile as relevant. Save sanitized logs and exact deployed build stamp.
G. Owner iPhone UAT after switching Wi-Fi OFF and a Mac-offline dependency check; explicit Mac-online LIMITED GO if unavoidable.

## Stopping rules / non-goals
Cloud_write_authorized=false remains unchanged absent Owner GO. Do not expose private ports to Internet, publish real unreviewed data, inject model keys into frontend, mix employer/client data, silently migrate D1, introduce new vendor/paid tokens, wipe dirty worktree or assert fixed daily 10 articles. If G2 remains blocked, ship reliable protected local/manual-fallback Preview, label NOT CLOUD SYNC, and request one precise unblock.

## Agent final handoff
1. Source/Origin current SHA and external URL; 2. actual file/package delta; 3. statuses Completed/Partial/Blocked/Unknown/Planned; 4. test matrix iPhone+desktop+Mac offline; 5. pending approvals/rights; 6. Owner GO or HOLD with rollback; 7. one Content Ops integration fixture.
