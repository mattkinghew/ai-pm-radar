# T216 R8 — synthetic browser backup round-trip

Date: 2026-11-21 HKT  
Status: **Completed for synthetic export/import flow**; this is not production or real-material recovery evidence.

## Scope and steps

- Served the already-built static candidate from `/private/tmp/radar-g09-build.0JhEYm/out` on `127.0.0.1:8796`; no dev server, remote API, model, or production service was used.
- In a fresh browser session, pasted three synthetic text records separated by blank lines, selected **整理成草稿**, and confirmed three independent cards showed captured, unreviewed, and unapproved states.
- Selected **匯出收集草稿** and received the browser download `source-inbox-draft-2026-11-21-1.json`.
- Copied the synthetic backup to `docs/qa/artifacts/T216-R8-source-inbox-backup-synthetic-2026-11-21.json` (SHA-256 `5deb8eb4eb786ae2e6bdba4d17a20e153cab8ba1871964a835ccb386a346a2ee`). JSON readback confirmed backup version 1, one workbench record containing three materials, and no review or approval fingerprints.
- In a separate clean browser session, imported that JSON through Advanced Tools, observed all three cards, reloaded and observed them again, then imported the same backup a second time. Readback remained exactly three cards; all were unreviewed and unapproved. This confirms same-origin browser export → file → fresh-origin import → reload → duplicate import behavior for this fixture.

## Limits

- Input and backup contain synthetic test text only. No private, owner, customer, or production data was used.
- Browser console reported expected static-preview 404s for `/api/automation/status` and `favicon.ico`; these endpoints are not part of this local static-only export/import check. No application JavaScript error was observed.
- This did not test authenticated APIs, other browser vendors, mobile hardware, production storage, backup migration from older schemas, or formal daily candidate approval/export.
- Static preview process was stopped after the test. No server, worker, D1, or production deployment was left running or changed.

## Follow-up — explicit fresh-profile evidence (2026-11-21 HKT)

- Repeated the browser test using two newly named Playwright CLI sessions: `t216-r8-fresh-profile-20261122` and `t216-r8-import-fresh-20261122`. CLI session inventory reported Chrome with `user-data-dir: <in-memory>` for the fresh session; the import session was opened separately, with no prior site storage. The static origin was `127.0.0.1:8797`.
- In the first session, pasted three synthetic records using actual blank-line separators; the UI showed three cards, each `已取得素材`, `未審核`, and `未批准`. Triggered export and received a browser download event for `source-inbox-draft-2026-11-21.json`.
- Saved the downloaded JSON at `docs/qa/artifacts/T216-R8-source-inbox-backup-synthetic-fresh-profile-2026-11-21.json`. File size: 11,506 bytes; SHA-256: `828d76083f0901bb50b55ff171b3d0b17b8375faf7a56fa15df3ffe7304338cc`. Readback: version 1, one workbench item, three materials; each body exactly equals its input. All materials are `captured`, `analysisStatus=not_requested`, with null review/approval fingerprints and null approval seal.
- Imported the downloaded artifact in the second clean session. The UI reported successful import and displayed all three cards. Reload restored all three. Re-importing the same artifact and exporting again still produced exactly three materials, all captured/unreviewed/unapproved. Post-import and post-reload accessibility snapshots are saved under `docs/qa/artifacts/T216-R8-new-profile-*.yml`.
- The static preview console reported only expected 404s for `/favicon.ico` and `/api/automation/status`; these are absent from this static-only build and not part of backup import. No application runtime exception appeared. The backup file itself was parsed and its version, record counts, body equality, and review/approval state were checked with Node; no independent standalone JSON Schema validator was run, so that specific formal validator criterion remains Unknown.
- This establishes a distinct isolated in-memory browser context, export download, import, reload persistence, and duplicate-import behavior for this synthetic fixture. It does not establish a persistent on-disk browser profile, cross-browser behavior, authenticated APIs, or Production behavior. No approval, publication, D1, Worker deployment, or formal daily-data write occurred.

## Follow-up — current-build round-trip and import validation (2026-11-21 HKT)

- Rebuilt the current source with `npm run build:mobile` into an isolated output while preserving and restoring the pre-existing `out/` and `.next/`. Served that build only on `127.0.0.1:8798`.
- Used two distinct fresh Playwright sessions (`t216-r8-current-export-20261121`, `t216-r8-current-import-20261121`); `playwright-cli list` reported both as Chrome with `user-data-dir: <in-memory>`. Entered three synthetic records, exported via a real browser download event, imported into the second clean session, and confirmed all three after reload. Re-importing the same file still yielded exactly three unique records. All stayed `captured`, unreviewed, and unapproved.
- Current-build download: `docs/qa/artifacts/T216-R8-current-build-backup-synthetic-2026-11-21.json`, 11,506 bytes, SHA-256 `041a2b0d52f7d6c6ff7ceab028eaa3852cef6f20267be4f47e1251068afa7fc4`. Post-duplicate-import export: `docs/qa/artifacts/T216-R8-current-build-after-repeat-import-2026-11-21.json`, SHA-256 `2cd3b24f92b79d4218c88c8eb3366a97666c0dbf7a835d2882746a3dbf86a0be`. Readback confirmed version 1, one workbench item, three unique material IDs, exact input/body equality, `analysisStatus=not_requested`, and no review/approval fingerprints or approval seals.
- On the current build, imported a synthetic version-1 backup with a malformed nested material status. UI displayed `草稿備份版本或格式不支援，未匯入。`; the three previously restored cards remained. The importer now validates restore-critical workbench/material shapes before applying state. Regression: `node --test tests/source-inbox.test.ts` — **25/25**.
- Browser snapshots: `docs/qa/artifacts/T216-R8-current-build-*.yml`. Console showed only static-preview 404s for `/favicon.ico` and `/api/automation/status`; no application runtime exception. The standalone JSON was parsed and checked against the versioned workbench envelope and nested required fields; no external JSON Schema document is defined for this backup format.
- Server on port 8798 and both browser sessions were stopped after verification; `lsof -nP -iTCP:8798 -sTCP:LISTEN` returned no listener. No approval, publication, D1 write, Worker deployment, or Production change occurred.
