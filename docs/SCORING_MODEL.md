# AI PM Radar Scoring Model

## Purpose

This document explains how AI PM Radar turns daily AI news into structured product-management insight without claiming full automation.

The current workflow stays intentionally simple:

1. Human selects candidate sources.
2. Human or AI-assisted drafting fills the JSON fields.
3. Human review checks accuracy, relevance, and risk.
4. Validation scripts check JSON structure before build.

The scoring model supports prioritization and portfolio explanation. It does not replace editorial judgment.

## Two Score Layers

AI PM Radar uses two score layers:

### 1. Current delivery scores

These fields already exist in the live JSON structure and are used by the current static workflow:

- `impact_score`
- `relevance_score`
- `trust_score`

Use 1 to 10 integers.

Purpose:

- keep daily ranking simple
- support Top 5 prioritization
- avoid frontend changes for the current MVP

### 2. Recommended review scores

These new dimensions are recommended as a human-review layer inside an optional `review.scoring` object.

Use 1 to 5 integers.

- `ai_pm_relevance`
  - How strongly the item helps an AI Product Manager think about product strategy, evaluation, rollout, user workflow, or governance.
- `hk_relevance`
  - How relevant the item is to Hong Kong context, such as local market needs, SME reality, regulation discussion, education, or regional adoption patterns.
- `actionability`
  - How easily a learner or operator can turn the item into a next step, checklist, or experiment.
- `technical_depth`
  - How much technical detail is required to understand or apply the insight.
- `portfolio_value`
  - How useful the item is for demonstrating AI PM thinking, product framing, risk control, or workflow design in a portfolio.

## Why Keep Two Score Layers

This design is intentionally conservative.

- The existing app can keep using `impact_score`, `relevance_score`, and `trust_score`.
- The optional review scores let the editor explain why an item matters beyond basic ranking.
- This avoids over-claiming automation or introducing backend complexity before the content workflow is stable.

## Suggested JSON Shape

Recommended article shape:

```json
{
  "question_title": "How should SMEs decide whether an AI copilot is ready for real operations?",
  "short_title": "Copilot rollout readiness",
  "summary": "SMEs can evaluate AI copilots through small workflow trials and measurable review steps before expansion.",
  "why_it_matters": "This helps readers move from headline interest to practical rollout thinking.",
  "business_angle": "Teams can start with narrow use cases and explicit review checkpoints.",
  "ai_pm_angle": "AI PM learners should define workflow, success metrics, and failure modes before scaling.",
  "risk_note": "Teams may overtrust AI output if source review and staff training are weak.",
  "category": "SME Strategy",
  "tags": ["copilot", "SME", "rollout"],
  "source_name": "Example Source",
  "source_url": "https://example.com/article",
  "published_at": "2026-07-11T09:00:00Z",
  "impact_score": 9,
  "relevance_score": 9,
  "trust_score": 8,
  "review": {
    "status": "reviewed",
    "human_review_required": true,
    "review_notes": "Useful for AI PM interviews because it shows rollout thinking, not just tool hype.",
    "scoring": {
      "ai_pm_relevance": 5,
      "hk_relevance": 3,
      "actionability": 5,
      "technical_depth": 2,
      "portfolio_value": 5
    }
  }
}
```

## Score Guidance

### Delivery scores: 1 to 10

- `9-10`: strong source, high relevance, high practical importance
- `7-8`: useful and credible, but not critical
- `5-6`: interesting but indirect
- `1-4`: usually not worth publishing

### Review scores: 1 to 5

- `5`: very strong fit
- `4`: strong fit
- `3`: useful but moderate
- `2`: weak fit
- `1`: very limited value

## How Daily News Becomes PM Insight

AI PM Radar is not a generic news summary feed.

Each selected item should answer five questions:

1. What changed?
2. Why does it matter to a target reader?
3. What business or operational implication follows?
4. What AI PM decision lens applies?
5. What risk, limitation, or uncertainty should be stated?

This means the output is closer to structured PM interpretation than raw content aggregation.

## Practical Interpretation Rules

### AI PM relevance

Give a higher score when the item helps discuss:

- user problem framing
- product scope
- evaluation design
- rollout readiness
- trust and governance
- operational adoption

### HK relevance

Give a higher score when the item can reasonably connect to:

- Hong Kong SME workflows
- Hong Kong education or NGO use cases
- regional AI adoption constraints
- local policy, compliance, or ecosystem context

Do not inflate this score if the source is globally interesting but has no clear Hong Kong angle.

### Actionability

Give a higher score when the item can lead to:

- a checklist
- a workflow change
- a product hypothesis
- a stakeholder talking point
- a portfolio artifact or case-study angle

### Technical depth

This is not a “higher is always better” score.

- `1-2`: accessible to non-technical readers
- `3`: moderate technical interpretation needed
- `4-5`: requires stronger engineering or model knowledge

Use this score to help content balance, not to reward complexity.

### Portfolio value

Give a higher score when the item helps demonstrate:

- AI PM judgment
- structured analysis
- safe AI adoption thinking
- MVP scope control
- quality control or human-in-the-loop review design

## Human-in-the-Loop Rule

The scoring model is an editorial aid, not an autonomous decision-maker.

Human review remains required because:

- source quality can vary
- AI-assisted summaries can overstate claims
- Hong Kong relevance often requires contextual judgment
- portfolio value is interpretive, not purely objective

## Definition of Done

A daily item is ready when:

- required article fields are complete
- the summary is source-aware and conservative
- a real `risk_note` exists
- base scores are filled
- optional review scores are added when helpful
- a human has checked the item before publish
