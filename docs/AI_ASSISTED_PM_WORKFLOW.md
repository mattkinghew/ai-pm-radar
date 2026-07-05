# AI-Assisted Project Management Workflow

## Purpose

This document explains how AI-assisted tools can support project coordination, documentation, UAT follow-up, and stakeholder reporting without replacing human judgment.

It is designed to support job applications for:

- IT Project Coordinator
- Assistant Project Manager
- AI Project Coordinator
- Digital Transformation Analyst
- AI Product / Project Manager

## Core Principle

AI should be used to speed up routine project work, but the Project Manager or Project Coordinator should remain responsible for accuracy, privacy, stakeholder alignment, and final decisions.

The workflow follows a human-in-the-loop approach:

```text
Project input → AI-assisted draft / classification → Human review → Stakeholder-ready output
```

## Target Project Management Use Cases

| Use Case | Input | AI-Assisted Output | Human Review Needed |
|---|---|---|---|
| Meeting follow-up | Meeting notes / transcript | Action items, owners, deadlines, risks | Confirm accuracy and remove sensitive data |
| UAT coordination | User feedback, bug comments | Issue categories, priority suggestion, summary | Confirm severity and technical validity |
| Weekly status report | Task list, issue log, milestones | Green / Amber / Red summary and next actions | Confirm project status and wording |
| Requirement clarification | User requests, client messages | Draft requirement statement and open questions | Confirm scope with stakeholders |
| Risk register update | Blockers, delays, constraints | Risk description and mitigation options | Confirm risk impact and owner |
| Vendor follow-up | Email thread, RFP comments | Follow-up email draft and clarification list | Confirm commercial and technical details |
| Documentation | Raw notes, acceptance criteria | Structured PM documentation draft | Check completeness and tone |

## Example Workflow: Meeting Notes to Action Tracker

### Step 1: Input

Raw meeting notes are collected from Teams, Zoom, Google Meet, email, or manual notes.

Example input:

```text
Client wants archive filter improved before demo.
Developer says mobile layout needs one more check.
PM needs to confirm whether automated crawling is in scope.
Next demo expected next Friday.
```

### Step 2: AI-Assisted Processing

| Action Item | Owner | Priority | Due Date | Notes |
|---|---|---|---|---|
| Improve archive filter explanation | Developer / PM | Medium | Before demo | Confirm expected filter behavior |
| Check mobile layout | Developer / QA | High | Before demo | Test common mobile viewport |
| Confirm automation scope | PM | High | Before next stakeholder update | Avoid misunderstanding current MVP |
| Prepare next demo | PM | Medium | Next Friday | Include known limitations |

### Step 3: Human Review

The PM / Coordinator checks:

- Are owners correct?
- Are deadlines realistic?
- Are sensitive details removed?
- Are assumptions clearly marked?
- Are next steps aligned with stakeholder expectations?

### Step 4: Output

Final version can be transferred into:

- Excel tracker
- Jira / Trello
- Notion
- Google Sheets
- project status report
- follow-up email

## Example Workflow: UAT Feedback to Issue Log

### Input

```text
User says article page sometimes looks too text-heavy.
Archive filter works but category labels may not be obvious.
External source link opens correctly.
One daily JSON file is missing risk note.
```

### AI-Assisted Categorization

| Issue | Category | Suggested Severity | Suggested Owner | Next Action |
|---|---|---|---|---|
| Article page text-heavy | UX / Content | Medium | PM / Designer | Review layout and summary length |
| Category labels unclear | UX / IA | Medium | PM | Improve label wording or add helper text |
| Source link works | Passed test | Low | QA | Mark UAT case as passed |
| Missing risk note | Data quality | High | Content reviewer | Fix JSON and rerun validation |

### Human Review

AI may suggest severity, but the PM should confirm actual impact before assigning priority.

## Example Workflow: Weekly Status Report Draft

### Input

- Completed: README updated, case study added, validation script passed
- In progress: UAT docs, project status report, screenshot checklist
- Risks: too few real content samples, automation scope may be misunderstood
- Next: add 3 daily JSON samples, prepare interview pitch

### AI-Assisted Output

> Overall status: Amber / Green. Core MVP and documentation baseline are complete. Current work focuses on strengthening UAT evidence and adding more content samples for portfolio presentation. Main risks are limited real content examples and possible confusion between current MVP scope and future automation roadmap. Next steps are to add reviewed daily JSON samples, update README links, and prepare interview-ready talking points.

### Human Review

The PM checks whether the wording is accurate and whether the status should be Green, Amber, or Red.

## Suggested Tool Stack

| Need | Possible Tools | Notes |
|---|---|---|
| Meeting summary | ChatGPT, Gemini, Copilot | Use sanitized notes only |
| Task tracking | Excel, Google Sheets, Notion, Trello, Jira | Choose based on team maturity |
| UAT issue log | Excel, Google Sheets, Jira | Keep fields simple and consistent |
| Workflow automation | Make.com, n8n, Zapier | Start with low-risk internal workflow |
| Knowledge capture | Notion, Obsidian, Google Drive | Separate public portfolio from private notes |
| AI prototype | Dify, PartyRock, lightweight Next.js app | Use human review for generated output |

## Privacy and Governance Rules

Before using AI-assisted tools in project management:

- do not paste API keys, passwords, credentials, or private tokens
- remove client names if not necessary
- anonymize personal data
- avoid uploading confidential contracts or internal documents
- check organization policy on generative AI use
- keep human approval before sending external communications
- log major decisions outside the AI chat
- avoid using AI output as final truth without review

## How This Relates to AI PM Radar

AI PM Radar already uses a similar principle:

- structured content model
- source-aware summaries
- risk notes
- validation before publishing
- human-in-the-loop review
- scoped MVP before heavier automation

The same thinking can be transferred to IT project coordination:

| AI PM Radar Practice | PM / Assistant PM Equivalent |
|---|---|
| Daily JSON validation | UAT / data quality check |
| Source URL required | Evidence-based reporting |
| Risk note per article | Risk register habit |
| Static MVP scope | Scope control |
| Prompt-assisted workflow | AI-assisted documentation |
| Human review | Governance and quality control |
| Case study documentation | Stakeholder reporting |

## Interview Talking Points

This workflow can be explained in interviews as:

> I use AI-assisted tools to improve project coordination efficiency, especially for documentation, meeting summaries, UAT issue classification, and weekly status reporting. However, I do not treat AI output as final. I use a human-in-the-loop process to check accuracy, remove sensitive information, confirm priorities, and align with stakeholder expectations.

## Minimal Implementation Plan

For a real team, I would start with a low-risk workflow:

1. collect sanitized meeting notes
2. use AI to extract action items and risks
3. review manually
4. paste approved items into Excel / Jira / Notion
5. use a weekly template to generate a draft status report
6. keep final approval with the PM

This avoids over-automation while still improving speed, consistency, and documentation quality.
