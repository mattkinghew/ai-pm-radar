# Browser-assisted Manual Capture Guide — v3 / v3.1

本文件說明 `deal-radar-storage` v3 的 browser-assisted manual capture workflow。這個流程的目的，是減少你把 Goofish / Taobao / JD listing 人工複製到 CSV 的時間。v3.1 另外加入 search result batch capture，讓你先從搜尋結果頁挑出最值得打開的 3–5 個候選。

## 安全邊界

這不是 web scraping，也不是瀏覽器自動化。

工具不會自動開啟大量頁面、不會抓取搜尋結果、不會登入平台、不會處理驗證碼、不會儲存 cookies、passwords、tokens、credentials、API keys 或 session data，也不會自動購買或自動聯絡賣家。

你仍然需要人工打開 listing page，人工複製可見文字到本地檔案。工具只解析你提供的本地文字。

## v3.1 search result triage first

在打開 product page 之前，你可以先複製搜尋結果頁的可見文字到：

```text
captures/raw_search/search_sn730_2tb.txt
```

然後執行：

```bash
python3 src/cli.py search-capture
open reports/candidate_queue.md
```

先看 `HIGH` / `MEDIUM` 候選，再打開完整 product page。詳見 [Search result batch capture guide](SEARCH_RESULT_BATCH_CAPTURE.md)。

## Workflow

1. 你在瀏覽器手動打開 Goofish / Taobao / JD listing page。
2. 手動複製頁面可見文字，例如標題、價格、描述、SMART 資料、賣家備註。
3. 在 `captures/raw/` 建立一個 `.txt` 檔案，例如 `captures/raw/goofish_001.txt`。
4. 執行 capture parser：

```bash
python3 src/cli.py capture
```

5. 檢查輸出：

```bash
open captures/parsed_listings.csv
open captures/processed/capture_report.md
```

6. 確認資料合理後，可 append 到 real trial CSV：

```bash
python3 src/cli.py capture --append-to data/discovered_listings.csv
```

7. 再執行現有 evaluator：

```bash
python3 src/cli.py evaluate --input data/discovered_listings.csv
open reports/real_trial_summary.md
open reports/today.md
open reports/rejects.md
```

## Example raw capture file

可以在 `captures/raw/goofish_001.txt` 貼入類似內容：

```text
URL: https://www.goofish.com/item?id=xxxx
平台: goofish
標題: SN730 2TB NVMe 固態硬盤 健康98
價格: ¥850
描述:
SN730 2TB，健康98%，通電1000小時，寫入20TB，可到手測試
賣家備註:
支持到手測試，包郵
```

工具也會盡量容忍較混亂的貼上文字，例如：

```text
SN730 2TB
¥850 包邮
健康98%
通电1000小时
写入20TB
Critical Warning 0
Media/Data Integrity Errors 0
可到手测试
```

## Parsed fields

`src/capture_parse.py` 會嘗試抽取：

- `platform`
- `title`
- `price`
- `url`
- `description`
- `notes`
- `intended_use`
- `health_percent`
- `power_on_hours`
- `host_writes_tb`
- `critical_warning`
- `media_integrity_errors`
- `supports_return`

`intended_use` 預設是 `external_mac_drive`，除非文字中明確出現 `cold_storage`、`backup_drive`、`test_only`、`docker_cache` 或 `main_work_drive`。

## How to inspect parsed_listings.csv

執行：

```bash
open captures/parsed_listings.csv
```

檢查 title、price、url、health_percent、host_writes_tb、supports_return 是否合理。也要檢查 notes 是否保留風險詞，例如 `不退不換`、`不保品牌`、`图吧`、`打包`。

如解析錯誤，先修改 raw `.txt`，再重新執行：

```bash
python3 src/cli.py capture
```

## Append into discovered listings

確認 `captures/parsed_listings.csv` 合理後，才 append：

```bash
python3 src/cli.py capture --append-to data/discovered_listings.csv
```

append 行為：

- 會保留原本 `data/discovered_listings.csv`。
- 有相同 URL 的 row 會盡量跳過，避免重複。
- 如果沒有 URL，仍可 append，但 `capture_report.md` 會提示缺欄位。
- 不會刪除你的既有資料。

## Evaluate after capture

append 後執行：

```bash
python3 src/cli.py evaluate --input data/discovered_listings.csv
```

主要看 `reports/real_trial_summary.md`、`reports/today.md`、`reports/rejects.md`、`reports/quick_questions.md`。

## Suggested operating habit

每輪只處理 3–5 個候選 listing：

1. 手動複製到 `captures/raw/goofish_001.txt` 等檔案。
2. 執行 `python3 src/cli.py capture`。
3. 檢查 `captures/parsed_listings.csv`。
4. 沒問題才 append。
5. 執行 evaluate。

這樣比一次處理大量 listing 更容易檢查，也比較不會把錯誤資料加入 real trial CSV。
