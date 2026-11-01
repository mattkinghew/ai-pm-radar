# Goal 05：JS 網站 headless 擷取全文

## 背景
`cloud/src/reader.mjs` 嘅 `extractArticle` 只係解析靜態 HTML。如果網站要靠 JS 先 render 到內容（SPA、Substack app 呢類），結果會係 status=failed，然後退回顯示 RSS 摘錄。

## 目標
- 當 `failed` 而且 chars < 400 時，用 Cloudflare Browser Rendering（`@cloudflare/puppeteer`，binding `BROWSER`）重新擷取一次。
- 結果照樣寫入 `articles`，另加 `via='browser'`（新 migration）。
- 每日上限（例如 20 次），沿用 `ai_usage` 嘅做法。
- 設 15s timeout，只可以去 `safeFetchUrl` 允許嘅網址。

## 驗收
- 有 fake browser 嘅單元測試；有 quota 測試。
- 有新 binding 同費用影響，要 Matt 批准先 deploy。
