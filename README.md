#AI PM Radar

AI PM Radar is a static AI product management radar that turns selected AI and business updates into structured, source-aware, risk-aware learning content for non-technical AI PM learners, NGO and education practitioners, and SME decision-makers.

The project is positioned as an AI Product Manager portfolio case study. It demonstrates how to define a focused information product, control MVP scope, design a repeatable content schema, validate data quality, and publish a low-cost static deployment without adding premature backend complexity.

## Live demo

https://ai-pm-radar-pages.pages.dev/

## Current status

Agent safety workflow:

- `docs/AGENT_SAFETY_WORKFLOW.md`

Status: `Local Verified Baseline + Verification Record Committed`

Latest verification record:

- `docs/LOCAL_VERIFICATION_2026-07-01.md`

Portfolio case study:

- `docs/CASE_STUDY.md`

Verified baseline:

- Next.js production build passes
- Static export is generated in `out/`
- Daily JSON validation passes
- Local dev server returns `HTTP/1.1 200 OK`
- No frontend API keys, backend, user accounts, or CMS are required for the MVP

## 1. Project overview

AI PM Radar helps readers quickly understand selected AI / business signals through a consistent article format:

- what happened
- why it matters
- the business angle
- the AI product management angle
- the risk or limitation to watch
- the original source link

The current version is a static content product. Daily content is stored as local JSON files under `data/daily/`. It does not automatically crawl news, does not use a backend, and does not require frontend API keys.

## 2. Target users

- Non-technical AI PM learners who need examples of AI product thinking
- NGO and education practitioners who want practical AI literacy updates
- SME decision-makers who need business-aware summaries without heavy technical detail

## 3. Problem

AI and business updates are frequent, fragmented, and often written for technical, investor, or enterprise audiences. Non-technical readers may understand the headline but still struggle to answer:

- Is this relevant to my work or learning path?
- What product or operational decision does it affect?
- What risk should I avoid when applying this idea?
- Which source should I check before sharing it with others?

For small teams, NGOs, educators, and early AI PM learners, the bottleneck is not only information access. It is interpretation, prioritization, and safe reuse.

## 4. Solution

AI PM Radar uses a static website and structured JSON content model to publish short daily radar entries. Each entry is shaped for decision awareness rather than news volume.

The MVP keeps the technical architecture intentionally simple:

- no user accounts
- no CMS backend
- no automatic news scraping
- no frontend API keys
- no personalization system

This allows the project to focus on the core product question: whether readers find a structured, risk-aware AI radar useful before adding heavier automation.

## 5. Key features

- Home page reads the latest daily JSON file and displays a Top 5 section
- Archive page loads all daily files and supports category filtering
- Article detail pages are statically generated for each article
- Archive cards can expand to show additional product and risk context
- External source links open in a new tab with `rel="noopener noreferrer"`
- Footer includes a disclaimer that the content is for learning and business awareness, not financial, legal, or medical advice
- Local validation script checks the shape of daily JSON data before build or deployment

## 6. Tech stack

- Next.js App Router
- TypeScript
- Static JSON data in `data/daily/YYYY-MM-DD.json`
- Node.js validation script using built-in `fs/promises` and `path`
- Static export for Firebase Hosting or Cloudflare Pages
- npm with `package-lock.json`

