# T216 R4 — Research Runner & Daily Intelligence

Checked: 2026-11-21 (HKT)

## Result

**PASS — deterministic synthetic resilience path.** A simulated three-day Hong Kong-time sequence now verifies: Day 1 collection and analysis complete; Day 2 one feed times out while another source is retained and captured; Day 3 a provider error preserves captured body and failure history without marking review/approval or retrying automatically. The state keeps all three dated runs and the appropriate `completed` / `partial` / `failed` states.

Existing contracts retain source dates as observed or `null`, distinguish full text from summary-only, preserve evidence in Research Brief, record provider/model and usage when supplied, enforce daily source/body/analysis/brief quotas, and require explicit retry for failures. Suggested actions remain bounded and advisory; no source is auto-approved.

## Verification

- `node --experimental-strip-types --test tests/research-runner.test.mjs tests/research-runtime.test.mjs tests/research-schedule.test.mjs` — exit 0, **27/27 passed** before the additional resilience fixtures.
- `node --experimental-strip-types --test tests/research-runner.test.mjs` — exit 0, **9/9 passed** after adding feed and provider failure regressions, including the three-day simulation.
- No live provider, schedule, real source, or formal daily file was used.

## Limit

This is a synthetic clock-controlled test, not three days of real operation. The production Research runtime is host-local and may be stale or unavailable while the Mac/runtime is stopped.
