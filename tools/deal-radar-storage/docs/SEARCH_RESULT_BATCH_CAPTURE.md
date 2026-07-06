# Search Result Batch Capture — v3.1

本文件說明 `deal-radar-storage` v3.1 的 search result batch capture workflow。它用來處理你手動從 Goofish / Taobao / JD 搜尋結果頁複製出來的可見文字，先做候選排序和避雷，讓你只打開最值得跟進的 3–5 個 product pages。

## 為什麼不用 full auto-search

二手平台搜尋結果常見問題：

- 搜尋結果顯示價不是 2TB 實際價格。
- 一個 listing 內有多規格 / 多容量 / 多選項。
- 標題含高階型號，但描述或價格可疑。
- 賣家條款不清楚，例如不退不換、不保品牌、只保正常使用。
- broad search 會混入 SATA、mSATA、QVO、白牌、雜牌或錯標商品。

因此 v3.1 不做自動搜尋，也不自動打開頁面。使用者人工打開搜尋結果頁，人工複製可見文字到本地檔案；工具只解析本地文字並排序候選。

## Safety boundaries

本 workflow 不會：

- scraping
- auto-buying
- auto-messaging
- 自動開啟大量頁面
- 自動爬取搜尋結果
- 處理登入或驗證碼
- 保存 cookies、passwords、tokens、credentials、API keys 或 session data

## 如何手動複製搜尋結果文字

1. 在平台手動搜尋，例如 `SN730 2TB`、`PM9A1 2TB 健康`、`KC3000 2TB`。
2. 在搜尋結果頁選取可見文字，包括標題、價格、簡短描述、賣家條款、URL 如有。
3. 貼到本地檔案，例如：

```text
captures/raw_search/search_sn730_2tb.txt
captures/raw_search/search_pm9a1_2tb.txt
```

建議每個檔案只放一個搜尋詞的一頁或一小段結果。若可以，候選之間用空白行分隔，解析會更準。

## 執行 search-capture

```bash
python3 src/cli.py search-capture
```

可指定輸入與輸出：

```bash
python3 src/cli.py search-capture --input-dir captures/raw_search --output captures/search_candidates.csv
```

輸出：

```text
captures/search_candidates.csv
reports/candidate_queue.md
reports/price_reliability.md
reports/seller_risk.md
```

## 如何閱讀 candidate_queue.md

`reports/candidate_queue.md` 會把候選分成：

- `HIGH`: 優先打開。通常是已知 NVMe 型號、2TB、價格清楚、賣家風險不高。
- `MEDIUM`: 可以考慮，但可能缺 SMART、賣家條款不明或價格可信度中等。
- `LOW`: 資料弱，不急於打開。
- `SKIP`: 命中避雷詞、賣家風險高、價格可疑、錯介面或不符合 external Mac work drive 目標。

建議只打開 Top 3–5 個 HIGH / MEDIUM 候選。

## 如何避免 bait price 和差賣家條款

看 `reports/price_reliability.md`：

- `option_price_risk = high`：多規格、多選項、起售價、詳情為準等情況。
- `price_reliability = low`：可能是 bait price、容量不清、2TB 實際價格不明或高階型號價格異常低。

看 `reports/seller_risk.md`：

- 高風險訊號：不退不換、售出不退、只保點亮、只保正常使用、不保品牌、無售後、打包出、懂的來。
- 正面訊號：支持到手測試、可退、支持退貨、有完整 SMART、CrystalDiskInfo、CDI 截圖、可提供測試、包郵。

## 如何把候選提升到完整 listing capture

選定一個 HIGH / MEDIUM 候選後：

1. 手動打開 product page。
2. 複製完整可見 listing text。
3. 貼到：

```text
captures/raw/goofish_001.txt
```

4. 執行：

```bash
python3 src/cli.py capture
```

5. 檢查：

```bash
open captures/parsed_listings.csv
open captures/processed/capture_report.md
```

6. 確認後 append：

```bash
python3 src/cli.py capture --append-to data/discovered_listings.csv
```

7. 評估：

```bash
python3 src/cli.py evaluate --input data/discovered_listings.csv
```

## 建議操作節奏

每輪：

1. 搜尋 1–2 個精準 keyword。
2. 複製搜尋結果到 `captures/raw_search/*.txt`。
3. 跑 `search-capture`。
4. 只打開 3–5 個 HIGH / MEDIUM。
5. 用 v3 full listing capture 把完整頁面文字轉成 CSV。
6. 用 evaluator 產生最終 decision。
