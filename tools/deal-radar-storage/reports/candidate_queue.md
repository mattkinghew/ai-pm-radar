# Candidate Queue — 搜尋結果候選排序

> v3.1 search-capture。此報告只分析使用者手動貼入的本地搜尋結果文字；不自動開頁、不抓取、不購買、不聯絡賣家。

## Summary

- Total raw search files read: 3
- Total candidates parsed: 9
- HIGH: 3
- MEDIUM: 0
- LOW: 0
- SKIP: 6

## Top 5 candidates to open first

- HIGH｜PM9A1 2TB NVMe 健康95 通电1200小时｜¥820｜PM9A1｜2TB｜high｜low
- HIGH｜SN730 2TB NVMe 固態硬盤 健康98 有完整SMART｜¥850｜SN730｜2TB｜high｜low
- HIGH｜SN730 2TB M.2 NVMe 健康96｜¥780｜SN730｜2TB｜high｜low

## Candidates to skip and reasons

- Samsung 870 QVO 2TB SATA QLC 健康92｜原因: 命中避雷詞：SATA、QVO、870 QVO、只保正常使用；賣家條款風險高；SATA / mSATA / NGFF SATA 不是目標 NVMe；SATA / QVO / 白牌 2TB 價格接近 NVMe，不值得優先跟進
- 金储星 mSATA 2TB 固态硬盘 SATA协议｜原因: 命中避雷詞：SATA、mSATA、打包；賣家條款風險高；SATA / mSATA / NGFF SATA 不是目標 NVMe；SATA / QVO / 白牌 2TB 價格接近 NVMe，不值得優先跟進
- 白牌 2TB M.2 SSD 便宜｜原因: 命中避雷詞：不保品牌、图吧、白牌；賣家條款風險高
- PM9A1 2TB 价格区间 ¥399-899｜原因: 顯示價格可信度低，可能是選項價／釣魚價／容量不明；多規格或選項價風險高
- Samsung 990 Pro 2TB 低价 图吧工具箱｜原因: 命中避雷詞：不保品牌、只保正常使用、图吧、图吧工具箱；賣家條款風險高；顯示價格可信度低，可能是選項價／釣魚價／容量不明；Samsung 990 Pro 2TB 價格異常低，需視為可疑
- SN730 1TB NVMe 多规格 低至 ¥299 起｜原因: 顯示價格可信度低，可能是選項價／釣魚價／容量不明；多規格或選項價風險高

## Suggested next manual action

1. 只打開 HIGH / MEDIUM 中最像真實 2TB NVMe TLC 的 3–5 個候選。
2. 避免打開 SKIP，除非你想做 test_only 或補充驗證。
3. 對 price_reliability = low 或 option_price_risk = high 的候選，先確認 2TB 實際價格。

## Promote selected candidate to full listing capture

1. Open the product page manually.
2. Copy full visible listing text into `captures/raw/goofish_001.txt`.
3. Run: `python3 src/cli.py capture`
4. Review: `captures/parsed_listings.csv`
5. Then append: `python3 src/cli.py capture --append-to data/discovered_listings.csv`
6. Evaluate: `python3 src/cli.py evaluate --input data/discovered_listings.csv`