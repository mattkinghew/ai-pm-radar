# Local Verification Record - 2026-07-01

## Status

Local Verified Baseline

## Scope

Project path:

```text
/Users/mattgor/Documents/Daily/ai-pm-radar
```

This verification records the local build, static export, data validation, and dev server checks for the AI PM Radar portfolio project.

## Verified Items

- `npm install`: pass
- `npm run build`: pass
- Static export generated in `out/`
- `data/daily/2026-06-25.json`: valid JSON
- `npm run validate:data`: pass
  - Checked files: 1
  - Articles checked: 6
  - Warnings: None
  - Errors: None
- `npm run validate:daily`: pass
  - Files checked: 1
  - Articles checked: 6
  - Validation passed
- Local dev server: pass
  - `curl -I http://localhost:8095` returned `HTTP/1.1 200 OK`

## Notes

- `npm run lint` is not configured in `package.json`; this is not treated as a failed test.
- Port `8095` may already be occupied if a previous Next.js dev server is still running.
- `EADDRINUSE` on port `8095` indicates that another process is already listening on that port, not that the Next.js app failed to build.

## Portfolio Summary

AI PM Radar is a static Next.js portfolio project for tracking AI product management trends, with schema-validated daily JSON content, static export support, and a documented local verification workflow.
