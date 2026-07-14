# Daily Update Workflow

## Purpose

This project uses a safer daily update MVP for interview demos and static portfolio use.

The goal is to show how curated AI and business signals can become structured analysis without claiming fully autonomous production scraping.

## Why this MVP uses curated sources

- It keeps the workflow stable and reviewable.
- It avoids uncontrolled scraping or fragile site-specific extraction.
- It respects paywalls, login boundaries, robots rules, and source permissions.
- It supports a more honest interview narrative: AI-assisted drafting plus human review, not unattended publishing.

## Preferred input sources

- Official company blogs
- Official product or platform documentation
- Reputable news sources
- Research papers and preprints with clear links
- Manually reviewed candidate links
- RSS or approved APIs only if explicitly added later

## Daily workflow

1. Collect 5 candidate sources from approved or manually reviewed links.
2. Summarize each source into short notes.
3. Classify each item with business angle, AI PM angle, and risk note.
4. Review wording and scoring manually.
5. Save the final file to `data/daily/YYYY-MM-DD.json`.
6. Run validation.
7. Build and deploy the static site.

## Safety boundaries

- No paywall bypass
- No login bypass
- No copying full articles into the repo
- No sensitive or private data
- Source links required for every published item
- Human review required before publish

## Lightweight helper files

- `data/sources/daily-source-candidates.json`
  - Example list of source types that fit this MVP.
- `scripts/prepare-daily-brief.mjs`
  - Reads manually prepared source notes and produces a schema-aligned draft.
- `data/sources/today-source-notes.json`
  - Optional local working file for manually prepared notes.

## Suggested note shape for local drafting

```json
[
  {
    "title": "Example title",
    "source_name": "Example source",
    "source_url": "https://example.com/item",
    "short_notes": "Two or three source-aware notes.",
    "category": "AI PM Learning"
  }
]
```

Optional fields such as `why_it_matters`, `business_angle`, `ai_pm_angle`, `risk_note`, `tags`, `published_at`, and review scores can be added before generating the draft.

## Validation sequence

```bash
npm run prepare:daily
npm run validate:daily
npm run validate:data
npm run build
```

If the helper script is only being used for preview, it can print a draft to the console without writing any published data file.

## Future automation options

- RSS feeds from approved sources
- Approved APIs with clear usage terms
- Make or n8n workflow for source queue preparation
- Google Sheets review queue for editorial triage
- Scheduled GitHub Action only after secrets handling and source permissions are defined safely

## Non-goals for this MVP

- No backend or database
- No scheduled crawling
- No external AI API calls inside the helper script
- No auto-publishing
- No claim of real-time or autonomous news coverage
