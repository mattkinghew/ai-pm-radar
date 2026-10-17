# AI PM Radar — Phase 1.5D Release Readiness Audit

Audit date: 2026-10-15
Outcome: **QUALITY GATES PASS; RELEASE CANDIDATE NOT YET ISOLATED; PRODUCTION HOLD**.
Owner: local acceptance reported PASS in conversation, including Markdown/VTT UI and real-source Radar → Content Ops. This is **Owner-attested**, not an independently preserved receiver receipt.

## 1. Scope and actual baseline (this audit)
- Device: Mings-MacBook-Air.local — Online when audit started.
- Repo: `/Users/mattgor/Documents/Daily/ai-pm-radar`
- Branch `main`; HEAD `43882ad3c6aab0da5c0785677910338f8b7ddc51`.
- **HEAD package version: 0.1.0**; **current local package version: 0.4.0**. No Git tags were listed at audit time. HEAD therefore is **not** a verified rollback for the local 0.4.0 product.
- Before audit: 38 modified tracked files and 84 untracked status entries. The 84 entries contain **587 actual untracked files** when expanded with `git ls-files --others --exclude-standard`.
- Of those 587 untracked files, **267 are under `.playwright-cli/`**, which must never be bulk-added. The untracked count includes app/lib/components/tests/docs/fixtures and unrelated experiments. `.env.local`, `.next/` and `out/` exist on disk but are correctly excluded by `.gitignore`.
- The worktree remains dirty and is **not** an isolated release source. No `git add`, commit, tag, push, deployment, D1 migration/write, provider call or schedule activation was made during this audit.

## 2. Quality checks executed NOW (not historical assertions)

| Command / check | Result | Evidence / caveat |
|---|---|---|
| `npm run typecheck` | PASS | Exit 0 |
| `npm run test:phase-1.5d` | PASS | **21/21**, 0 failures |
| `npm test` | PASS | **202/202**, 0 failures |
| `npm run validate:data` | PASS | 2 files / 12 articles; 0 warnings or errors |
| `npm run validate:daily` | PASS | 2 files / 12 articles |
| `npm run build` | PASS | Next.js 16.2.9; 22 prerendered static pages |
| `npm run build:mobile` | PASS | Same-origin API routing mobile export ready in ignored `out/` |
| `git diff --check -- package.json package-lock.json tsconfig.json .gitignore` | PASS | **Scoped only**; untracked contents verified through TS/build/tests, not Git diff |
| Content Ops `npm test -- src/handoff.test.ts src/source.test.ts` | PASS | **25/25**; receiver code read-only, no user-workspace writes |

Warnings: Node `MODULE_TYPELESS_PACKAGE_JSON` messages on TS test files; non-failing warning, not a security gate. No independent live multi-device browser acceptance or production test was run in this audit.

## 3. Proposed bounded Phase 1.5D allowlist (NOT STAGED)

Status markers below refer to current Git index, NOT whether code was already accepted by Owner.

### 3A. Owned source / UI candidates (UNTRACKED; inspect each before staging)
- `components/SourceHandoffWorkspace.tsx`
- `components/SourceInboxWorkbench.tsx`
- `lib/approval-integrity.ts`
- `lib/secure-handoff-delivery.ts`
- `lib/downstream-handoff.ts`
- `lib/delivery-package.ts`
- `lib/intake-evidence-preview.ts`
- `lib/universal-ingestor.ts`

### 3B. Directly relevant supporting code (UNTRACKED; conditional inclusion after transitive dependency audit)
- `lib/source-inbox.ts`
- `lib/source-library.ts`
- `lib/source-library-storage.ts`
- `lib/source-library-backup.ts`
- `lib/source-draft-storage.ts`
- `lib/daily-candidate.ts`
- `lib/ai-analysis.ts`
- `lib/research-runtime.ts`
- `lib/omni-resource-bundle.ts`
- `lib/cloud-sync-capability-gate.ts`
- `lib/cloud-workbench-sync.ts`
- `components/ResearchBriefs.tsx`
- `app/source-inbox/page.tsx`
- `app/research/page.tsx`

**These are review candidates, not a complete installable manifest.** The current 0.4 app imports additional local modules, locale types, storage/helpers and package dependencies that did not exist at HEAD 0.1.0. A narrow file-only cherry-pick has NOT been proven to build from a clean tree. Transitive static and runtime imports must be enumerated and tested in an isolated candidate before staging.

