# AI PM Radar

Static daily AI and business radar website for non-technical AI PM learners, NGO and education practitioners, and SME decision-makers.

## Stack

- Next.js App Router
- TypeScript
- Static JSON data in `data/daily/YYYY-MM-DD.json`
- Static export for Firebase Hosting or Cloudflare Pages

## Project structure

```text
ai-pm-radar/
├── .gitignore
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
│   └── daily/
│       └── 2026-06-25.json
├── lib/
│   ├── articles.ts
│   └── format.ts
├── firebase.json
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Implementation steps

1. Add a new JSON file under `data/daily/` using the date format `YYYY-MM-DD.json`.
2. Keep the file shape as:

```json
{
  "date": "2026-06-25",
  "articles": []
}
```

3. Each article must include all required fields:
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
4. The home page automatically reads the latest daily file and shows the top 5 section.
5. The archive page loads all daily files and supports category filtering.
6. Each article gets a static detail page and an expandable archive card.

## Local run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Build static output:

```bash
npm run build
```

Next.js writes the export to `out/`.

## Deployment

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

## Notes

- Source links intentionally open in a new tab with `rel="noopener noreferrer"`.
- The footer includes the required disclaimer.
- No API keys are used in the frontend.
