# v2.4.1 樣本驗證報告

> 本報告使用 `data/sample_real_listings.csv` 的代表性二手 SSD / HDD / 硬碟盒樣本，檢查 rule engine 的實際 decision 是否符合預期。此流程不會 scraping、不會登入、不會自動購買。

- 總樣本數: 20
- 符合預期: 20
- 不符合預期: 0

## 每列比較

| Row | 結果 | 標題 | 預期 decision | 實際 decision | 分數 | 用途適配 | 預期註解 | 拒絕原因 |
|---:|---|---|---|---|---:|---|---|---|
| 1 | PASS | Samsung 980 PRO 2TB NVMe TLC SSD 健康98 | BUY_CANDIDATE | BUY_CANDIDATE | 98 | 可議價 | good NVMe TLC with full SMART and return support |  |
| 2 | PASS | Samsung PM9A1 2TB NVMe SSD 健康91 | NEGOTIATE_ONLY | NEGOTIATE_ONLY | 72 | 可議價 | health below 95 should not be buy candidate for work drive |  |
| 3 | PASS | Samsung PM9A1 2TB NVMe SSD 健康90 | WATCH_ONLY | WATCH_ONLY | 47 | 可議價 | health 90 with high price should be watch only |  |
| 4 | PASS | WD Black SN750 2TB NVMe SSD 高寫入 | WATCH_ONLY | WATCH_ONLY | 57 | 可議價 | high writes should be watch only for external work drive |  |
| 5 | PASS | Kingston KC3000 2TB NVMe SSD | NEED_MORE_INFO | NEED_MORE_INFO | 55 | 不建議 | missing SMART should ask seller |  |
| 6 | PASS | WD Blue SATA 2TB SSD 通電2萬小時 | REJECT | REJECT | 0 | 不建議 | SATA-class and high-risk wording not fit for work drive |  |
| 7 | PASS | WD Green SATA 2TB SSD | REJECT | REJECT | 0 | 不建議 | low-end SATA overpriced | 低端 SATA / QLC 2TB 標價 780 CNY > 750 CNY，拒絕; SATA / mSATA 不是 NVMe，2TB 價格超過 ¥600 且接近 NVMe 時不… |
| 8 | PASS | WD SN770 2TB 白牌 雜牌 不退不換 | REJECT | REJECT | 24 | 不建議 | suspicious white-label SN770 |  |
| 9 | PASS | HC620 14T 飛牛 Windows不能用 | REJECT | REJECT | 0 | 適合 | Feiniu / Windows cannot use should reject | HDD listing 命中飛牛／不能識別／ZBC／改盤／屏蔽等風險，不適合正常資料儲存 |
| 10 | PASS | HC550 14T 普通 SATA 企業盤 | BUY_CANDIDATE | BUY_CANDIDATE | 81 | 適合 | normal enterprise HDD can be candidate if SMART danger fields are zero and use is cold st… |  |
| 11 | PASS | RTL9210B NVMe 硬碟盒 10Gbps | BUY_CANDIDATE | BUY_CANDIDATE | 85 | 未指定 | known enclosure controller |  |
| 12 | PASS | Samsung 970 EVO Plus 2TB Critical Warning 1 | REJECT | REJECT | 0 | 不建議 | critical warning hard reject | SSD critical_warning = 1，必須拒絕 |
| 13 | PASS | Samsung 990 Pro 2TB 低价 不保品牌 图吧显示 | REJECT | REJECT | 0 | 可議價 | suspicious 990 Pro low price and seller wording | 賣家明示不保品牌／只保正常使用／图吧顯示／打包，假貨或錯標風險高; 疑似低價假 Samsung 990 Pro 或錯標 listing，未有強證據前拒絕 |
| 14 | PASS | Samsung MZVLB2T0HMLB-000H1 2TB NVMe OEM 健康40 | REJECT | REJECT | 0 | 可議價 | OEM NVMe direction valid but health below 90 rejects work drive | 健康度低於 90，不建議作主力資料碟; Samsung OEM NVMe 雖方向可接受，但健康度低於 90，不建議作 external Mac / main work drive |
| 15 | PASS | Samsung 870 QVO 2TB SATA QLC 健康92 | REJECT | REJECT | 0 | 不建議 | QVO / QLC SATA overpriced for main work drive | 低端 SATA / QLC 2TB 標價 770 CNY > 750 CNY，拒絕; SATA / mSATA 不是 NVMe，2TB 價格超過 ¥600 且接近 NVMe 時不… |
| 16 | PASS | NGFF SATA 2TB 打包 不保品牌 | REJECT | REJECT | 0 | 不建議 | NGFF SATA bundle and no brand guarantee | 賣家明示不保品牌／只保正常使用／图吧顯示／打包，假貨或錯標風險高; mSATA / NGFF SATA 不是 NVMe，不符合 external Mac / main work … |
| 17 | PASS | Kingchuxing 金储星 mSATA 2TB SSD | REJECT | REJECT | 0 | 不建議 | low-trust mSATA overpriced | mSATA / NGFF SATA 不是 NVMe，不符合 external Mac / main work drive 目標; SATA / mSATA 不是 NVMe，2TB… |
| 18 | PASS | SanDisk SSD H3 2TB SATA 健康96 | WATCH_ONLY | WATCH_ONLY | 40 | 不建議 | SATA-class price approaches NVMe alternatives |  |
| 19 | PASS | SN730 2TB NVMe TLC 健康98 | BUY_CANDIDATE | BUY_CANDIDATE | 98 | 可議價 | good SN730 candidate |  |
| 20 | PASS | KC3000 2TB NVMe TLC 健康99 | BUY_CANDIDATE | BUY_CANDIDATE | 98 | 可議價 | good KC3000 candidate |  |

## Mismatch explanation

所有樣本 decision 均符合預期。