**Read-only import graph check, 2026-10-15:** Starting from six Phase 1.5D/UI and route roots, a conservative local static-import traversal resolved **38 paths: 36 untracked and 2 modified tracked**, with zero unresolved local imports in this approximation. This includes additional components such as `CloudSyncOptInPanel.tsx`, `LanguageProvider.tsx`, `OneArticleCloudWorkspacePanel.tsx`, `IntelligenceRoutingPanel.tsx` and local storage/companion modules; it is **not** a complete production dependency or resource graph and does not prove a clean checkout will build. This finding strengthens the release-isolation STOP decision.

### 3C. Test files (UNTRACKED)
- `tests/approval-integrity.test.ts`
- `tests/secure-handoff-delivery.test.ts`
- `tests/intake-evidence-preview.test.ts`
- `tests/universal-ingestor.test.ts`
- `tests/cloud-sync-capability-gate.test.ts`
- `tests/source-library.test.ts` (conditional integration regression)
- `tests/source-inbox.test.ts` (conditional integration regression)

### 3D. Synthetic acceptance fixtures (UNTRACKED; checked during manual QA)
- `fixtures/intake-phase15d-demo.md`
- `fixtures/intake-phase15d-demo.vtt`

Other `fixtures/` files may contain public article excerpts, development exports or source material; do **not** include by directory wildcard. Review provenance, licensing and sensitive data individually.

### 3E. Acceptance docs (UNTRACKED; include only after evidence/version reconciliation)
- `docs/PHASE_1_5D_CLOSURE_STATUS_2026-10-15.md` — historical PARTIAL snapshot; keep chronology, not current release decision.
- `docs/PHASE_1_5D_INTAKE_UI_GATE_2026-10-15.md` — includes subsequent Owner PASS addendum.
- `docs/PHASE_1_5D_CLOSURE_REVIEW_2026-10-15.md` — reports remaining single-source gate before Owner PASS.
- `docs/PHASE_1_5D_RELEASE_READINESS.md` — this current audit, **NOT** a production approval.

### 3F. Tracked changed shared integration/config files — NEED LINE-BY-LINE REVIEW, NO WHOLE-FILE STAGE ASSUMPTION
- `package.json`: npm test already includes both Phase 1.5D regression files; also contains earlier unrelated script updates.
- `package-lock.json`: large dependency changes beyond Phase 1.5D; do not stage without exact lockfile review and clean-install verification.
- `tsconfig.json`: changed; may be necessary for current TypeScript graph, verify before including.
- `.gitignore`: changed; ignored `.env.local`, `.next/`, `out/`; **does not exclude untracked `.playwright-cli/`**.
- Other 34 modified tracked paths include large UI/CSS, content/daily JSON, docs, prompts and a separate `tools/deal-radar-storage/` subsystem. These are **OUTSIDE** the 1.5D-specific proposed scope until independently justified; do not silently discard them.

### 3G. Hard EXCLUDE (unless separate source-by-source approval)
- `.playwright-cli/**` (**267 untracked items**; browser state, screenshots/exports and backups may contain sensitive data).
- `.env`, `.env.local`, `.env.*.local`, `.dev.vars*`, provider credentials, access tokens, API keys, browser profiles.
- `.next/**`, `out/**`, `node_modules/**`, `.runtime/**`, `.vercel/**`, `.firebase/**`, `*.log`, `*.db`, `*.sqlite`, other local state.
- Real SourceRecord backups, private Content Ops source/Brand/customer data, exported live DeliveryPackage history, unknown-rights source text, `tools/deal-radar-storage/**` and unrelated experiments.
- Do not use `git add .`, `git add -A`, wildcard directories, `git clean/reset/stash/checkout -f`, or force-push.

## 4. Security boundary analysis

**Protected by existing controlled UI:**
- `components/SourceHandoffWorkspace.tsx` awaits `approveHandoffWithSeal`, `assertSealedHandoff`, `createSealedDeliveryPackage` and `assertSealedDeliveryPackage` before corresponding UI export/import-confirm actions.
- Canonical JSON object keys are sorted, strings UTF-8 encoded, arrays order-preserved; `undefined` object fields omitted and non-JSON scalar/circular input rejected. No Unicode normalization or JS-offset/UTF-8-byte-offset conversion is applied.
- Seal payload includes current source data, evidence references, Handoff interpretation and approval timestamps. Unsupported or altered old approvals fail controlled UI export.
- New Intake UI only suggests evidence; Markdown chapters/page locators and subtitle time spans do not imply approval. Missing/invalid/oversized input fails closed and manual paste remains available.
- Content Ops imported source starts as `needs_review`. Handoff import should not automatically publish. Brand isolation/duplicate behavior is supported by receiver tests.
- Cloudflare Access, Owner authorization, CAS/revision and human reviewer authentication are **separate** from local SHA-256 hash checking.

