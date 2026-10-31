# Threat Model — Phase 2.0A Draft Sync

## Assets and trust boundaries

- SourceRecord body, source URL, evidence, derived analysis, review/approval state and local IndexedDB drafts.
- Cloudflare Access identity → Worker authorization → owner-scoped D1; production static origin and local companion helper are a separate path.
- The browser and submitted JSON are untrusted. Owner identity must come from verified server-side Access context, never an owner field supplied by the client.

## Existing controls observed

- Production origin health is fail-closed without Access JWT; helper and origin bind loopback. Public URL traffic crosses Access/Tunnel.
- Synthetic Worker checks Access identity before UI/API data, binds DB queries to Owner subject, checks same-origin mutation requests, limits bytes and fixed fixture IDs, validates SourceRecord/evidence, uses SHA + expected revision, and stores immutable revision/event rows.
- New records and edits are forced to `needs_review` / `not_approved`; real-source flags remain false in the synthetic profile.
- No external article fetching occurs in the synthetic sync test. No model call or credentials were used.

## Gaps / residual risks

- Real Access signature/issuer/audience verification at the live preview edge was not independently tested this turn; harness identity was simulated. Unauthenticated browser was redirected to Access login, which proves the edge challenge only, not an authenticated Worker invocation.
- Production Source Inbox has no verified D1 read/write integration. A client must not present IndexedDB completion as cloud persistence.
- Create retry is duplicate-safe but not idempotent-success: response-loss recovery needs an owner-scoped read before retry.
- D1 backup/restore, Time Travel retention behavior, quotas under actual Worker runtime, and cross-owner external denial were not freshly tested against Cloudflare.
- Access protects the preview, but identity-to-owner mapping and eventual real-user lifecycle require a fresh review before arbitrary real drafts.
- If the Mac is asleep/offline, the production origin/tunnel path is unavailable. The separate Worker/D1 may be independent, but that is not proven by local tests.

## Prohibited in this phase

Do not expose internal ports, weaken Access, use unprotected `workers.dev`, set real-write capability true, add employer/client/private material, upload unapproved SourceRecords, route model keys to browser, or equate capture with verified/reviewed/approved/published.
