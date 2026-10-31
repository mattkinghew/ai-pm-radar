# PRODUCT BRIEF — deal-radar-storage

## Product summary

`deal-radar-storage` 是一個本地執行、規則式 (rule-based)、對新手友善的二手儲存裝置 decision support tool。

它支援三種最小可用輸入:

1. `links only`
2. `requirements YAML only`
3. `links + requirements + optional listings metadata`

工具會把輸入轉成可解釋的決策、風險提示、賣家問題與人工搜尋輔助文件，但不會自動購買或接管交易流程。

## Problem

二手 SSD / HDD / 硬碟盒購買有幾個典型問題:

- 商品標題、價格、SMART、退換條款分散而且常不完整
- 新手很難把「看起來便宜」和「實際可安全使用」分開
- 不同用途標準不同
  - `main_work_drive`
  - `external_mac_drive`
  - `cold_storage`
  - `test_only`
- 高風險行為不適合自動化
  - 自動下單
  - 平台登入控制
  - 大量抓取商品頁

## Target user

- 想用低成本方式篩選二手儲存裝置的人
- 會改簡單文字檔 / CSV / YAML，但不是資深工程師的人
- 想把 domain knowledge 變成透明規則，而不是黑箱 AI 的學習者
- 想做 AI PM / AI Engineer portfolio case 的個人開發者

## Product goals

- 讓使用者在 5 到 10 分鐘內完成一輪初步篩選
- 把「資料不足」具體化成可追問欄位與賣家問題
- 把 requirements YAML 轉成可手動執行的搜尋策略
- 在不碰高風險自動化的前提下，提高 shortlist 品質

## Supported workflows

### Links only

輸入: 一行一個商品連結  
輸出: `NEED_MORE_INFO` / `REJECT` 傾向、缺少欄位、賣家提問

適合:

- 你剛開始搜商品
- 還沒有整理 metadata
- 想先快速建立待補資料清單

### Requirements YAML only

輸入: 需求 YAML  
輸出:

- `search_urls.md`
- `discovery_queries.md`
- `discovery_urls.md`
- `buying_criteria.md`
- `quick_checklist.md`

適合:

- 還沒有候選商品
- 想先定義搜尋方向
- 想把個人偏好轉成可重複使用的規則

### Links + requirements + optional listings metadata

輸入:

- 連結
- 需求 YAML
- 手動 metadata CSV

輸出:

- 候選決策
- 建議價格區間
- 賣家提問
- 補資料清單
- 搜尋輔助文件

適合:

- 已有 shortlist
- 想把「搜尋策略」與「候選評分」放在同一輪 workflow

## Scope

### In scope

- 規則式分類與風險關鍵字判斷
- SMART / health 欄位的基本 hard reject
- 用途適配判斷
- 輸出可讀報告與 CSV
- requirements YAML 轉人工搜尋 query / URL
- 基本 sample 與 basic tests

### Out of scope

- 自動購買
- 自動聯絡賣家
- 登入平台
- CAPTCHA / session / anti-bot 處理
- aggressive scraping
- 即時市場定價保證
- 預測硬碟剩餘壽命

## Safety and risk posture

本產品刻意保留 `human-in-the-loop`:

- 決策只是輔助，不是 final purchase authority
- `BUY_CANDIDATE` 不等於可以直接付款
- 缺資料時寧可保守標成 `NEED_MORE_INFO`
- 規則偏透明與可修改，而不是追求自動化覆蓋率

## Success metrics

- 新手能直接用 sample 檔跑通三種模式
- `quick_report.md` 能清楚區分 candidate / need more info / reject
- `requirements only` 模式能產生可手動執行的搜尋文件
- 測試可驗證三種 quick workflow 都能產生預期檔案

## Key limitations

- 依賴手動輸入與手動確認
- 價格帶是啟發式，不保證即時準確
- 只適合小規模、人工主導的 shortlist workflow
- 不應被解讀為交易建議、保固承諾或資料安全保證
