# AI PM Radar v2.1 — Phase 1.0 Cloudflare-first Local Spike (2026-10-14)

Primary Outcome: verify a zero-cost locally emulated Cloudflare Worker + D1 SourceRecord store with owner-authentication, compare-and-swap concurrency, and explicit review/approval.

## Outcome
**COMPLETE for isolated local POC: 20/20 integration assertions PASS using real Wrangler local Worker runtime and local D1.**
**NOT DONE:** production cloud deployment, actual Cloudflare account/auth tests, CPU/billing quotas, source fetch, Gemini API, live SourceRecord migration, Mac/iPhone sync and Mac-off acceptance.

Isolated code in experiments/cloudflare-sync-spike/:
- worker.mjs: JWT RS256 signature, issuer, audience, expiration, allowlisted email, owner subject isolation; client cannot set the owner by an unverified header. Supports new synthetic record, list/read, expectedRevision CAS update (409 on conflict), explicit review, explicit approval and invalidation on edit.
- schema.sql: D1-compatible SQLite table with per-owner SourceRecord ID and server revision.
- wrangler.jsonc: dummy database ID and synthetic test Access audience/issuer, never production credentials.
- test.mjs: ephemeral RSA keys generated in memory, local D1 schema, Wrangler --local Worker, independent synthetic owner A and owner B; temporary local database removed after execution.
- README.md: reproduction and safety limitations.

Integration assertions PASS: unauthenticated denied; spoofed header denied; wrong audience denied; expired token denied; JWT payload tamper denied; unallowlisted email denied; initial list; create initial needs_review; duplicate blocked; owner B list isolated; B read denied; B write denied; approval before review blocked; explicit review; explicit approval; stale revision conflict 409; editing invalidates review and approval; invalid evidence may be saved as unapproved draft; invalid claim excerpt blocks review; unsupported Gemini API route returns 404 (no provider calls).

## Important limitations
- Worker prototype has *minimal* v2 record shape checks, not the full production validateSourceRecord contract. It checks evidence substring presence only, NOT whether a quote supports a claim.
- Signed synthetic JWT is not a real Cloudflare Access user session; JWKS key rotation, real preview hostname protections and browser authentication are NOT tested. Never deploy synthetic test key configuration.
- Approval log, Source Library v4, reviewed fingerprint across devices, separate daily versus reuse approval, handoffs, snapshots, backup and migrations are NOT integrated.
- Local Worker success cannot establish actual Cloudflare Workers Free 10ms CPU fit or Cloudflare SLA, D1 quota fit, live 60-second Gemini, or a safe equivalent to the existing DNS-pinned SSRF-protected Node article fetch.
- Existing Radar Mac origin and Cloudflare Tunnel remain unchanged; no production code, keys, schedules, formal data or cloud resources modified. No Git stage, commit or push.

## Phase 1.1 Go/No-Go criteria (not authorized yet)
1. Owner authorizes an isolated Cloudflare Preview with $0 spend cap and an explicitly approved Cloudflare account.
2. Confirm *all* preview hostnames and API routes reject anonymous users via Cloudflare Access; no public workers.dev bypass.
3. Deploy only synthetic records. Measure real Worker CPU/request/DB limits and test two signed identities (deny matrix), D1 persistence, revision conflicts and approval invalidation.
4. Full production SourceRecord validator and immutable approvals/audit must be designed and tested before migrating live data.
5. Do not migrate data, switch radar.lamlab.cc, trigger live Gemini, or automate Research Runner without separate explicit authorizations.
6. If Worker CPU/SSRF safety is unsuitable, evaluate Cloudflare Pages + Google Cloud Run/Firestore rather than silently weakening capture safety.

Current decision: GO to scope isolated protected Preview, NO-GO to public cutover or live Owner data import.
