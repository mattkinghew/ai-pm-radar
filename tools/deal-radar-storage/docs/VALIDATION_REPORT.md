# VALIDATION REPORT — deal-radar-storage v2.9

## Sample validation workflow

專案使用 sample validation workflow 檢查 rule engine 是否穩定：

```bash
python3 src/validate_samples.py
```

此腳本會讀取：

```text
data/sample_real_listings.csv
```

然後對每一列 listing 執行同一個 `evaluate_item()` rule engine，比對：

- `expected_decision`
- actual `decision`

最後輸出：

```text
reports/sample_validation.md
```

## Current validation result

v2.9 Real Market Screening Rules 的目前驗證結果：

- Total samples: 20
- Matched count: 20
- Mismatch count: 0

代表 20 個代表性樣本的 actual decision 全部符合 `expected_decision`。

## Sample coverage

樣本包括：

1. good NVMe TLC SSD
2. PM9A1 with health 91%
3. PM9A1 overpriced with health 90%
4. SN750 with high writes
5. KC3000 missing SMART
6. WD Blue SATA with high power-on hours
7. WD Green SATA overpriced
8. suspicious SN770 / white-label style listing
9. HC620 Feiniu / Windows cannot use
10. normal SATA enterprise HDD
11. RTL9210B enclosure
12. SSD with Critical Warning hard reject
13. suspicious low-price Samsung 990 Pro 2TB
14. Samsung MZVLB2T0HMLB-000H1 with health 40
15. Samsung 870 QVO 2TB health 92 price 770
16. NGFF SATA 2TB bundle
17. Kingchuxing / 金储星 mSATA 2TB price 720
18. SanDisk SSD H3 2TB SATA health 96 price 750
19. good SN730 2TB health 98 price 850
20. good KC3000 2TB health 99 price 820

## What validation proves

此 validation workflow 證明：

- 現有 sample cases 在目前規則下可穩定產生預期 decision。
- v2.9 新增的 real-market screening cases 已被 regression check 覆蓋。
- future rule changes 可以透過 sample regression check 快速發現 unintended behavior change。
- `evaluate_item()` 可被 CLI report 和 validation script 重用，代表 rule engine 有基本 modularity。
- `REJECT`、`NEED_MORE_INFO`、`WATCH_ONLY`、`NEGOTIATE_ONLY`、`BUY_CANDIDATE` 都有樣本覆蓋。

## What validation does not prove

此 workflow 不代表：

- 價格區間是即時市場價格。
- SMART 截圖必然真實。
- 二手硬碟未來不會故障。
- 所有型號、容量、平台、賣家話術都被覆蓋。
- 工具可以取代人工檢查、退換條款確認或備份策略。

## How future rule changes should update expected_decision

修改 `src/rules.py` 後，應執行：

```bash
python3 src/validate_samples.py
python3 -m compileall src
```

如果出現 mismatch：

1. 先檢查是否為 unintended regression。
2. 如果是 bug，修正 rule engine。
3. 如果是刻意調整規則，更新 `data/sample_real_listings.csv` 的 `expected_decision` 和 `expected_comment`。
4. 重新執行 validation，直到 mismatch count 回到 0，或在 release note 清楚記錄為 intentional behavior change。
