# SAFETY BOUNDARIES — deal-radar-storage

## Core position

這是一個小型、規則式、人工主導的 decision support tool，不是交易機器人。

所有輸出都只能用來:

- 建 shortlist
- 找出缺資料欄位
- 準備向賣家提問
- 協助人工判斷

不能用來:

- 自動交易
- 自動登入
- 繞過平台限制

## Hard boundaries

### No auto-buying

工具不會:

- 自動下單
- 自動付款
- 自動提交購買流程
- 自動聯絡賣家

### No login handling

工具不會:

- 讀取帳密
- 保存登入狀態
- 使用 cookies / session / token
- 操作帳戶設定

### No bypass of platform security

工具不會:

- 繞過登入
- 繞過 CAPTCHA
- 繞過 anti-bot / anti-scraping 機制
- 模擬受保護的交易操作

### No aggressive scraping

工具不會做高頻抓取、批量抓頁或長時間背景爬取。

`links only` 模式最多只做保守的 metadata 讀取；如果取不到，就回到 `NEED_MORE_INFO`，而不是加大抓取強度。

### No credentials or secrets

不要把以下資料放進專案:

- 帳號
- 密碼
- cookie
- session token
- API key
- private token
- 付款資訊

### No hidden automation claims

工具不會假裝知道:

- 即時市場最低價
- 賣家是否誠實
- SMART 截圖是否造假
- 硬碟未來壽命
- 平台後續糾紛是否可處理

## Human confirmation is always required

即使結果是 `BUY_CANDIDATE`，你仍然必須人工確認:

- SMART / CrystalDiskInfo 是否完整
- 型號、容量、介面是否與需求一致
- 實物照片是否合理
- 退換條款是否清楚
- 賣家評價與交易風險是否可接受
- 你是否已有備份策略

## Safe fallback behavior

當證據不足時，工具應該:

- 優先回傳 `NEED_MORE_INFO`
- 指出缺少哪些欄位
- 生成賣家提問
- 阻止過早付款

而不是:

- 猜測健康狀態
- 假裝完成完整評估
- 輸出過度自信的購買結論

## Recommended usage

### Safe use

- 小批量人工 shortlist
- 手動複製連結與商品資料
- 用 requirements YAML 定義搜尋方向
- 用 reports 協助議價與補證據

### Unsafe use

- 當自動買貨 bot 使用
- 當大量爬蟲使用
- 當平台繞過工具使用
- 當保證交易成功或資料安全的工具使用

## Final reminder

這個專案的目標是降低新手犯錯機率，不是替代交易判斷。

如果 evidence 不完整，最安全的行為不是「想辦法自動補抓」，而是:

1. 停下來
2. 向賣家補資料
3. 再重新評估
