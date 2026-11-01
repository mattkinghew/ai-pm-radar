# Goal 06：PDF 同 YouTube 字幕入閱讀器

## 目標
- PDF：如果 content-type 係 application/pdf，就喺 Worker 內用 `pdfjs-dist`（或者 unpdf）抽文字，限 20 頁或 5MB，再分段落入 `articles`。
- YouTube：用 `youtube.com/watch` 或 `youtu.be` 網址讀 timedtext 或 caption track（優先揀英文／中文），段落加時間戳，按每 60 秒合併成一段。
- 翻譯同總結沿用 2500 字元分段，額度計算不變。

## 風險
- YouTube caption endpoint 唔穩定，會俾 bot 擋，所以要有 fallback 去 RSS 摘錄。
- PDF library 會令 bundle size 變大，要留意 Worker 1MB／10MB 上限。

## 驗收
用 fixture PDF 同 caption XML 做測試。
