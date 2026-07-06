# ROADMAP — deal-radar-storage

## v2.5 documentation baseline

Status: completed documentation package.

目標：令專案可作 AI PM / AI Engineer portfolio 展示。

包含：

- Product brief
- Case study
- Rule design explanation
- Validation report
- Safety boundaries
- Roadmap
- Context summary
- README docs links

此版本不修改核心 scoring code，重點是把已完成的 v2–v2.4.1 功能整理成可展示材料。

## v2.6 optional CLI improvements

Status: completed CLI usability baseline.

已加入 `src/cli.py`，使用 Python 標準庫 `argparse`，提供一個 optional single entry point：

- `python3 src/cli.py evaluate`
- `python3 src/cli.py links`
- `python3 src/cli.py search`
- `python3 src/cli.py validate`

每個 command 支援 `--output-dir`，並保留原本 beginner-friendly 直接腳本：

- `python3 src/evaluate.py`
- `python3 src/evaluate_links.py`
- `python3 src/search_requirements.py`
- `python3 src/validate_samples.py`

後續可考慮：

- 加入 `--strict` 模式，對主力用途更保守。
- 加入 `--format markdown/csv/both`。
- 加入更清楚的錯誤訊息，例如 CSV 缺欄位或數值格式錯誤。

限制：保持 beginner-friendly，不引入大型 CLI framework。

## v2.7 quick analyze mode

Status: completed quick workflow baseline.

目標：讓使用者在趕時間時，只靠 links、requirements YAML，或兩者一起，也能快速產出可行下一步。

已加入：

- `src/quick_analyze.py`。
- `python3 src/cli.py quick`。
- `python3 src/cli.py quick --links data/links.txt`。
- `python3 src/cli.py quick --requirements config/requirements.ssd.yml`。
- `python3 src/cli.py quick --requirements config/requirements.ssd.yml --links data/links.txt`。

輸出：

- `reports/quick_report.md`：summary、candidate list、need more info list、reject list、next action、seller questions、evidence required。
- `reports/quick_report.csv`：適合 spreadsheet 檢視的 quick analysis table。
- `reports/quick_questions.md`：SSD / HDD / enclosure 可複製賣家訊息。
- `reports/buying_criteria.md`：search keywords、preferred model list、reject keywords、suggested price bands。
- `reports/quick_checklist.md`：購買前、證據、收貨後、red flags 檢查清單。

限制：quick mode 仍然不做自動購買、不登入、不抓取大量網頁、不繞過平台安全。


## v2.8 discovery preparation mode

Status: completed discovery preparation baseline.

目標：讓使用者只有 requirements YAML 時，也可以先產生人工搜尋 query、平台搜尋 URL，以及可手動填寫的 discovered listings template。

已加入：

- `src/discover.py`：統一執行 discovery preparation workflow。
- `src/search_queries.py`：由 requirements YAML 生成 human-readable discovery queries。
- `src/platform_urls.py`：把 query 轉成 Goofish / Taobao / JD 手動搜尋 URL。
- `python3 src/cli.py discover --requirements config/requirements.ssd.yml`。
- `reports/discovery_queries.md`。
- `reports/discovery_urls.md`。
- `data/discovered_listings.csv`。

限制：

- 不 fetch 或 scrape 平台內容。
- 不登入、不保存 cookies、不使用 credentials 或 API keys。
- 不自動購買、不自動聯絡賣家。
- 只協助人工 discovery preparation。


## v3 possible browser-assisted workflow

可能方向：

- 只生成手動打開的 search URLs。
- 或使用 browser-assisted checklist，提示使用者手動貼入 title、price、SMART 資料。
- 不自動登入、不批量抓取、不繞過平台安全。

此方向應保持「人工控制瀏覽器」而非 bot purchasing。

## v3 possible OCR/manual SMART extraction

可能方向：

- 允許使用者手動放入 SMART 截圖到 `screenshots/`。
- 用 OCR 或人工輸入 template 協助抽取 SMART 欄位。
- 將抽取結果寫成待確認草稿，而不是自動判定真實性。

注意：OCR 可能錯讀，必須保留人工校對步驟。

## v3 possible dashboard

可能方向：

- 用簡單 static HTML 或 lightweight local dashboard 顯示候選清單。
- 支援 decision filter、use-case filter、reject reason filter。
- 可視化 price range 和 score bucket。

限制：不需要 backend、不需要帳號、不需要雲端資料庫。

## Keep auto-buying out of scope

任何版本都不應加入：

- 自動購買。
- 自動付款。
- 自動聯絡賣家。
- 登入繞過。
- 平台安全繞過。
- 高頻 scraping。
- credentials 或 API keys。

專案核心價值是 safer decision support，不是交易自動化。
