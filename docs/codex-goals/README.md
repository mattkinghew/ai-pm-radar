# Codex goals (AI PM Radar)

Token-heavy follow-ups after P0 (commits 9e92910, 5a94a87). Run each with local ChatGPT Codex, one goal per branch off `feat/cloudflare-cloud`.

Global constraints for EVERY goal:
- NO `wrangler deploy`, NO `--remote` D1 migrations/execute, NO `git push`, NO Cloudflare dashboard/Access/secret changes, NO logins, NO paid APIs.
- Never print or commit secrets (`.dev.vars`, tokens, `/workspace/.secrets/*`).
- Keep `npm test` and `npm run cloud:smoke` green; commit locally with clear messages.
- Matt approves deploys separately.

| # | Goal |
|---|------|
| 01 | Event clustering with Workers AI embeddings + Vectorize (P1) |
| 02 | Obsidian sync via Mac launchd (P1) |
| 03 | Learned ranking from item_actions (P1) |
| 04 | worker.mjs router refactor (P2) |
