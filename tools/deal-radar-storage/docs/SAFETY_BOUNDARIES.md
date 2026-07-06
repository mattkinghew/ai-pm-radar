# SAFETY BOUNDARIES — deal-radar-storage v3.1

## Core safety principles

此專案是 decision support tool，不是 purchasing bot。所有輸出都只用於輔助人工判斷。

## Explicit boundaries

### No auto-buying

工具不會自動下單、不會提交購買、不會付款、不會聯絡賣家。

### No account automation

工具不處理平台帳戶流程，也不保存登入狀態或 session data。

### No aggressive scraping

工具不會高頻抓取網頁、不會批量讀取平台頁面。Link-only mode、v3 capture mode 和 v3.1 search-capture mode 即使沒有網頁 metadata 也可運作。

### No credentials

專案不需要、也不應保存任何 credentials，包括帳號、密碼、cookies、session tokens。

### No API keys

專案不需要 API keys。不要把 API key、private token 或 `.env` secret 放入 repository。

### Browser-assisted manual capture boundary

v3 capture mode 只解析使用者手動複製到 `captures/raw/*.txt` 的本地文字。工具不會自動開頁、不會讀取瀏覽器 session、不會保存 cookies、不會自動聯絡賣家，也不會替使用者付款。

### Search result batch capture boundary

v3.1 search-capture mode 只解析使用者手動複製到 `captures/raw_search/*.txt` 的本地搜尋結果文字。它只做本地 candidate triage，不會打開 product page、不會讀取平台帳戶資料、不會操作交易流程。

### Human confirmation required before purchase

即使 decision 是 `BUY_CANDIDATE`，仍需人工確認：

- SMART 截圖是否完整。
- 型號、容量、序號或實物照片是否合理。
- 退換條款是否清楚。
- 賣家評價和交易風險是否可接受。
- 自己是否已有備份策略。

### SMART data is advisory, not a health guarantee

SMART 資料只能作 advisory evidence。即使所有欄位正常，二手硬碟仍可能故障。工具不保證硬碟壽命、可靠性或資料安全。

## Recommended safe use

- 把工具輸出當作 shortlist 和 seller question generator。
- 對 `NEED_MORE_INFO` 不要急於購買。
- 對 hard reject 項目，除非證明原資料錯誤，否則不要嘗試「救回」。
- 重要資料至少使用 3-2-1 backup strategy；不要把唯一副本放在二手硬碟。
- 不要把個人帳號、平台 cookie 或付款資料放入任何 CSV / YAML / report。
