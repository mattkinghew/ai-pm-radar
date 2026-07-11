# AI PM Radar Content Review Workflow

## Purpose

This document explains the human-in-the-loop review workflow for turning daily AI news into structured PM insight.

It is designed for a beginner-friendly, low-risk workflow:

- no heavy scraping
- no backend dependency
- no claim of fully autonomous publishing
- no assumption that AI-generated summaries are correct by default

## Core Principle

AI PM Radar is manual or semi-manual by design.

The workflow is:

```text
Source collection -> draft structured entry -> human review -> JSON validation -> static build
```

## Review Goals

Each review pass should confirm:

- the item is real and source-linked
- the summary stays conservative
- the PM insight is explicit
- the risk note is meaningful
- the item is useful for target readers
- the workflow does not over-claim automation

## Operating Stages

### Stage 1: Source selection

Collect 5 to 10 candidate items from:

- official product or platform blogs
- official documentation
- reputable research or policy organizations
- reputable technology reporting
- selected Hong Kong ecosystem sources when relevant

Reject items that are:

- rumor-only
- unsourced
- duplicate commentary without original evidence
- mainly hype with no usable product or workflow insight

### Stage 2: Draft structured entry

Create one article object per selected item.

Required core fields:

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

Optional review fields:

- `review.status`
- `review.human_review_required`
- `review.review_notes`
- `review.scoring.ai_pm_relevance`
- `review.scoring.hk_relevance`
- `review.scoring.actionability`
- `review.scoring.technical_depth`
- `review.scoring.portfolio_value`

### Stage 3: Human review

This is the core design step.

Reviewer checks:

#### 1. Source check

- Is `source_url` valid and direct?
- Is `source_name` accurate?
- Is the claim grounded in the linked source?
- Is the source primary, official, or at least reputable?

#### 2. Summary check

- Does the summary avoid unsupported claims?
- Does it avoid copying large source text?
- Does it clearly separate fact from interpretation?

#### 3. PM insight check

- Does `business_angle` explain operational or decision impact?
- Does `ai_pm_angle` explain product thinking, rollout, evaluation, or governance?
- Are these two fields meaningfully different?

#### 4. Risk check

- Does `risk_note` mention a real limitation or misuse risk?
- Does the wording stay cautious?
- Does the item need a stronger disclaimer?

#### 5. Audience fit check

- Is this useful for AI PM learners?
- Is there a Hong Kong angle, or should `hk_relevance` stay low?
- Does the item help NGO, education, or SME readers?

#### 6. Portfolio check

- Would this help explain AI PM judgment in an interview?
- Does it show scope control, evaluation logic, or human review design?
- Is it strong enough to reuse in README, case study, or public explanation?

## Suggested Review Decision States

Use a simple status model:

- `draft`
  - structured entry exists but still needs checking
- `reviewed`
  - human reviewed and ready for publication

Avoid adding more workflow states until the process becomes truly multi-step.

## Example Review Checklist

Use this flat checklist per article:

- Source URL opens and matches the article claim
- Summary is written in your own words
- `why_it_matters` is audience-specific
- `business_angle` is concrete
- `ai_pm_angle` is product-specific
- `risk_note` is not generic
- Base scores are filled
- Optional review scores are reasonable
- Human review completed before save

## Suggested Review Notes Style

Keep review notes short and operational.

Good examples:

- `Strong AI PM example because it highlights rollout readiness and evaluation.`
- `Global source only; do not overstate Hong Kong relevance.`
- `Useful for portfolio framing but technical depth is low.`
- `Risk note should mention data quality and human oversight.`

Weak examples:

- `Looks good.`
- `Interesting article.`
- `Maybe useful.`

## Validation Gate

After review, save the file under:

```text
data/daily/YYYY-MM-DD.json
```

Then run:

```bash
npm run validate:data
npm run validate:daily
npm run build
```

## What This Workflow Does Not Claim

This workflow does not claim:

- automatic source discovery
- automatic truth checking
- automatic publish approval
- backend editorial orchestration
- production-grade content automation

The system is intentionally lightweight:

- local JSON files
- static site build
- manual or semi-manual review
- script-based validation

## Why This Matters for Portfolio Positioning

This workflow demonstrates:

- structured content operations
- AI PM framing
- governance awareness
- review-first product thinking
- MVP discipline

That is more credible than claiming end-to-end automation that the current repo does not actually implement.
