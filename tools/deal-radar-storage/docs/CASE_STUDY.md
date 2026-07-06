# CASE STUDY — deal-radar-storage v2.5

## Background

二手 SSD / HDD 價格吸引，但資訊高度不對稱。Listing 可能只寫型號和容量，缺少 SMART 資料、退換條款、用途限制或風險說明。對一般用戶而言，要同時判斷型號、介面、健康度、寫入量、風險詞、用途適配與合理價格，成本很高。

此專案以 AI PM / AI Engineer portfolio 角度設計：不追求複雜自動化，而是建立一個低成本、可驗證、可教學的 decision support workflow。

## Problem

使用者在購買二手儲存設備時，常見問題包括：

- 不知道哪些資訊必須向賣家索取。
- 容易被低價、熱門型號或大容量吸引，忽略 SMART hard reject。
- 不同用途有不同風險：主力工作盤比 test-only 用途要求高得多。
- 手動比較 listing 很慢，且難以保留決策理由。
- 自動化購買或登入平台會帶來安全、合規與平台風險。

## Product goal

建立一個 beginner-friendly 的本地 Python 工具，讓使用者可以：

1. 輸入 product links、requirements YAML 或手動 listing CSV。
2. 用 rule engine 產生 score、decision、suggested price range、use-case fit。
3. 生成賣家問題與 evidence checklist。
4. 以 Markdown 和 CSV 方式輸出可閱讀、可分享、可驗證的報告。

## User workflow

```text
看到 listing
→ 貼 link 到 data/links.txt，或把 title / price / SMART 資料填到 data/listings.csv
→ 執行 python3 src/evaluate.py 或 python3 src/evaluate_links.py
→ 閱讀 reports/today.md
→ 對 NEED_MORE_INFO / NEGOTIATE_ONLY listing 複製 seller_questions 問賣家
→ 收到證據後更新 CSV
→ 再次執行評估
→ 人工確認是否購買
```

## Rule-based approach

此專案使用 deterministic rules，而不是完全交給 AI 模型判斷。原因是二手硬碟交易需要可追溯理由：

- 為什麼 reject？需要具體欄位，例如 `critical_warning != 0`。
- 為什麼議價？需要健康度、寫入量和價格區間支持。
- 為什麼需要補資料？需要列出缺失欄位和對應問題。

Rule-based approach 令決策透明、可測試、可逐步調整，也適合 portfolio 展示 product thinking 和 engineering discipline。

## Human-in-the-loop design

工具不會自動購買、登入或聯絡賣家。它只輸出：

- `decision`：初步購買決策。
- `next_action`：下一步建議。
- `seller_questions`：需要向賣家查詢的問題。
- `evidence_required`：需要收集的截圖或確認。

最終購買仍由使用者人工確認。這是有意設計的 safety boundary。

## Key features from v2 to v2.4.1

- v2：加入 link-only、requirements-only、combined mode；建立基本 rule engine 與報告。
- v2.1：加入 optional SMART 欄位和 SSD / HDD hard reject rules。
- v2.2：加入 purchase decision 與 suggested price range。
- v2.3：加入 intended_use 和 use-case fit evaluation。
- v2.4：加入 seller questions、evidence checklist、next_action 和 rescue_comment。
- v2.4.1：加入 12 個 real-world-like samples 與 validation workflow。
- v2.5：加入 portfolio-ready documentation package。

## Example decisions

- 高健康度 NVMe TLC SSD，SMART 關鍵欄位正常：`BUY_CANDIDATE`，但仍需賣家提供完整截圖。
- PM9A1 2TB health 90–94：可能是 `NEGOTIATE_ONLY` 或 `WATCH_ONLY`，視價格和用途而定。
- Critical Warning 非 0：`REJECT`。
- HDD reallocated / pending / offline uncorrectable 非 0：`REJECT`。
- 缺少 SMART 的主力工作盤：`NEED_MORE_INFO` 或強烈不建議。
- RTL9210B enclosure：可作候選，但需確認 TRIM、UASP、SMART passthrough。

## What this project demonstrates for AI PM / AI Engineer roles

AI PM 角度：

- 能定義 target users、pain points、MVP scope、non-goals、success metrics。
- 能把風險高的自動化需求切成 safe human-in-the-loop workflow。
- 能用 release iteration 從 v2 擴展到 v2.5，保持產品邊界清晰。

AI Engineer 角度：

- 能建立可測試的 Python rule engine。
- 能處理 CSV / YAML / Markdown report pipeline。
- 能建立 sample validation workflow，降低規則修改風險。
- 能用簡單技術實現實用 prototype，而不是過度工程化。
