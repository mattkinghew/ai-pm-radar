# Cloudflare Worker + D1 isolated SourceRecord sync experiment

**Experimental only; NOT the production Radar.** Local Wrangler tests and a separately Access-protected Cloudflare Preview use synthetic records only. No real source migration or Gemini calls.

The authenticated Phase 1.1 Preview is https://radar-phase11-preview-locked.lamms280.workers.dev. The Worker and isolated APAC D1 are live, but owner-authenticated Mac/iPhone UAT and Mac-off validation remain pending. All anonymous requests to UI, script, and API returned 302 to Cloudflare Access after final deploy. No other Worker or production domain changed.

Cloud config files: wrangler-preview-cloud-closed.jsonc is the fail-closed rollback (workers.dev and Preview URLs OFF). wrangler-preview-cloud-access.jsonc enables the Access-protected test URL and binds ONLY the isolated D1, with owner email hash, CLOUD_ACCESS_REQUIRED=true and SYNTHETIC_ONLY=true. Never deploy using the synthetic local credentials or authorize unprotected routes.

Files: worker.mjs (RS256 JWT auth, D1 owner-scope, revisions and review); schema.sql (local D1 schema); wrangler.jsonc (dummy DB ID and synthetic Access claims); test.mjs (generates a temporary RSA key, starts local Wrangler, runs 20 assertions, cleans local D1).

Run locally using an already-cached/installed Wrangler CLI:

    WRANGLER_BIN=/absolute/path/to/wrangler/bin/wrangler.js node experiments/cloudflare-sync-spike/test.mjs

Test only invokes Wrangler with --local. No private test keys are written to the repository. Port 8797 is used transiently.

Limits: The prototype is NOT integrated into the real Radar SourceRecord v2 validators, Source Library v4, DeliveryPackages, or UI. The prototype text evidence gate checks presence, not semantic support. Cloudflare Access real JWKS rotation/verification configuration, append-only audit, multi-device conflict UI, actual Worker CPU budget, HTTP capture SSRF defense, Gemini 60-second request, iPhone Mac-off test and production billing are all UNVERIFIED. Do not run remote deployment or migrate actual records from this directory.

Next slice only with new approval: protected Cloudflare Preview, signed session verification with real Access, D1 quotas/performance and fake/synthetic records, no production DNS changes.
