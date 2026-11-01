# 02 — Obsidian sync (Mac launchd)

## Goal
Every morning pull new/updated KB entries from `GET /api/kb/export?format=json[&since=ISO]` into Matt's Obsidian vault as Markdown files with YAML frontmatter.

## Context
- Endpoint (commit 9e92910): returns `{count, files:[{id,path,updated_at,content}]}`; content already has frontmatter (`radar_id`, `title`, `url`, `source`, `category`, `score`, `origin`, `tags`, `created`, `updated`).
- Auth today: `/api/kb/*` requires the owner Cloudflare Access JWT. The service token `jun-radar-ingest` is only allowed on `/api/ingest` + `/api/sources` (Access app "AI PM Radar Ingest"), and the Worker's bearer path only allows `POST /api/ingest/x` + `GET /api/sources`.
- **TCC lesson:** the old `com.ai-pm-radar.research` LaunchAgent failed with EX_CONFIG (78) because `WorkingDirectory` was under `~/Documents`. Put the script + working dir in `~/Library/Application Support/ai-pm-radar-sync/` (or `~/.local/share/...`), never under `~/Documents`, `~/Desktop`, `~/Downloads`. If the vault itself lives under `~/Documents`/iCloud, document that the job needs Full Disk Access for `/bin/zsh`/node, or pick a vault outside protected folders.

## Scope
1. `tools/obsidian-sync/sync.mjs` (Node 24, no deps): reads config `~/Library/Application Support/ai-pm-radar-sync/config.json` (`baseUrl`, `vaultDir`, `subfolder: "Radar"`), credentials from macOS Keychain via `security find-generic-password` (never from files in repo, never logged).
2. Incremental: store `last_sync` in state file; write `vault/Radar/<path>`; if a file with same `radar_id` exists under a different name, rename; never overwrite a file whose body was edited locally after last sync — write `*.conflict.md` instead.
3. `tools/obsidian-sync/com.ai-pm-radar.obsidian-sync.plist` template (StartCalendarInterval 08:30 HKT, WorkingDirectory outside ~/Documents, StandardOut/Err to `~/Library/Logs/ai-pm-radar-sync.log`) + `install.sh` that copies to `~/Library/LaunchAgents` only when run by Matt (print instructions; do not auto-load).
4. Worker side (proposal only, behind a flag): add `GET /api/kb/export` to bearer routes ONLY if Matt approves; document the Access policy change needed (add `/api/kb/export` path to the ingest Access app). Implement behind `KB_EXPORT_BEARER="true"` var defaulting off, with tests.

## Acceptance Criteria
- Tests with a fake HTTP server + temp vault: first sync writes N files; second sync with `since` writes only changed; local-edit conflict produces `.conflict.md`.
- `plutil -lint` passes on the plist; WorkingDirectory not under `~/Documents`.
- No secret appears in logs, repo, or test output.

## Non-goals
Two-way sync (Obsidian → D1), Obsidian plugin, loading the LaunchAgent, creating/rotating tokens, editing Access.

## Verification
```
node --test tools/obsidian-sync/*.test.mjs
plutil -lint tools/obsidian-sync/com.ai-pm-radar.obsidian-sync.plist
npm test
```

## Constraints
No deploy, no push, no `launchctl load`, no Access/secret changes; Matt installs.
