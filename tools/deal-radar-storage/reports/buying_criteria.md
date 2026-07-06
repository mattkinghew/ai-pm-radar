# Buying Criteria — 快速購買準則

> 本檔由 requirements YAML 生成，目的是幫你更快搜尋與提問；不是自動購買或市場價格保證。

## Preferred model list

- SN740
- PM9A1
- PM9A1a
- Micron 3400
- KC3000
- SN770
- P5 Plus
- 970 EVO Plus
- 980 PRO
- P31
- P41

## Search keywords

### requirements.ssd.yml
- SN740 1TB SSD M.2
- SN740 2TB SSD M.2
- PM9A1 1TB SSD M.2
- PM9A1 2TB SSD M.2
- PM9A1a 1TB SSD M.2
- PM9A1a 2TB SSD M.2
- Micron 3400 1TB SSD M.2
- Micron 3400 2TB SSD M.2
- KC3000 1TB SSD M.2
- KC3000 2TB SSD M.2
- SN770 1TB SSD M.2
- SN770 2TB SSD M.2
- P5 Plus 1TB SSD M.2
- P5 Plus 2TB SSD M.2
- 970 EVO Plus 1TB SSD M.2
- 970 EVO Plus 2TB SSD M.2
- 980 PRO 1TB SSD M.2
- 980 PRO 2TB SSD M.2
- P31 1TB SSD M.2
- P31 2TB SSD M.2
- P41 1TB SSD M.2
- P41 2TB SSD M.2

## Buying criteria

- 容量: 1TB, 2TB
- 介面: NVMe
- 優先選擇已知型號與可提供完整 SMART / 測試截圖的賣家。
- 對 SSD，Critical Warning 與 Media/Data Integrity Errors 必須為 0。
- 對 HDD，Reallocated / Pending / Offline Uncorrectable 必須為 0。
- 沒有退換／測試條款的項目要降權或拒絕。

## Reject keywords

- 飛牛、Windows不能用、USB不能用、HBA、PC3000、屏蔽、改容量、ZBC、SED鎖、Linux專用、不支持USB、QLC、白牌、雜牌、不退不換、健康90、通電2萬小時。

## Suggested price bands

- PM9A1 2TB：health >=95 可參考 800–950 CNY；health 90–94 只建議 550–700 CNY；health <90 原則上拒絕或只作 <=500 CNY 測試用途。
- SN750 2TB：health >=95 且 host_writes_tb <100 可參考 700–850 CNY；health 85–94 或寫入 >200TB 只建議 500–650 CNY。
- SN730 / SN740 / Micron 3400 / KC3000 2TB：health >=95 可參考 750–900 CNY；health 90–94 可參考 550–750 CNY。
- 低端 SATA / QLC 2TB：只建議 300–650 CNY；高於 750 CNY 應拒絕。
- 未知品牌／白牌 SSD：除非 <=350 CNY 並明確 test_only，否則不建議。

## Seller question template

請提供完整 SMART / 測試截圖、實物照片、型號容量證明、退換條款，以及 Windows / macOS / USB 相容性證明。未補齊前不建議付款。