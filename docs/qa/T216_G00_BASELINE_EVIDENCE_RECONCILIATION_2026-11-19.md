# T216 G00 — Baseline Evidence Reconciliation

Checked: 2026-11-19 (HKT)
Scope: read-only repository and deployment identity audit. No product code, tests, provider calls, credentials, owner daily JSON, or remote data were read or changed.

## Identity and worktree

| Layer | Current observation | Evidence / limit |
|---|---|---|
| Repository | `/Users/mattgor/Documents/Daily/ai-pm-radar` | `pwd` / repository inspection |
| Branch and HEAD | `feat/cloudflare-cloud`, `a24cc8de2fe22365003dfee4c5f9f72ae6e8a9e2` | `git status --short --branch`, `git rev-parse HEAD`; matches the T216 handoff snapshot |
| Upstream | `origin/feat/cloudflare-cloud`, ahead 12 | Git status; no fetch performed |
| Worktree | Dirty; 16 tracked files changed and multiple untracked files | `git status --short --untracked-files=all`; no reset, stash, staging, or cleanup |
| Tracked diff size | 16 files, 853 insertions, 122 deletions | `git diff --stat`; includes pre-existing changes and is not attributed to this task |
| Owner daily files | `data/daily/2026-11-15.json` through `2026-11-19.json` are untracked | Names only from Git status; contents deliberately not read |

## Working tree hashes and T209 comparison

The nine current working-tree SHA-256 values below match the values recorded in the supplied `EVIDENCE/SOURCE-IDENTITY.md`. This confirms consistency with that handoff record. The underlying T209 `FINAL-SOURCE-AFTER-ALL` snapshot is not present in the locally searchable `docs/` or `experiments/` paths, so an independent byte comparison to the snapshot was not possible.

| File | Current SHA-256 | Handoff match |
|---|---|---|
| `cloud/src/collector.mjs` | `c69279cc0481d47eaddff6ac079abdda7b6603d79df366d3a858c0198a42d7fc` | Yes |
| `cloud/src/worker.mjs` | `7f92920659ad7145abcb32a71934b04161ee39b6f2cb212cdf665ad93f7606e2` | Yes |
| `cloud/src/routes-p1.mjs` | `29f5340550321eb5dce7e66c18fecd8221574f4da949e174eee295540dbc6546` | Yes |
| `cloud/src/ai.mjs` | `25692ececf6419008e818b3e4faab5aa4536f2904598d8ab7bf47330ca3d2436` | Yes |
| `cloud/src/curation.mjs` | `bc71fe7a3dd888381674aba2374e1bd605fd36a58390b76671df1db54896f920` | Yes |
| `cloud/src/reader.mjs` | `df195c9d77afa81eeaa11a63e924c8433f8a52c3b11f1327b59bf07386b48b85` | Yes |
| `cloud/public/app.js` | `7e51c0cf2a7aa9df2a7581d2d4a9b15e3a205d874fec8371a7391d12fbab57ea` | Yes |
| `cloud/public/index.html` | `bee831986198b08f7f9c94987302d839e6ae0d691936c3885e41a573b05b32f2` | Yes |
| `package.json` | `df0b49a6075d8cc89d3c4a899d0a5646df45150f9cfa1e42f14c7d98683517f9` | Yes |

## Production identity

Target recorded by the handoff: `https://radar-cloud.lamlab.cc/`. A read-only unauthenticated page open was attempted; the available web fetch tool reported that the URL was not accessible. No authenticated browser, cookies, or alternate route was used. Current production asset hash, Worker identity, D1 contents, and whether this worktree is deployed remain **Unknown**. The historical Access-login observation in the handoff is not treated as a current observation.

## Six-gap ledger

| Goal | Local evidence found | Remaining / status |
|---|---|---|
| G01 — Source registry diversity | `cloud/src/collector.mjs` (`userFeeds`); `cloud/src/curation.mjs` (`LANE_RULES`, `scoreLane`); `cloud/src/routes-p1.mjs`; tests include `tests/cloud-sources-x.test.mjs` and `tests/cloud-lanes.test.mjs` | Registry consistency and representative non-watchlist coverage need focused verification. Production source distribution is **Unknown**. |
| G02 — Ingestion contract, title, status, dedupe | `cloud/src/collector.mjs`, `cloud/src/curation.mjs`, `cloud/public/app.js`; `tests/cloud-p1-reader.test.mjs`, `tests/cloud-lanes.test.mjs` | Handoff identifies possible X seed `adapter_type` mismatch, review-action wording, and excerpt display dedupe as code-level items to verify. No production impact established. |
| G03 — Shared translation / summary | `cloud/src/ai.mjs`, `cloud/src/reader.mjs`, `cloud/src/routes-p1.mjs`, `cloud/src/worker.mjs`, `cloud/public/app.js`; tests `tests/cloud-worker.test.mjs`, `tests/cloud-p1-reader.test.mjs` | Handoff identifies narrow auto-analysis eligibility and generic `gemini_http_*` UI mapping. Live provider, quota, and production failure cause are **Unknown**. |
| G04 — Batch import and budgeted summarize | `cloud/src/routes-p1.mjs` and `cloud/public/app.js` contain `/api/sources/bulk`, `/api/inbox/import`, and `/api/kb/import` flows; tests in `tests/cloud-p1-reader.test.mjs` and `tests/cloud-lanes.test.mjs` | OPML/CSV preview, resumable progress, cancellation, and approved batch AI budget are gaps per supplied handoff. |
| G05 — Sources beyond RSS/X | `cloud/src/worker.mjs`, `cloud/src/routes-p1.mjs`, `cloud/src/collector.mjs`; source ingestion tests include `tests/cloud-sources-x.test.mjs` | Existing GitHub/YouTube/manual support and their batch behavior require focused contract verification; no evidence of configured production sources. Newsletter remains design-only. |
| G06 — Explainable scoring and quarantine | `cloud/src/curation.mjs`, `cloud/src/collector.mjs`, `cloud/public/app.js`; `tests/cloud-lanes.test.mjs` | Supplied handoff reports `score`/`pref_score` separation and feedback, but unknown-vs-zero explanations and a non-destructive unknown-relevance quarantine need focused audit. No owner-labeled evaluation set exists in this package. |

G08 (revision guards / SSRF) is a verify-first closure item, not a rewrite; G09 official public adapter stays default-off. R00 deployment/install remains explicitly unauthorized by its packet and is outside this baseline.

## Verification boundary

- No tests or builds were run, as required by G00.
- No repository file other than this G00 evidence report was changed.
- No production endpoint, deployment, schedule, AI provider, D1, or Content Ops receiver was modified.
- G00 evidence is ready for owner review. The supplied packet requires review before opening G01; this report does not claim G01–G09 complete.
