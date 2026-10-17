# AI PM Radar — Repository Instructions

## Immediate goal
- This is the second active engineering repo; its 30-day job is to verify consumer handoff and close the existing v0.4 routing acceptance gaps, not start a new crawler.
- Read docs/GOALS_2026-10-12_2026-11-10.md and docs/CONTEXT_SUMMARY.md before work.
- Priorities: T0 source/evidence/review integrity and blocked delivery; T1 consumer compatibility; T2 scheduled intelligence experiments; Later new platform connectors.

## Real baseline
- Current package v0.3.0 already passed the v0.3 browser and local gates according to dated documentation, while v0.4 rule-based routing is partly implemented. Validate fresh HEAD and tests before making release claims.
- The local checkout has extensive pre-existing tracked and untracked changes. Do not reset, clean, stash, overwrite, stage, or commit them without explicit owner instruction.
- Preserve immutable DeliveryPackage snapshots, fingerprint/stale detection, source facts vs. derived analysis, provenance, independent human review and approvals.
- `exported` must NOT mean `import_confirmed`; only receiver-side evidence can establish successful acceptance.

## Safety
- Keep Production daily JSON, Cloudflare Access, tunnel settings, model keys and automation schedules unchanged without explicit approval.
- Avoid new external network calls, live Gemini usage, provider migration, private documents, secrets, or employer/customer material. Use synthetic fixtures.
- Never treat a heuristic routing score as fact verification; confidence denotes observed signal coverage only.

## Engineering delivery
- One Primary Outcome per task, at most two secondary outcomes; no cross-repo refactors and no speculative alternate Knowledge Pack schema.
- Report Completed / Partial / Blocked / Unknown / Planned. Scope minimal changes to the verified gap and add tests.
- Validate using relevant `npm test`, `npm run typecheck`, `npm run validate:data`, `npm run validate:daily`, `npm run build`, `npm run build:mobile` and scoped diff checks as needed.
- Existing unrelated global `git diff --check` warnings must be attributed accurately, not concealed or 'fixed' opportunistically.
- No merge, deploy, scheduling activation, Git push, or client-data import without explicit owner authorization.