**Known hardening limit:**
- Legacy library functions `lib/downstream-handoff.ts::exportHandoffJson/handoffToMarkdown` and `lib/delivery-package.ts::createDeliveryPackage/toContentOpsIntakePackage/deliveryPackageToMarkdown` use the older contract and do not intrinsically require the new SHA-256 wrapper. Scripts `scripts/build-delivery-fixtures.mjs`, `scripts/build-receiver-e2e-fixture.mjs`, `scripts/build-pspo-learning-pack-fixture.mjs` exercise these legacy functions. Do **not** present their outputs as sealed production approvals or expose raw helpers as privileged API endpoints without additional guards.
- A digest is NOT an authenticated signature; an attacker able to edit both local data and its seal can recompute it. Owner scoping and trusted review/audit infrastructure are needed for production authorization.
- Owner-reported real-source receiver PASS is accepted as UAT outcome but actual source URL, source ID, Handoff ID, package digest, receiver item/Brand/receipt and reload screenshots were **not independently archived** here. Do not invent them or mark `import_confirmed` automatically.

## 5. Reproducibility and rollback policy
- Current `HEAD` is version **0.1.0**, whereas tested worktree is **0.4.0**. No release tags were found. Therefore `HEAD` is **NOT** a known-good rollback for this current version.
- Before any release: identify and record the actual live Cloudflare Pages deployment ID/build artifact and verified rollback deployment, then independently capture a clean, reproducible 0.4 baseline and an isolated exact-file candidate.
- Produce a clean-build bundle from the approved candidate; use dry-run checks for leaked secrets and rights before publication. `out/` is a generated artifact, **not** source to commit.
- Rollback means redeploying/activating the verified previous deploy from the actual hosting provider plus verifying protected API/access behavior. Do not assume a stale Git SHA recovers production application data.
- Do not deploy automatically while Cloudflare Access, D1 write OFF, identity, source rights, deployment-protection credentials, or rollback are unknown.

## 6. STOP / GO checklist

| Gate | Today |
|---|---|
| Owner local acceptance | PASS, Owner-reported |
| Local TypeScript/test/build/validators | PASS, independently re-run |
| Receiver compatibility tests | PASS, independently re-run |
| Exact clean Git release baseline / complete dependency closure | **BLOCKED** |
| Release candidate manifest excluding all unreviewed files | PARTIAL (proposed list above, not isolated) |
| Archived original article identity + receiver receipt | NOT ARCHIVED |
| Local browser / 390, 768, desktop Console regression after isolated candidate | NOT RE-RUN |
| Static-artifact secret/right-to-publish scan | NOT DONE; no artifact approved |
| Live Cloudflare Access / identity and recipient authorization | NOT REVERIFIED |
| Production D1 write mode and API routing | HOLD; no writes authorized |
| Verified previous deployed build and rollback deployment ID | UNKNOWN |
| Explicit Owner approval of Git commit/tag/push/deploy | NOT GIVEN |

## 7. One highest-priority blocker and smallest safe next action

**BLOCKER:** There is no complete, reviewable, reproducible Git release candidate. `HEAD` is 0.1.0 while the accepted 0.4.0+1.5D runtime depends on extensive intermingled untracked and modified files; direct staging could include local browser exports/private material and unrelated product changes.

**NEXT ACTION (requires separate Owner GO before any Git write):**
1. Preserve existing dirty tree untouched; produce an exact transitive dependency manifest from a read-only module graph and record hashes.
2. Using an Owner-authorized **isolated release preparation branch/worktree or independent clean copy**, apply only approved changes from an explicit path allowlist after reviewing each diff and untracked file.
3. Prove clean `npm ci` + test + build and synthetic receiver compatibility in that isolated candidate.
4. Archive real-source UAT identifiers from Owner-provided redacted export, secure the exact previous production deployment/rollback, and independently review access/secrets.
5. Seek distinct approvals for Git commit/tag, push, and deployment. Until then **Production Release HOLD**.

Decision: `Phase 1.5D LOCAL ACCEPTED; RELEASE READINESS PARTIAL; RELEASE STOP`.
