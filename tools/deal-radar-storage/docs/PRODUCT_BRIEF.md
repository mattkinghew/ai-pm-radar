# PRODUCT BRIEF — deal-radar-storage v2.5

## Product summary

deal-radar-storage 是一個本地運行、beginner-friendly、rule-based 的二手 SSD / HDD / 硬碟盒篩選工具。它協助使用者把閒魚、淘寶、京東或其他平台看到的儲存產品 listing，整理成可比較的候選清單，並輸出購買決策、建議議價區間、用途適配、賣家提問與證據清單。

專案定位不是自動購買工具，而是「二手硬碟購買前的 decision support system」。使用者仍需自行打開平台、向賣家查詢、核對截圖與完成付款。

## Target users

- 需要低成本購買二手 SSD / HDD 的個人用戶。
- 使用 Mac / Docker / 外置硬碟盒的人，需要判斷某個硬碟是否適合作主力盤、cache、cold storage 或測試盤。
- 會看簡單 CSV，但不想手動記住所有 SMART 風險欄位的新手。
- 想建立 rule-based AI PM / AI Engineer portfolio case 的學習者。

## User pain points

- 二手硬碟 listing 資訊分散：標題、價格、SMART 截圖、退換條款常常不完整。
- 不同用途風險差異很大：主力工作盤、Docker cache、冷資料、測試盤不能用同一套標準。
- 常見風險詞如「飛牛」、「Windows不能用」、「ZBC」、「PC3000」、「改容量」容易被忽略。
- 價格判斷依賴經驗，新手很難知道何時可問、何時議價、何時直接拒絕。
- 平台登入、反爬、賣家溝通等行為不應由工具自動代替。

## Value proposition

- 把不完整 listing 轉成結構化候選清單。
- 用透明規則產生 score、decision、suggested price range 與 reject reason。
- 根據 intended_use 判斷用途適配，避免把高風險盤放到高風險用途。
- 自動生成賣家問題與 evidence checklist，幫助 human-in-the-loop 決策。
- 用 sample validation workflow 檢查規則改動是否造成 unintended regression。

## MVP scope

v2.5 MVP 包含：

- Link-only mode：讀取 `data/links.txt`，即使沒有 metadata 亦能建立基本候選項。
- Requirements-only mode：根據 YAML 需求產生手動搜尋 URL。
- CSV evaluation mode：讀取 `data/listings.csv` 的 title、price、description、SMART 與 intended_use。
- Rule engine：偵測 category、interface、model、risk keywords、SMART hard reject、decision、suggested price、use-case fit。
- Reports：輸出 `today.md`、`today.csv`、`rejects.md`、`search_urls.md`。
- Seller follow-up：輸出 `next_action`、`seller_questions`、`evidence_required`。
- Sample validation：用 `data/sample_real_listings.csv` 檢查 expected decision。

## Non-goals

- 不做 auto-buying。
- 不繞過登入或平台安全機制。
- 不 aggressive scraping。
- 不保存 credentials、cookies、API keys 或 private tokens。
- 不聲稱能保證硬碟健康或預測壽命。
- 不取代人工驗證、賣家溝通、退換條款確認或平台交易風險判斷。

## Success metrics

- 使用者能在 5 分鐘內把 5–10 個 listing 整理成可比較報告。
- `NEED_MORE_INFO` listing 能產生具體賣家問題，而不是只顯示「資料不足」。
- `REJECT` listing 能清楚顯示 hard reject reason。
- 每次改 rule 後，`python3 src/validate_samples.py` 可顯示 sample decision 是否符合預期。
- 新手可只用 CSV、YAML、Python 標準指令完成 workflow。

## Risks

- Rule-based 規則可能過時，價格區間不是即時市場價。
- 賣家可能提供不完整或不可信截圖。
- SMART 截圖只能作 advisory evidence，不是健康保證。
- 缺少實物測試、退換保障或多重備份時，仍有資料損失風險。
- 過度依賴 score 可能忽略交易平台、賣家信譽與物流風險。

## Portfolio positioning

此專案展示 AI Product Manager / AI Engineer 相關能力：

- 把真實使用者痛點拆成 MVP scope、non-goals 與 safety boundaries。
- 設計透明、可驗證、可維護的 rule engine，而不是盲目使用 AI 黑箱判斷。
- 將 domain knowledge 轉成 structured data、decision rules、reports 與 validation workflow。
- 保留 human-in-the-loop，避免把高風險交易自動化。
- 展示從 v2 到 v2.5 的 incremental product iteration 與 release discipline。
