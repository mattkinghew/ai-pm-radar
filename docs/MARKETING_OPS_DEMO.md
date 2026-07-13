# Internal AI Marketing Operations Demo

This repository now includes a second static portfolio demo at `/marketing-ops-demo`.

Purpose:

- show how the existing AI PM Radar information architecture can be adapted into an internal marketing admin and creative review dashboard
- keep the demo interview-ready without adding backend, login, database, or external services
- stay accurate about scope: this is still a static MVP concept, not a production SaaS platform

Included artifacts:

- `app/marketing-ops-demo/page.tsx`
- `components/MarketingOpsDemo.tsx`
- `data/marketing-ops/sample-campaign.json`
- `scripts/validate-marketing-ops.mjs`

What the demo shows:

- admin funnel metrics and derived KPIs
- creative review cards with possible issue, AI suggestion, and next action
- AI-generated support outputs such as weekly report draft, ad copy ideas, PPT outline, and follow-up suggestions
- explicit risk controls and production recommendations

Scope boundaries:

- anonymised sample data only
- no client CRM integration
- no API keys
- no auto-publishing
- human review remains required

Validation:

```bash
npm run validate:marketing-ops
```

Interview framing:

- This page is useful for explaining AI PM thinking in workflow design, KPI definition, safe AI assistance, and scope control.
- It can also support marketing-ops or operations-oriented PM interview conversations without overstating production readiness.
