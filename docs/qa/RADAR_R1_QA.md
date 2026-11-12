# Radar R1 QA — preference calibration and lane-aware local collection

日期：2026-11-12。範圍：個人 AI PM Radar、本地合成資料。基線 `feat/cloudflare-cloud` / `8d60943`，工作樹原有 Nov 2 韌性 WIP；沒有清理或覆寫。

## TASK-ID / Goal / Acceptance criteria / Non-goals

- TASK-ID：Radar R1。
- Goal：以合成偏好金標固定 research-lane 排序，並讓本地 RSS/HN collector 寫出 cloud 使用的 lane 與偏好分數欄位。
- Acceptance criteria：Top 10 金標及 lane 測試；collector 與本地 daily fixture 共用 `scoreLane`；fixture 通過兩個 daily validator；`npm test` 不少於 286；既有 capture 201 斷言維持。
- Non-goals：Owner 真實排序驗收、X scraper、付費 API、遠端 D1、排程啟用、部署、commit 或 push。

## Status by area

| Area | Status | Evidence / limit |
|---|---|---|
| Calibration | Partial | `preference-gold-order.synthetic.json` 以 20 個合成信號向量、Top N=10 固定 lane 與排序；測試通過。它不是 37 筆收藏原文或 Owner relevance 標註。多筆同分時測試用 fixture 順序作穩定 tie-break；cloud feed 仍有自身次排序。 |
| Collector lanes | Completed | RSS/HN inbox 項目及合成 daily fixture 都直接使用 cloud `scoreLane`，輸出 `lane`、`pref_score`、`pref_reasons`、`injection_suspect`；原有分類、發佈時間、`needs_review` 和 Nov 2 HTTP 403 保護保留。兩個 validator 通過。 |
| X boundary docs | Completed | `docs/ops/DAILY_UPDATE_WITHOUT_GROK_BOT.md` 說明評分只涵蓋規則信號；X 仍依賴 Grok Bot，drop-folder 只供經授權的手動匯入，沒有新增讀取器。 |
| Smoke | Blocked | 沙盒 loopback bind 預檢回報 `EPERM: listen EPERM: operation not permitted 127.0.0.1`；沒有執行 `npm run cloud:smoke`，也沒有宣稱 HTTP / D1 smoke 完成。 |

## Gold-order scope and mismatch

金標以 `threads-preference-summary-2026-11-10.md` 的優先主題及 `threads-source-inputs-2026-11-10.json` 的一基序號為索引。`signal_text` 是合成測試信號，沒有把收藏時間當發表時間，也沒有附加來源權重。預期 Top 10 序號：`23, 18, 2, 9, 33, 16, 17, 21, 7, 11`。原摘要的人工作編輯順序是 `23, 2, 18, 33, 16, 17, 9, 11, 21, 7`。兩者 Top 10 成員相同，但第 2–10 名的相對次序不同：2/18、9/33/16/17、11/21/7；且 16/17 和 21/7/11 的合成分數同分。這些差異源於規則權重與合成信號覆蓋；原摘要編輯分數含可行動性與可驗證性判斷，`scoreLane` 只量度詞彙信號。未以 fixture ID 或虛構日期特判，亦未在缺少 Owner 逐條標註時改權重。因此 Calibration 保持 Partial，不作真實 Top 10 或產品偏好校準完成宣稱。

## Changed files / diff

- `scripts/daily_radar_collector.mjs`：本地候選沿用 cloud `scoreLane`。
- `scripts/daily-radar-local-fixture.mjs`：合成 daily JSON 加入同一組欄位；保留 draft、人審及拒絕覆寫。
- `tests/daily-radar-collector.test.mjs`：新增 shared scorer、發佈時間與 fixture 欄位驗證。
- `tests/fixtures/preference-gold-order.synthetic.json`、`tests/cloud-preference-calibration.test.mjs`：20 筆合成金標、Top 10 相對順序與 lane 斷言。
- `package.json`：將金標測試納入 `npm test`，沒有新增依賴或修改 lockfile。
- `docs/ops/DAILY_UPDATE_WITHOUT_GROK_BOT.md`、`docs/qa/RADAR_RESEARCH_LANES_QA.md`：更新邊界說明及追加 R1 記錄。
- 本 QA 檔：本地驗證與限制。

