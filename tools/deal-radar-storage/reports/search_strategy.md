# Search Strategy — 下一輪實購搜尋策略

## Current target

目標是尋找一隻 **2TB NVMe TLC SSD**，用作 external Mac work drive，之後配合 RTL9210B / ASM2362 硬碟盒。優先次序是：資料安全／可靠性 > 合理價格 > 速度。

## Search round rule

- 每一輪只挑 3–5 個候選，不要一次收集太多。
- 不要再用 `2T 固态`、`2TB 固态`、`便宜 2T SSD` 這類廣泛詞。
- 優先搜尋已知 NVMe TLC 型號，例如 SN730、SN740、PM9A1、Micron 3400、KC3000、SN770、970 EVO Plus、980 PRO、P5 Plus。
- 看到 SATA / mSATA / NGFF SATA / QVO / 不保品牌 / 图吧 / 打包 / 白牌 / 杂牌，先跳過。

## Manual workflow

1. 從 `reports/discovery_urls.md` 打開搜尋 URL。
2. 每輪只挑 3–5 個看起來有潛力的 listing。
3. 把 title、price、url、description、notes、intended_use 填入 `data/discovered_listings.csv`。
4. 向賣家索取 SMART / CrystalDiskInfo 完整截圖，再補 health_percent、power_on_hours、host_writes_tb、critical_warning、media_integrity_errors、supports_return。
5. 執行 `python3 src/cli.py evaluate --input data/discovered_listings.csv`。
6. 先看 `reports/real_trial_summary.md`，再看 `reports/today.md` 與 `reports/rejects.md`。

## Seller evidence before payment

- CrystalDiskInfo 完整截圖，不只健康度一角。
- Critical Warning = 0。
- Media/Data Integrity Errors = 0。
- Health / Percentage Used、Power On Hours、Total Host Writes。
- 實物照片、標籤、容量、型號一致。
- 支援到手測試與退換條款。

## Safety reminder

本工具不會自動購買、不會自動聯絡賣家、不會登入平台、不會繞過平台安全。最後付款前仍需人工判斷賣家信譽、退換條款與資料風險。