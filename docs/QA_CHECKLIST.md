# AI PM Radar QA Checklist

## Local run 檢查
- `npm install` 已完成
- `npm run dev` 可正常啟動
- 首頁、Archive、About、article detail 可開啟

## Build 檢查
- `npm run validate:data` 成功
- `npm run build` 成功
- build 過程沒有 JSON parse error
- 沒有因缺漏欄位造成 SSG 中斷

## Static export 檢查
- `out/` 目錄已生成
- `out/index.html` 存在
- `out/archive/index.html` 存在
- `out/about/index.html` 存在
- `out/article/.../index.html` 已生成

## Mobile UI 檢查
- iPhone 寬度下首頁 hero 不破版
- Top 5 區塊可讀、按鈕可點
- Archive 篩選器在手機上可操作
- 卡片文字沒有超出容器
- Footer disclaimer 可讀

## Article card 互動檢查
- Archive 中卡片可展開
- 展開後 `why_it_matters`、`business_angle`、`ai_pm_angle`、`risk_note` 可見
- 連到 article detail 的連結正確
- 同一篇文章的標題、分類與分數顯示一致

## External link 檢查
- `source_url` 可點擊
- source link 會在新分頁開啟
- `rel="noopener noreferrer"` 保持存在
- 無空白或錯誤 URL

## Accessibility 檢查
- 頁面標題層級合理
- 互動元素可用鍵盤操作
- 連結文字不是只有「click here」這類模糊字樣
- 文字與背景對比可讀
- 手機點擊目標大小合理

## Deployment 檢查
- Cloudflare Pages 或 Firebase Hosting 指向 `out/`
- 部署後 `/`、`/archive`、`/about`、`/article/...` 路由可開啟
- 靜態部署後樣式檔正常載入
- 外部連結與 disclaimer 在正式站仍存在

## Review metadata post-launch QA — 2026-07-11
- Cloudflare Pages preview: `https://23df7705.ai-pm-radar-pages.pages.dev`
- `/article/2026-07-02-copilot-rollout-readiness/` 顯示 `Review Reviewed`、`Review metadata`、review scoring、review note。
- `/article/2026-07-02-evaluation-as-product-work/` 顯示 `Review Draft`、`Review metadata`、review scoring、review note。
- `review.*` 只作 optional human-reviewed metadata 顯示；未改動 `priority_score` 計算或排序邏輯。

## Review metadata stable production QA — 2026-07-11
- Stable production URL: `https://ai-pm-radar-pages.pages.dev/`
- `/` 回傳 HTTP 200，並顯示 review badge evidence：`Review Reviewed` 與 `Review Draft`。
- `/article/2026-07-02-copilot-rollout-readiness/` 回傳 HTTP 200，並顯示 `Review Reviewed`、`Review metadata`、review scoring dimensions、review note。
- `/article/2026-07-02-evaluation-as-product-work/` 回傳 HTTP 200，並顯示 `Review Draft`、`Review metadata`、review scoring dimensions、review note。
- Stable production QA confirms `review.*` remains optional human-reviewed metadata and does not affect `priority_score` ranking logic.
