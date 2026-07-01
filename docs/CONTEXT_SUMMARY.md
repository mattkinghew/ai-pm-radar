# AI PM Radar Context Summary

## 專案概覽
AI PM Radar 是以 Next.js static export 建立的每日 AI / business radar 網站。產品重點不是即時抓新聞，而是把每日選出的少量內容整理成對非技術讀者有用的學習與決策材料。

## 目前狀態
- 狀態：`Local Verified Baseline + Verification Record Committed`
- 架構：Next.js + TypeScript + local JSON
- Live demo：`https://ai-pm-radar-pages.pages.dev/`
- 部署目標：Cloudflare Pages 或 Firebase Hosting
- 內容來源：`data/daily/YYYY-MM-DD.json`
- 已有資料驗證腳本：`npm run validate:data`、`npm run validate:daily`
- 驗收紀錄：`docs/LOCAL_VERIFICATION_2026-07-01.md`

## 檔案結構
```text
ai-pm-radar/
├── app/
│   ├── about/page.tsx
│   ├── archive/page.tsx
│   ├── article/[slug]/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ArchiveExplorer.tsx
│   ├── ArticleCard.tsx
│   ├── Footer.tsx
│   └── Header.tsx
├── data/
│   ├── daily/
│   │   └── 2026-06-25.json
│   └── templates/
├── docs/
├── lib/
│   ├── articles.ts
│   └── format.ts
├── prompts/
├── firebase.json
├── next.config.ts
├── package.json
├── README.md
└── tsconfig.json
```

## 已完成工作
- 已建立首頁 `/`
- 已建立 Archive 頁 `/archive`
- 已建立 About 頁 `/about`
- 已建立 article detail 頁 `/article/[slug]`
- 已實作 `ArticleCard`、`ArchiveExplorer`、`Header`、`Footer`
- 已支援 Top 5 daily section
- 已支援 category filter
- 已設定 `output: "export"` 與 `out/` 靜態輸出
- 已新增 `scripts/validate_daily_data.mjs`，可檢查 daily JSON 結構、必填欄位、URL、分數與重複來源
- 已新增 `scripts/validate-daily-json.mjs` 作為 daily JSON 驗證流程
- 已新增本地驗收紀錄 `docs/LOCAL_VERIFICATION_2026-07-01.md`
- README 已補上 demo link、目前狀態、驗收證據與 portfolio value proposition

## 重要實作細節
- `lib/articles.ts` 會在 build time 讀取所有 `data/daily/*.json`
- article slug 由 `date + short_title/question_title` 組成
- priority score 計算方式：
  - `impact_score * 0.5 + relevance_score * 0.3 + trust_score * 0.2`
- 首頁會取最新日期資料
- source link 已設定新分頁開啟，避免離開站內內容

## 已知問題
- 目前只有一份 sample data，內容覆蓋度有限
- 尚未建立 lint 與 typecheck script
- `package.json` 目前沒有 `lint` 或 `typecheck` script
- sample data 屬示範內容，不代表真實新聞研究結果

## 限制條件
- 不引入 backend
- 不使用 API key
- 不修改目前 build config
- 不移除既有 sample data
- 內容品質主要依賴人工與 prompt workflow 控管

## 下一步任務
- 擴充更多真實 daily content samples
- 補寫 portfolio case-study 版本，說明問題、受眾、MVP 取捨、驗證方式與後續 roadmap
- 視需要補上更嚴格的 schema validation 與內容品質規則
- 建立更完整的內容審核腳本或 pre-build 檢查
- 規劃後續半自動化內容產出流程

## 建議未來 AI agent 使用的 prompts
- 「請根據 `data/templates/daily.template.json` 與 `prompts/daily_json_generator.md` 生成今日 JSON 草稿。」
- 「請審查 `data/daily/YYYY-MM-DD.json`，依 `docs/CONTENT_WORKFLOW.md` 檢查 hallucination、來源品質與 overclaiming。」
- 「請在不改 build config 的前提下，為此專案補上最小 schema validation 或內容檢查腳本。」
- 「請把目前專案狀態同步更新到 `docs/CONTEXT_SUMMARY.md` 與 `docs/TASK_LOG.md`。」
