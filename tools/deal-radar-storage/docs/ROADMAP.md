# ROADMAP — deal-radar-storage

## v2.5 documentation baseline

Status: completed documentation package.

目標：令專案可作 AI PM / AI Engineer portfolio 展示。

包含：Product brief、Case study、Rule design explanation、Validation report、Safety boundaries、Roadmap、Context summary、README docs links。

## v2.6 optional CLI improvements

Status: completed CLI usability baseline.

已加入 `src/cli.py`，使用 Python 標準庫 `argparse`，提供 optional single entry point：

- `python3 src/cli.py evaluate`
- `python3 src/cli.py links`
- `python3 src/cli.py search`
- `python3 src/cli.py validate`

同時保留原本 beginner-friendly 直接腳本。

## v2.7 quick analyze mode

Status: completed quick workflow baseline.

目標：讓使用者在趕時間時，只靠 links、requirements YAML，或兩者一起，也能快速產出可行下一步。

已加入 `src/quick_analyze.py` 與 `python3 src/cli.py quick`，輸出 quick report、quick CSV、seller question templates、buying criteria、quick checklist。

## v2.8 discovery preparation mode

Status: completed discovery preparation baseline.

目標：讓使用者只有 requirements YAML 時，也可以先產生人工搜尋 query、平台搜尋 URL，以及可手動填寫的 discovered listings template。

已加入 `src/discover.py`、`src/search_queries.py`、`src/platform_urls.py`、`python3 src/cli.py discover --requirements config/requirements.ssd.yml`、`reports/discovery_queries.md`、`reports/discovery_urls.md`、`data/discovered_listings.csv`。

## v2.9 Real Market Screening Rules

Status: completed real market screening baseline.

目標：根據真實二手 SSD 搜尋經驗，加強 external Mac work drive / main work drive 的不適配判斷。

已加入：

- SATA / mSATA / NGFF SATA 風險提示。
- QVO / QLC 不適合作高信任工作碟的判斷。
- 低信任品牌、白牌、過低價可疑 Samsung 990 Pro 的篩選。
- health < 90 不適合作主力資料碟。
- `reports/avoid_patterns.md`。
- `reports/search_strategy.md`。
- 20 samples validation baseline。

## v3 Browser-assisted Manual Capture

Status: completed local manual capture baseline.

目標：減少 real purchase trial 的人工 CSV 輸入負擔。使用者仍然手動打開 listing page，手動複製可見文字到 `captures/raw/*.txt`；工具只解析本地文字並輸出候選 CSV。

已加入：

- `src/capture_parse.py`：解析本地 raw capture text。
- `src/validate_capture_samples.py`：驗證 sample capture parsing。
- `python3 src/cli.py capture`。
- `python3 src/cli.py capture --append-to data/discovered_listings.csv`。
- `captures/raw/`。
- `captures/processed/`。
- `captures/parsed_listings.csv`。
- `captures/processed/capture_report.md`。
- `docs/BROWSER_ASSISTED_CAPTURE.md`。

限制：不自動開頁、不抓取平台內容、不處理帳戶、不自動購買、不自動聯絡賣家、不保存 cookies、credentials、API keys 或 session data。

此方向保持「人工控制瀏覽器」而非交易自動化。

## v3.x possible manual SMART image workflow

可能方向：

- 允許使用者手動放入 SMART 截圖到 `screenshots/`。
- 用人工 template 或輕量 OCR 協助抽取 SMART 欄位。
- 將抽取結果寫成待確認草稿，而不是自動判定真實性。

注意：OCR 可能錯讀，必須保留人工校對步驟。

## v3.x possible dashboard

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
- 高頻抓取。
- credentials 或 API keys。

專案核心價值是 safer decision support，不是交易自動化。
