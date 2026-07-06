# v2.4.1 樣本驗證報告

> 本報告使用 `data/sample_real_listings.csv` 的代表性二手 SSD / HDD / 硬碟盒樣本，檢查 rule engine 的實際 decision 是否符合預期。此流程不會 scraping、不會登入、不會自動購買。

- 總樣本數: 12
- 符合預期: 12
- 不符合預期: 0

## 每列比較

| Row | 結果 | 標題 | 預期 decision | 實際 decision | 分數 | 用途適配 | 預期註解 | 拒絕原因 |
|---:|---|---|---|---|---:|---|---|---|
| 1 | PASS | Samsung 980 PRO 2TB NVMe TLC SSD 健康98 | BUY_CANDIDATE | BUY_CANDIDATE | 100 | 適合 | 高健康度 NVMe TLC，SMART 關鍵欄位正常。 |  |
| 2 | PASS | Samsung PM9A1 2TB NVMe SSD 健康91 | BUY_CANDIDATE | BUY_CANDIDATE | 90 | 可議價 | 健康度 91%，只適合議價或較低風險用途。 |  |
| 3 | PASS | Samsung PM9A1 2TB NVMe SSD 健康90 | WATCH_ONLY | WATCH_ONLY | 45 | 不建議 | 健康度 90% 且價格偏高；不能按主力盤價格買。 |  |
| 4 | PASS | WD SN750 2TB NVMe TLC SSD | NEGOTIATE_ONLY | NEGOTIATE_ONLY | 75 | 可議價 | 寫入量 >200TB，只能低價議價。 |  |
| 5 | PASS | Kingston KC3000 2TB NVMe SSD | NEED_MORE_INFO | NEED_MORE_INFO | 60 | 不建議 | 缺少 SMART；主力工作碟不可直接判定可買。 |  |
| 6 | PASS | WD Blue SATA SSD 2TB 健康96 | WATCH_ONLY | WATCH_ONLY | 44 | 不建議 | SATA SSD 通電高，只適合低價冷資料或非唯一副本。 |  |
| 7 | PASS | WD Green SATA QLC SSD 2TB | REJECT | REJECT | 0 | 不建議 | 低端 SATA / QLC 2TB 價格 >750 CNY，拒絕。 | 低端 SATA / QLC 2TB 標價 820 CNY > 750 CNY，拒絕 |
| 8 | PASS | SN770 2TB 白牌 雜牌 改容量 超低價 | REJECT | REJECT | 24 | 不建議 | 疑似假貨／改容量，即使 test_only 也不應買。 |  |
| 9 | PASS | HGST HC620 14TB HDD 飛牛 Windows不能用 ZBC | REJECT | REJECT | 35 | 適合 | 飛牛／Windows 不能用／ZBC 等風險過多。 |  |
| 10 | PASS | Seagate Exos X18 16TB HDD SATA 企業盤 | BUY_CANDIDATE | BUY_CANDIDATE | 81 | 適合 | HDD SMART 危險欄位為 0，可議價作 cold storage。 |  |
| 11 | PASS | M.2 NVMe USB-C 硬碟盒 RTL9210B enclosure | BUY_CANDIDATE | BUY_CANDIDATE | 90 | 適合 | 已知硬碟盒晶片，仍需確認 TRIM/UASP/SMART passthrough。 |  |
| 12 | PASS | Samsung PM9A1 2TB NVMe SSD 健康98 但有 Critical Warning | REJECT | REJECT | 0 | 只限測試 | Critical Warning 非 0 是 hard reject。 | SSD critical_warning = 1，必須拒絕 |

## Mismatch explanation

所有樣本 decision 均符合預期。