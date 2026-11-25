# T216 G05 — Multi-source preview beyond RSS/X

Date: 2026-11-21 (HKT)
Status: Local implementation and synthetic verification complete; independent review ACCEPT.

## Scope and outcome

Extended the existing source-line and import preview contracts to recognize the official adapter types already supported by the Radar collector: RSS, X handles, GitHub Search, GitHub Releases, and YouTube channel Atom. No external source was fetched during these tests. The single source registration route and manual Source Inbox capture path remain the existing entry points.

The parser now accepts `owner/repo`, GitHub repository/release URLs, GitHub Search URLs or the explicit `github_search: query` form, YouTube channel IDs, and the official YouTube Atom URL. CSV rows infer known forms or honor an explicitly mapped adapter type. OPML `xmlUrl` rows use the same classifier. Ambiguous platform URLs are reported as `needs_map`; unsafe URLs stay invalid. Batch confirmation continues to use the existing source registry, canonical identity, and idempotent import job. Preview performs no write and no AI call.

## Newsletter boundary

Newsletter support is design-only and was not implemented. A future version may accept content only through a user-selected, dedicated forwarding address or an equivalent official opt-in endpoint. It must not scan a personal mailbox, reuse mailbox credentials, read cookies, or reuse browser sessions. This package adds no mailbox connection or newsletter ingestion route.

## Verification

- `node --test tests/cloud-source-import.test.mjs tests/cloud-worker.test.mjs tests/cloud-p1-reader.test.mjs` — 61/61 passed.
- `npm test` — 358/358 passed.
- `npm run typecheck -- --incremental false` — exit 0.
- `node --check` on changed JavaScript modules — exit 0.
- Synthetic route checks confirm preview is read-only, recognized sources use the shared registry, duplicate canonical entries are not re-added, ambiguous entries are not registered, and all import paths use zero AI calls.
- No live GitHub/YouTube fetch, credentials, production source configuration, deployment, or production D1 mutation was used. Production adapter availability remains Unknown.

## Compatibility and remaining limits

The older line-based preview previously showed arbitrary non-URL text as `invalid`; it now shows `needs_map` so the user can identify the missing source type. Such rows remain non-importable until corrected. Existing URLs and X-handle input behavior remain supported. Manual URL/text capture remains in the existing Source Inbox.

G04 remains incomplete: invalid OPML rows are persisted as invalid and the retry endpoint only retries transient `failed` rows. That separate acceptance gap was not changed here.

## Independent review

- Initial read-only review returned **REJECT** because non-profile X/Twitter URLs fell through to RSS. This was reproduced with synthetic status, home, and search URLs.
- The second implementation round routes all remaining `x.com` / `twitter.com` URLs to `needs_map` before generic HTTPS classification. Route tests prove these rows persist as invalid and are never registered.
- Final read-only review returned **ACCEPT** for the scoped G05 change. No other critical mapping or registration defect was found.

## Files

- `cloud/src/reader.mjs`
- `cloud/src/source-import.mjs`
- `cloud/src/routes-p1.mjs`
- `cloud/public/app.js`
- `cloud/public/index.html`
- `tests/cloud-p1-reader.test.mjs`
- `tests/cloud-source-import.test.mjs`
- `tests/cloud-worker.test.mjs`