## Verification evidence

| Command | Exit | Result |
|---|---:|---|
| `node --experimental-strip-types --test tests/cloud-preference-calibration.test.mjs tests/daily-radar-collector.test.mjs tests/cloud-lanes.test.mjs` | 0 | 13/13。 |
| `npm test` | 0 | 289/289，較歷史基線 286 多 3；cloud-lanes 與 collector 測試通過。 |
| `node --experimental-strip-types scripts/daily-radar-local-fixture.mjs 2026-11-13 /private/tmp/radar-r1-QLQ23p` | 0 | 寫入合成 draft。 |
| `node --experimental-strip-types scripts/daily_radar_collector.mjs --fixture 2026-11-14 /private/tmp/radar-r1-QLQ23p` | 0 | 寫入合成 draft；保留既有 `data/daily/2026-11-02.json`。 |
| `npm run validate:daily -- /private/tmp/radar-r1-QLQ23p` | 0 | 2 files / 2 articles，passed。 |
| `npm run validate:data -- /private/tmp/radar-r1-QLQ23p` | 0 | 2 files / 2 articles，0 warnings / 0 errors。 |
| `node -e 'const s=require("node:net").createServer();s.once("error",e=>{console.error(`${e.code}: ${e.message}`);process.exitCode=1});s.listen(0,"127.0.0.1",()=>{console.log("loopback bind available");s.close()})'` | 1 | `EPERM: listen EPERM: operation not permitted 127.0.0.1`。 |
| `npm run cloud:smoke` | Unknown | 未執行；本沙盒無法 bind，本機 smoke 留待 Mac 重跑。既有 `cloud/scripts/local-smoke.mjs` 仍斷言 capture HTTP 201。 |
| `git diff --check -- scripts/daily_radar_collector.mjs tests/daily-radar-collector.test.mjs package.json docs/ops/DAILY_UPDATE_WITHOUT_GROK_BOT.md docs/qa/RADAR_RESEARCH_LANES_QA.md` | 0 | 編輯過的 tracked 檔無空白錯誤；未追蹤的新檔另經語法 / JSON 讀取與測試驗證。 |

## `git status --short`（驗證後）

```text
 M AGENTS.md
 M docs/qa/RADAR_RESEARCH_LANES_QA.md
 M package.json
 M scripts/daily_radar_collector.mjs
 M tests/daily-radar-collector.test.mjs
?? AGENTS.md.bak-20261031
?? AGENTS.md.bak-20261111
?? README.md.bak-20261031
?? data/daily/2026-11-02.json
?? docs/ops/
?? docs/qa/DAILY_LOCAL_RESILIENCE_2026-11-02.md
?? docs/qa/RADAR_R1_QA.md
?? goals/
?? last-message.md
?? ops/
?? scripts/daily-radar-local-fixture.mjs
?? scripts/ingest-x-batch-local.mjs
?? tests/cloud-preference-calibration.test.mjs
?? tests/fixtures/preference-gold-order.synthetic.json
?? tests/fixtures/threads-preference-summary-2026-11-10.md
?? tests/fixtures/threads-source-inputs-2026-11-10.json
```

`AGENTS.md`、`.bak-*`、Nov 2 daily 檔及其他原有 WIP 均為執行前已有狀態；`docs/ops/` 內的 runbook 原已未追蹤，本輪只修改其說明。Git 沒有 stage 或 commit。

## Known failures / limits

- Smoke：Failure = loopback bind denied；Command 與 exact error 如上；Files involved = `cloud/scripts/local-smoke.mjs`（需要本機 port 8799），但此檔未修改。Attempted = read-only smoke preflight；most likely blocker = sandbox network permission；smallest next decision = 在可 bind 的 Mac 執行 `npm run cloud:smoke`。
- 合成 fixture 不是來源事實，也不是 Owner UAT。`/private/tmp/radar-r1-QLQ23p` 為本輪產物；本 repo 的 Nov 2 fixture 保留。
- 沒有部署、remote D1、Git commit/push、X ingest、外部付費 API、launchd 操作或公司 repo 存取。
