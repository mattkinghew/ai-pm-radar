# AI PM Radar Case Study

## 1. Project Summary

AI PM Radar is a static AI product management radar that turns selected AI and business updates into structured, source-aware, risk-aware learning content.

It is designed as a portfolio case study for demonstrating AI Product Manager thinking: user problem framing, MVP scope control, information architecture, content quality workflow, risk control, and low-cost deployment.

Live demo:

```text
https://ai-pm-radar-pages.pages.dev/
```

## 2. Target Users

- Non-technical AI PM learners who need concrete examples of AI product thinking
- NGO and education practitioners who want practical AI literacy updates
- SME decision-makers who need business-aware AI summaries without heavy technical detail

## 3. User Problem

AI and business updates are frequent, fragmented, and often written for technical, investor, or enterprise audiences.

The target users may understand a headline but still struggle to answer:

- Is this relevant to my work, learning path, or organization?
- What product or operational decision does it affect?
- What risk should I watch before applying or sharing this idea?
- Which original source should I check before trusting the summary?

The product problem is not only information access. It is interpretation, prioritization, and safe reuse.

## 4. Product Decision

The project intentionally starts as a static MVP instead of a crawler, CMS, backend service, or agentic news pipeline.

This decision keeps the first version focused on validating the information product itself:

- Can users understand the AI update quickly?
- Does the structure help them connect news to business and product decisions?
- Does source attribution and risk note reduce overclaiming?
- Can the workflow stay low-cost and maintainable for a solo builder?

The MVP avoids premature complexity:

- No user accounts
- No CMS backend
- No automatic news scraping
- No frontend API keys
- No personalization engine
- No paid infrastructure dependency

## 5. MVP Scope

### Built

- Home page with latest daily radar content
- Archive page with category filtering
- Article detail pages generated from local JSON data
- Daily JSON content model under `data/daily/YYYY-MM-DD.json`
- Content template under `data/templates/`
- Prompt-assisted drafting and review workflow under `prompts/`
- JSON validation scripts
- Static export through Next.js
- Public Cloudflare Pages demo
- Local verification record

### Deferred

- Automated crawling and summarization
- Multi-user CMS workflow
- Login, bookmarks, and personalization
- Recommendation system
- Newsletter automation
- Database-backed content management
- Full editorial dashboard

## 6. AI PM Value Proposition

AI PM Radar demonstrates practical AI PM capabilities beyond building a website.

### Product thinking

- Defines a clear user segment and problem statement
- Prioritizes decision usefulness over news volume
- Separates MVP goals from future automation ideas
- Uses explicit non-goals to prevent scope creep

### AI workflow design

- Uses prompt files to support repeatable drafting and review
- Keeps human-in-the-loop review for source quality and factual claims
- Avoids fully automated publishing before the editorial workflow is reliable

### Risk and quality control

- Requires source name and source URL for each article
- Includes risk notes and disclaimers
- Uses validation scripts to catch incomplete or malformed daily JSON
- Documents local verification evidence before presenting the project as portfolio work

### Technical-product bridge

- Uses Next.js static export to reduce hosting and maintenance cost
- Keeps the architecture understandable for non-engineering interview discussions
- Connects engineering checks to product credibility: validation, build, static output, and demo readiness

## 7. Verification Evidence

Latest verification record:

```text
docs/LOCAL_VERIFICATION_2026-07-01.md
```

Verified items:

- `npm install`: pass
- `npm run build`: pass
- Static export generated in `out/`
- `data/daily/2026-06-25.json`: valid JSON
- `npm run validate:data`: pass
- `npm run validate:daily`: pass
- Local dev server response: `HTTP/1.1 200 OK`

Current portfolio documentation baseline:

- README includes live demo, status, scope, validation workflow, deployment readiness, and portfolio value
- `docs/PROJECT_BRIEF.md` describes product purpose, target users, risks, non-goals, and portfolio evidence
- `docs/CONTEXT_SUMMARY.md` records the current implementation state and next tasks

## 8. Interview Talking Points

### Why a static MVP?

A static MVP is enough to test whether the structured radar format is useful. It avoids backend and automation cost before proving the core value: helping users interpret AI updates safely and practically.

### Why not automate news crawling first?

Automation would increase complexity and hallucination risk. The first version prioritizes source selection, review quality, and product framing before scaling content production.

### What makes this an AI PM project?

The value is not just the website. The project shows product positioning, user segmentation, MVP scope control, human-in-the-loop workflow design, risk-aware content structure, and evidence-based verification.

### What would come next?

The next version should add more real content samples, improve source-quality rules, build a short public case-study page, and later explore semi-automated content drafting while preserving human review.

## 9. Roadmap

### Near term

- Add 2 to 3 more daily JSON samples from real source-reviewed topics
- Add a short case-study link from README and About page
- Improve source-quality and overclaiming checks in the content workflow
- Prepare a LinkedIn / Notion portfolio summary using this case study

### Later

- Add optional newsletter or LinkedIn carousel reuse format
- Add stronger schema validation
- Consider a lightweight editorial dashboard only if manual JSON editing becomes a bottleneck
- Explore semi-automated source collection and summarization with explicit human approval

## 10. Portfolio Summary

AI PM Radar is a low-cost static AI PM portfolio project that demonstrates how to turn noisy AI and business updates into a structured, risk-aware information product. It shows product strategy, content system design, technical feasibility, verification discipline, and clear trade-off reasoning suitable for AI PM interviews.
