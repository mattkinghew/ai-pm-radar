# AI PM Radar v2.1 — Low-cost Cloud Hosting Alternatives (research addendum, 2026-10-14)

Status: researched architecture options only. NO account/project provisioning, migration, credentials, API calls or production changes. All pricing USD, usage beyond included quotas and Gemini tokens excluded. Confirm final plan before subscribing.

## Why previous $45/month estimate is not mandatory
Vercel Pro (~$20) + Supabase Pro (~$25) is one managed commercial option, NOT an availability prerequisite. Radar package is Next.js 16.2.9 with `output: 'export'` and static `out/`; current API is a separate Node helper protected behind Cloudflare Access and Tunnel. Mac-off availability needs both cloud page + cloud API + authoritative synced storage, not simply a static deployment.

## Options ranked for this repository

1. **Cloudflare Pages static export + Workers + D1 + existing Cloudflare Access**: Free tier possible at <=100,000 Worker requests/day and 10ms CPU per HTTP request; unlimited static requests. D1 Free 5GB account aggregate, but **500 MB per database**, 5 million rows read/day, 100,000 rows written/day, 7-day Time Travel. Access Free supports up to 50 users. No Supabase-style idle project pause documented for D1. Significant API rewrite is needed before claiming feasibility.
2. **Same Cloudflare stack on Workers Paid, $5/month minimum plus overages**: 10 million Worker requests/month and 30 million CPU ms/month included; D1 paid includes first 5GB across databases with usage tiers. Removes 10ms CPU cap (up to 5min CPU per request when configured). Waiting for a remote 60s Gemini network response is wall-clock, not CPU, while client remains connected. Preferred low-fixed-cost commercial or reliable personal prototype if Worker rewrite/security test passes. Paid plan is not an SLA guarantee.
3. **Cloudflare Pages + Google Cloud Run Node API + Firestore**: Cloud Run request-based free tier nominally 2 million monthly requests/180k vCPU-seconds/360k GiB-seconds at Tier 1 baseline; free quota applied per billing account and geography can affect actual rates; request timeout supports 60m. Firestore free 1GiB and 50k reads/20k writes per day. Existing pinned DNS/Node capture logic is easier to adapt to Cloud Run than Worker; however, Google Cloud billing account required EVEN for free usage; watch egress, builds, secrets, logs and usage-based charges, manage spending controls. Use protected verified auth on app and API; never expose Gemini key.
4. **Railway Hobby ($5/month minimum usage credit) or Free ($1/month included resource credit)**: Node services easier to run, but RAM/CPU/egress and persistent database may take total above $5. Verify real estimated resource usage before choosing. Larger operational footprint than Pages+Worker.
5. **Vercel Hobby + Supabase Free ($0)**: useful for non-commercial testing, but Hobby has noncommercial usage restriction, and Supabase Free may pause after 7 days of insufficient use; not ideal for strict ready-at-any-time objective. Paid Vercel Pro+Supabase Pro ~$45/mo baseline is optional, not mandated.
6. **Render Free/Oracle Always Free**: Render Free web service sleeps after 15min idle (roughly 1min wake), filesystem is ephemeral, free Postgres expires after 30 days. Oracle Always Free compute may reclaim idle instances. Not preferred for the Owner's unattended reliability target.

## Technical non-negotiables
- Existing `scripts/source-fetch-helper.mjs` uses `dns.lookup()` and pinned-address `node:https` request for SSRF/DNS-rebinding defense. Cloudflare Workers node:dns lists `lookup` as **NOT IMPLEMENTED** as of 2026-10-14. Cannot simply deploy current helper to Workers. Reimplement URL allowlist, private/reserved IP blocking, safe redirects, fetch limits; independently security-test SSRF and DNS rebind resistance. Do not replace with unchecked `fetch(url)`.
- Browser IndexedDB is per-browser local; need server-side SourceRecord, immutable evidence, revision CAS/409 conflict detection, per-source independent reviewed/approved fingerprints, secure data access, and non-destructive migration.
- Gemini endpoint expected 60s and proxy 70s. Benchmark real function response time, CPU limit, provider network region/availability and user disconnect behavior with synthetic fixtures before any paid live test.
- Cloudflare Access protects existing protected hostname but a new Pages/Workers preview `*.pages.dev` or `*.workers.dev` address may bypass policy if not separately restricted; enforce auth on every API and data request and test anonymous denied. Auth may be verified Access JWT with issuer/audience/allowed email and D1 owner mapping; do not merely trust a client-supplied user ID.
- D1 Free is a quota-limited database, not a guarantee of service-level availability. Add off-platform export/restore checks, at least before migrations; free Time Travel retains only 7 days. Limit auto writes and batch record versions to avoid hitting per-day caps.
- Existing Research Runner writes local files and spawns processes; DO NOT bundle in simple Pages/Workers hosting; defer /automation/* until a durable job/queue redesign is authorized.

## Recommended cost-first Phase 1 decision
**Primary experiment**: static `out/` preview on Cloudflare Pages + Access-protected Worker/D1, with synthetic SourceRecord auth/read/write and one no-provider-calls /api/analyze test; verify quota and CPU performance. Keep production radar.lamlab.cc on existing protected tunnel.
**Decision fork**: if Worker API/SSRF implementation safely fits CPU/runtime, choose Cloudflare Workers Paid ($5/mo) as production candidate (or Free until limits identified). If significant Node rewrite risk, prototype Cloud Run+Firestore alongside Pages for lower migration complexity and pay-per-use, with billing guardrails.
Before any cloud resource setup: Owner approval, account access, budget, privacy classification, rollback plan, no live data transfer. Before production cutover: Mac-off iPhone login/read/new source and review/approval/invalidation, auth isolation, restored backup.

## Official sources checked on 2026-10-14
- https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/
- https://developers.cloudflare.com/pages/functions/pricing/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/workers/runtime-apis/nodejs/dns/
- https://www.cloudflare.com/plans/zero-trust-services/
- https://cloud.google.com/run/pricing
- https://docs.cloud.google.com/run/docs/configuring/request-timeout
- https://firebase.google.com/docs/firestore/quotas
- https://docs.cloud.google.com/billing/docs/how-to/manage-billing-account
- https://docs.railway.com/pricing/plans
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://vercel.com/docs/plans/hobby
- https://render.com/docs/free
- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
