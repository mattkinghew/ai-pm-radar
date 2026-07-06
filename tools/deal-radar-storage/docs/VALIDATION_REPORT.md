# VALIDATION REPORT — deal-radar-storage v2.5

## Sample validation workflow

v2.4.1 起，專案加入 sample validation workflow：

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

目前 v2.5 documentation baseline 沿用 v2.4.1 rule engine 的驗證結果：

- Total samples: 12
- Matched count: 12
- Mismatch count: 0

代表 12 個代表性樣本的 actual decision 全部符合 `expected_decision`。

## Sample coverage

樣本包括：

1. good NVMe TLC SSD
2. PM9A1 with health 91%
3. PM9A1 overpriced with health 90%
4. SN750 with high writes
5. KC3000 missing SMART
6. WD Blue SATA with high power-on hours
7. WD Green SATA overpriced
8. fake / suspicious SN770
9. HC620 Feiniu / Windows cannot use
10. normal SATA enterprise HDD
11. RTL9210B enclosure
12. SSD with Critical Warning hard reject

## What validation proves

此 validation workflow 證明：

- 現有 sample cases 在目前規則下可穩定產生預期 decision。
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
