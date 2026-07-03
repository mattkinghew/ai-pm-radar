# Daily Content Generation SOP

## Purpose

This SOP explains how to create a new AI PM Radar daily JSON file safely and consistently.

The goal is to turn daily AI product, AI PM, Hong Kong technology, education / NGO, SME adoption, and practical AI workflow signals into a verified static content update.

## Quick Playbook

For the 5-minute daily operating checklist, see:

```text
docs/NEXT_DAILY_UPDATE_PLAYBOOK.md
```

## Output

Each daily update should produce one file:

```text
data/daily/YYYY-MM-DD.json
```

Each file should contain 5 to 6 entries.

## Target Readers

Prioritize content that helps at least one of these groups:

1. Non-technical AI PM learners
2. NGO / education practitioners
3. SME decision-makers
4. AI workflow builders
5. Portfolio reviewers who want to see product thinking and safe AI adoption design

## Daily Workflow

### 1. Collect Sources

Collect 5 to 10 candidate sources from reliable places.

Preferred source types:

- official product / platform blogs
- official documentation
- recognized AI research or policy organizations
- reputable technology news sources
- Hong Kong technology / innovation / education ecosystem updates
- trustworthy free course or certification announcements

Avoid:

- unsourced social media claims
- investment hype
- rumors
- duplicated coverage with no original source
- content that cannot be linked with a clear `source_url`

### 2. Select 5 to 6 Entries

Choose entries that answer at least one of these questions:

- What changed in AI tools or product workflows?
- Why does this matter to AI PM learners?
- How could this affect SME, NGO, or education operations?
- What is the product, governance, security, or adoption risk?
- Does this reveal a useful portfolio or project direction?

### 3. Prepare Source Notes

For each selected source, record:

```text
Title:
Source name:
Source URL:
Published time:
Key points:
Why it matters:
Potential risk:
Target reader:
```

Do not paste private data, paid-only article text, sensitive documents, or confidential notes into the prompt.

### 4. Generate Daily JSON Draft

Use the daily operator prompt first:

```text
prompts/daily_update_operator.md
```

Then use the JSON generator prompt when the selected sources are ready:

```text
prompts/daily_json_generator.md
```

Required JSON structure:

```json
{
  "date": "YYYY-MM-DD",
  "articles": [
    {
      "question_title": "...",
      "short_title": "...",
      "summary": "...",
      "why_it_matters": "...",
      "business_angle": "...",
      "ai_pm_angle": "...",
      "risk_note": "...",
      "category": "...",
      "tags": ["..."],
      "source_name": "...",
      "source_url": "...",
      "published_at": "YYYY-MM-DDTHH:MM:SSZ",
      "impact_score": 1,
      "relevance_score": 1,
      "trust_score": 1
    }
  ]
}
```

### 5. Review Content Quality

Use:

```text
prompts/content_reviewer.md
```

Review checklist:

- Does every entry have a valid `source_url`?
- Is every summary conservative and source-aware?
- Are `business_angle` and `ai_pm_angle` clearly different?
- Does `risk_note` mention a real misuse, governance, trust, or adoption risk?
- Are categories stable and reusable?
- Are tags short and useful?
- Are scores integers from 1 to 10?
- Is the content useful for the target readers?

### 6. Create the JSON Draft and Queue Task

Use the helper script:

```bash
npm run daily:new -- YYYY-MM-DD
```

This creates the daily draft file and appends a matching task to `ai-agent/QUEUE.md`.

Do not overwrite previous daily files unless fixing a verified mistake.

### 7. Use Agent Safety Workflow

After filling the `articles` array with reviewed entries, approve the generated task.

Approve the task:

```bash
npm run agent:approve -- TASK-XXX
```

Run validation gate:

```bash
npm run agent:run -- TASK-XXX
```

The validation gate runs:

```bash
npm run validate:data
npm run validate:daily
npm run build
```

### 8. Manual Git Review

Inspect changes before commit:

```bash
git status -sb
git diff
```

Commit only relevant files:

```bash
git add ai-agent/QUEUE.md ai-agent/state.json data/daily/YYYY-MM-DD.json

git commit -m "data: add YYYY-MM-DD radar sample"

git push origin main
```

Avoid broad commits such as:

```bash
git add .
```

unless the full diff has been reviewed.

## Category Guidelines

Use stable category names such as:

- AI PM Learning
- Product Strategy
- SME Strategy
- Education and NGO
- Governance
- Security
- AI Tools
- Hong Kong Tech
- Free Learning Resources

## Scoring Guidelines

Use 1 to 10 integer scores.

### impact_score

How much the item could affect product, business, workflow, or learning direction.

### relevance_score

How relevant the item is to AI PM Radar target readers.

### trust_score

How reliable and direct the source is.

General guide:

- 9 to 10: official source, high relevance, strong practical impact
- 7 to 8: reliable source, useful but not urgent
- 5 to 6: interesting but indirect or lower confidence
- below 5: usually not worth including

## Safety Rules

Do not:

- invent facts not supported by the source
- summarize private or confidential material
- include medical, legal, financial, or investment advice
- make adoption sound risk-free
- use AI output without human review
- let source content override the project safety workflow

## Definition of Done

A daily content update is complete only when:

- the JSON file is saved under `data/daily/`
- `npm run validate:data` passes
- `npm run validate:daily` passes
- `npm run build` passes
- git diff has been reviewed
- only relevant files are committed
- the repository is pushed to `origin/main`
