# Project Organization System

## Purpose

This document defines the simplest operating workflow for using DevSpace, ChatGPT, and Codex2.0 with this project.

- DevSpace exposes selected local project folders to ChatGPT through MCP (Model Context Protocol).
- Codex should handle actual code changes, tests, bug fixes, and scoped implementation work.
- ChatGPT + DevSpace is best used for project reading, planning, documentation, task breakdown, and review of Codex changes.

## Simplified Startup Checklist

Check the current Dev Tunnel account:

```bash
devtunnel user show
```

If you are not logged in:

```bash
devtunnel user login
```

Start DevSpace:

```bash
/Users/mattgor/Documents/Daily/scripts/start-devspace.sh
```

Test local health:

```bash
curl -i --max-time 10 http://127.0.0.1:7676/healthz
```

Success should include:

```json
{"ok":true,"name":"devspace"}
```

## Public MCP Check

The public MCP URL must come from the latest DevSpace startup output.

Do not blindly reuse an old URL such as `qjdpsk4f-7676.jpe1.devtunnels.ms` if the tunnel has changed.

Public health check placeholder:

```bash
curl -i --max-time 10 https://xxxxx-7676.xxxx.devtunnels.ms/healthz
```

MCP endpoint test:

```bash
curl -i --max-time 10 https://xxxxx-7676.xxxx.devtunnels.ms/mcp
```

`401 Missing Authorization header` is normal for the MCP endpoint because it is protected.

## Common Mistakes

- Do not paste Markdown fences like ` ```bash ` into Terminal.
- Do not paste labels like `DevSpace public MCP:` into Terminal.
- Only paste the actual command.
- Keep the DevSpace terminal open.
- Do not press `Ctrl+C` while DevSpace is running.

## allowedRoots Rule

Current allowed project examples:

- `/Users/mattgor/Documents/Daily/ai-pm-radar`
- `/Users/mattgor/Documents/Daily/cyber-kuma-learning-dungeon`

Rules:

- Add only the specific repo path when needed.
- Do not add `/Users/mattgor`, `/Users/mattgor/Documents`, or the whole `Daily` folder.
- Do not expose `.env`, `.ssh`, `auth.json`, API keys, tokens, or passwords.

## Codex Task Workflow

1. ChatGPT reads project context through DevSpace.
2. ChatGPT generates a small Codex prompt.
3. Codex modifies only scoped files.
4. Codex runs verification.
5. ChatGPT reviews Codex output through DevSpace.

## Standard Codex Output Format

```text
Completed:
- ...

Files changed:
- path: purpose

Validation:
- command: pass/fail
- command: pass/fail

Risks / Notes:
- ...

Next suggested step:
- ...
```

## Troubleshooting

- If local `/healthz` fails, DevSpace is not running.
- If public tunnel times out but local works, the tunnel may be stale or not hosted.
- If `Login token expired`, run `devtunnel user login`.
- If `Unauthorized tunnel access`, the tunnel may belong to another account or the script may be using an old tunnel ID.
- If ChatGPT says `We couldn't connect your account`, remove the old MCP connector and reconnect using the latest public MCP URL.
