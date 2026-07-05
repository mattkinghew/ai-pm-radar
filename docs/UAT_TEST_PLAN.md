# UAT Test Plan

## Purpose

This document demonstrates how AI PM Radar can be reviewed from an IT Project Coordinator / Assistant Project Manager perspective.

The focus is project delivery discipline: requirement clarification, UAT planning, issue tracking, acceptance criteria, quality checks, and stakeholder-ready reporting.

## Project Context

AI PM Radar is a static AI product management radar built with Next.js, TypeScript, local JSON content files, validation scripts, and static deployment.

The MVP is suitable for demonstrating:

- user requirement clarification
- MVP scope control
- static website delivery
- JSON data validation
- UAT coordination
- defect reporting
- deployment readiness checks
- AI-assisted content workflow review

## UAT Scope

### In Scope

- Home page content display
- Archive page category filtering
- Article detail page routing
- External source link behavior
- Daily JSON data validation
- Mobile layout sanity check
- Basic accessibility and readability check
- Disclaimer and risk note visibility
- Build and static export verification

### Out of Scope

- User login
- Database testing
- Payment flow testing
- CMS workflow testing
- Automated news crawling
- Real-time personalization
- Backend API performance testing

These areas are intentionally out of scope because they are not part of the current MVP.

## UAT Roles

| Role | Responsibility |
|---|---|
| Product Owner / PM | Confirm business goal, scope, acceptance criteria, and go-live readiness |
| Tester / Project Coordinator | Execute test cases, record results, capture issues, prepare UAT summary |
| Developer | Fix confirmed issues and explain technical constraints |
| Reviewer / Stakeholder | Review whether output is understandable and useful for target users |

## Acceptance Criteria

The MVP is ready for portfolio presentation when:

- latest daily content can be loaded on the Home page
- archive page can display previous entries
- article detail pages open correctly
- invalid or incomplete JSON data is caught before build or deployment
- external links open safely in a new tab
- mobile viewport does not show major layout breakage
- disclaimer and source links are visible
- `npm run build` passes
- static export can be generated successfully
- project documentation explains scope, risks, non-goals, and roadmap

## UAT Test Cases

| Test Case ID | Feature | Scenario | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|---|
| UAT-001 | Home page | User opens the latest AI PM Radar | Open the live demo or local server home page | Latest daily radar entries are displayed clearly | High | Ready |
| UAT-002 | Daily JSON loading | Home page reads latest content file | Check latest file under `data/daily/` and load home page | Home page reflects the latest available daily JSON file | High | Ready |
| UAT-003 | Article card | User scans Top 5 content | Review title, summary, category, source and risk note | Card presents useful summary without overloading the user | High | Ready |
| UAT-004 | Article detail page | User opens one article | Click an article card or direct article link | Correct article detail page opens without routing error | High | Ready |
| UAT-005 | Archive page | User browses previous records | Open Archive page | All available daily entries are listed | Medium | Ready |
| UAT-006 | Category filter | User filters by topic | Select a category filter on Archive page | Matching articles remain visible; unrelated articles are hidden | Medium | Ready |
| UAT-007 | Card expansion | User wants more context | Expand archive card details | Additional product / risk context is shown clearly | Medium | Ready |
| UAT-008 | External source link | User checks source | Click source URL from article page or card | Link opens in a new tab with safe link behavior | High | Ready |
| UAT-009 | Disclaimer visibility | User checks limitation | Review footer and article content | Disclaimer is visible and does not overclaim advice | High | Ready |
| UAT-010 | Invalid JSON prevention | PM validates data before release | Run daily data validation script | Invalid or malformed daily JSON should fail validation | High | Ready |
| UAT-011 | Static build | PM checks deployment readiness | Run `npm run build` | Build completes without blocking errors | High | Ready |
| UAT-012 | Static export | PM checks low-cost hosting readiness | Confirm static export output | Static output is generated for hosting platform deployment | High | Ready |
| UAT-013 | Mobile sanity check | Mobile user opens the site | Test around 390px width or mobile browser | No major horizontal overflow or broken layout | Medium | Ready |
| UAT-014 | Content quality | Reviewer checks AI summary | Review summary, source, why it matters and risk note | Content is source-aware, practical and not misleading | High | Ready |
| UAT-015 | Portfolio documentation | Hiring manager reviews repo | Open README and case study | Project scope, value, tech stack and verification are understandable | High | Ready |

## Sample Issue Log

| Issue ID | Date | Area | Description | Severity | Owner | Status | Next Action |
|---|---|---|---|---|---|---|---|
| ISSUE-001 | 2026-07-03 | Documentation | Need clearer link from README to UAT evidence | Low | PM | Open | Add portfolio evidence section |
| ISSUE-002 | 2026-07-03 | Content workflow | Need more real daily JSON examples for stronger portfolio evidence | Medium | PM | Open | Add 2 to 3 reviewed daily samples |
| ISSUE-003 | 2026-07-03 | Product roadmap | Future automation scope may be misunderstood as current feature | Medium | PM | Open | Keep roadmap and current scope clearly separated |

## UAT Summary Template

| Field | Example |
|---|---|
| Project | AI PM Radar |
| UAT Cycle | Portfolio readiness check |
| Testing Period | YYYY-MM-DD to YYYY-MM-DD |
| Overall Status | Green / Amber / Red |
| Total Test Cases | 15 |
| Passed | To be updated after execution |
| Failed | To be updated after execution |
| Blockers | None / list blockers |
| Key Risks | Data quality, source quality, over-automation risk |
| Go-live Recommendation | Ready / Ready with minor fixes / Not ready |

## Notes for Interview Discussion

This UAT plan can be used to explain how a non-CS project manager can still support IT delivery effectively:

- clarify scope and acceptance criteria
- translate user expectations into testable cases
- coordinate UAT feedback between users and developers
- track defects and risks
- document verification evidence before release
- use AI tools to improve documentation speed while keeping human review