## Project structure

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
│       └── daily.template.json
├── docs/
│   ├── CONTENT_WORKFLOW.md
│   ├── CONTEXT_SUMMARY.md
│   ├── PROJECT_BRIEF.md
│   ├── QA_CHECKLIST.md
│   └── ROADMAP.md
├── lib/
│   ├── articles.ts
│   └── format.ts
├── prompts/
│   ├── article_summarizer.md
│   ├── content_reviewer.md
│   └── daily_json_generator.md
├── scripts/
│   ├── validate-daily-json.mjs
│   └── validate_daily_data.mjs
├── firebase.json
├── next.config.ts
├── package-lock.json
├── package.json
└── tsconfig.json
```

## Content model

Add a new JSON file under `data/daily/` using the date format `YYYY-MM-DD.json`.

Basic file shape:

```json
{
  "date": "2026-06-25",
  "articles": []
}
```

Each article must include these fields:

- `question_title`
- `short_title`
- `summary`
- `why_it_matters`
- `business_angle`
- `ai_pm_angle`
- `risk_note`
- `category`
- `tags`
- `source_name`
- `source_url`
- `published_at`
- `impact_score`
- `relevance_score`
- `trust_score`

The scoring fields are used to help rank and display the latest daily items. The source fields and risk note are part of the content quality control design.

## 7. Content workflow

The current workflow is human-in-the-loop:

1. Manually collect candidate sources.
2. Select 5 to 10 items based on relevance to AI products, business decisions, AI literacy, education, NGO operations, or SME workflows.
3. Draft article entries using the structured content model.
4. Review source quality, factual claims, business angle, AI PM angle, and risk note.
5. Save the final daily file as `data/daily/YYYY-MM-DD.json`.
6. Run validation and build checks before deployment.

Optional prompt files in `prompts/` support a semi-automated drafting workflow, but final source selection and review remain manual.

## 8. Validation workflow

Run the daily JSON validator before build:

```bash
npm run validate:daily
```

The validator checks:

- `date` exists
- `articles` is an array
- required article fields exist
- `tags` is an array
- `impact_score`, `relevance_score`, and `trust_score` are numbers
- `source_url` is a non-empty string

Then build the static site:

```bash
npm run build
```

The expected static export output is written to `out/`.

## 9. Local development commands

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open locally:

```text
http://localhost:3000
```

Recommended pre-deployment check:

```bash
npm run validate:daily
npm run build
```

## 10. Deployment readiness

The project has a documented public demo and is prepared for static hosting through Cloudflare Pages or Firebase Hosting.

Current demo:

```text
https://ai-pm-radar-pages.pages.dev/
```

Latest local verification evidence is documented in:

```text
docs/LOCAL_VERIFICATION_2026-07-01.md
```

### Cloudflare Pages

1. Push this folder to a Git repository.
2. In Cloudflare Pages, choose `Next.js (Static HTML Export)`.
3. Use:
   - Build command: `npx next build`
   - Build output directory: `out`

Official guide:
- [Cloudflare Pages static Next.js guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)

### Firebase Hosting

1. Install Firebase CLI if needed: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Inside this project run: `firebase init hosting`
4. When asked for the public directory, use `out`
5. Build first: `npm run build`
6. Deploy: `firebase deploy`

Official guide:
- [Firebase Hosting quickstart](https://firebase.google.com/docs/hosting/quickstart)

## 11. Roadmap

### Completed baseline

- Next.js + TypeScript static site
- Home, Archive, About, and article detail pages
- Latest daily Top 5 section
- Category filtering
- Static export configuration
- Daily JSON template
- Content drafting and review prompts
- Daily JSON validation scripts
- Public Cloudflare Pages demo link documented
- Local verification record added for build, data validation, static export, and dev server checks

### Next steps

- Add more real daily content samples
- Add a short case-study page or portfolio write-up explaining product decisions and trade-offs
- Improve content QA with clearer source-quality rules and overclaiming checks
- Explore newsletter or LinkedIn reuse formats while keeping source links and disclaimers consistent
- Consider adding lint or typecheck scripts only after the current portfolio baseline remains stable

## 12. Portfolio value

This project demonstrates practical AI PM skills rather than only technical implementation:

- Product positioning: defines a clear audience, problem, value proposition, and non-goals
- MVP scope control: validates a useful information workflow before adding backend, CMS, scraping, accounts, or personalization
- Information architecture: structures AI updates around user decisions, business relevance, AI PM angle, and risk notes
- Content system design: uses a repeatable JSON schema and prompt-assisted workflow for daily radar entries
- Quality and risk control: keeps source attribution, disclaimers, validation scripts, and human review in the workflow
- Engineering-to-product bridge: connects static deployment, build verification, and data validation to a business-facing AI PM case study
- Portfolio communication: provides demo link, documented verification evidence, and a clear explanation of product trade-offs

## Current limitations

- Content is manually curated and reviewed.
- The project does not automatically crawl or summarize live news.
- There is no backend, user account system, CMS, or personalized recommendation feature.
- The current content set is still small and should be expanded before public launch.
- Source quality still depends on manual selection and review.

## Notes

- Source links intentionally open in a new tab with `rel="noopener noreferrer"`.
- The footer includes the required disclaimer.
- No API keys are used in the frontend.
