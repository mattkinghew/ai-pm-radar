# AI PM Radar v0.4.1 candidate — Cyber Kuma Review-only Learning Handoff
Date: 2026-10-28
Status: PARTIAL / LOCAL CANDIDATE; package 0.4.1-rc.0 is not deployed or Owner-accepted.
Primary Outcome: export an already human-approved and SHA-256 sealed Radar learning_pack into a Cyber Kuma needs_review JSON file, preserving provenance and avoiding automatic quiz publication.

## Actual changes
- lib/delivery-package.ts: toCyberKumaLearningIntake() validates target cyber_kuma + learning_pack and SHA-256 seal presence, converts evidence/learning objectives/concepts/question seeds to review-only format.
- components/SourceHandoffWorkspace.tsx: Download Cyber Kuma pending-review package under approved sealed Delivery Outbox. Existing export state becomes exported, not import_confirmed.
- UI does not allow manually marking cyber_kuma as imported. A receiver-side acknowledgment with independent integrity verification is future work.
- Synthetic unit tests for converter and rejection of unsealed package. No new crawler, source, schedule, provider, cloud write or auto-approval.

## Contract v1
format: cyber-kuma-learning-intake
version: 1
sourceSystem: ai_pm_radar
status: needs_review
packageId, sourceRecordId, title, sourceUrl, learningObjectives[], concepts[], questionSeeds[], evidenceReferences[], packageFingerprint, packageSha256.
No cards, questions, correct answers, generated exam claims, or automatic learning mastery. Exported review metadata is NOT a verified game-ready cartridge.

## Manual end-to-end
1. Radar SourceRecord reviewed and approved; create learning_pack handoff, human review and approve; create sealed DeliveryPackage.
2. In Delivery Outbox choose '下載 Cyber Kuma 待審核知識包'.
3. Open Cyber Kuma v39 local candidate; '題庫／Radar 匯入' → Radar Learning Intake. Pending count increases, playable pack count MUST remain unchanged.
4. Independently author and fact-check multiple-choice questions, get owner approval and rights confirmation; export private manual JSON pack and import separately.
5. Keep Radar status exported until a cryptographically verified consumer receipt mechanism is implemented. Never equate download with receipt.

## Release gates
- Source/evidence immutability and SHA-256 seal tests; npm run typecheck, npm test, npm run build.
- Synthetic unit tests: 206/206 PASS; TypeScript typecheck and Next.js build PASS; scoped diff check PASS.
- Cyber Kuma separate synthetic browser import PASS, but Radar UI download/readback with an actual sealed learning_pack is still PENDING.
- Existing Phase 2.0A protected cloud draft-to-database gate remains sole Radar T0; this optional bridge must not displace it.
- No production deployment, scheduling changes, model spend, Cloudflare policy changes, secret/PII uploads or false confirmed import.
