# Next Daily Update Playbook

## Purpose

This is the 5-minute operating checklist for publishing the next AI PM Radar daily update.

Use this when you want to add one new daily file:

```text
data/daily/YYYY-MM-DD.json
```

## 0. Before Starting

Confirm the repository is clean:

```bash
git status -sb
```

Expected:

```text
## main...origin/main
```

If there are existing changes, review them before starting a new daily update.

## 1. Collect Candidate Sources

Collect 5 to 10 candidate sources.

Prioritize:

- AI PM / product management lessons
- AI tools and model updates
- SME AI workflow adoption
- NGO / education AI use cases
- Hong Kong technology or AI job market signals
- free learning resources and certifications
- AI governance, security, and evaluation guidance

For each source, record:

```text
Title:
Source name:
Source URL:
Published time:
Key points:
Why it may matter:
Risk / limitation:
```

## 2. Use the Daily Operator Prompt

Open:

```text
prompts/daily_update_operator.md
```

Fill in:

```text
Date: YYYY-MM-DD
Task ID: TASK-XXX
Candidate sources:
...
```

The operator prompt should produce:

1. source selection
2. daily JSON draft
3. review checklist
4. local execution plan

## 3. Review the JSON Draft

Before saving the JSON, check:

- every entry has `source_name`
- every entry has `source_url`
- every entry has `published_at`
- `summary` is source-aware and not overclaiming
- `business_angle` is practical
- `ai_pm_angle` is product / evaluation / rollout focused
- `risk_note` is specific
- scores are integers from 1 to 10
- categories are stable
- tags are short and useful

Use:

```text
prompts/content_reviewer.md
```

for a second-pass review.

## 4. Save the JSON File

Create:

```text
data/daily/YYYY-MM-DD.json
```

Do not overwrite existing daily files unless fixing a verified mistake.

## 5. Add or Confirm Queue Task

Open:

```text
ai-agent/QUEUE.md
```

Add a task like:

```text
- id: TASK-XXX
  title: Add YYYY-MM-DD daily radar sample
  type: docs
  priority: high
  status: pending
  scope: ai-pm-radar
  risk: low
  approval_required: true
  input: |
    Add data/daily/YYYY-MM-DD.json with 5 to 6 AI PM Radar entries.
  validation:
    - npm run validate:data
    - npm run validate:daily
    - npm run build
```

## 6. Run Agent Validation Gate

Approve the task:

```bash
npm run agent:approve -- TASK-XXX
```

Run the validation gate:

```bash
npm run agent:run -- TASK-XXX
```

The gate should run:

```bash
npm run validate:data
npm run validate:daily
npm run build
```

## 7. Review Git Diff

Check status:

```bash
git status -sb
```

Inspect changes:

```bash
git diff
```

Expected changed files usually include:

```text
ai-agent/QUEUE.md
ai-agent/state.json
data/daily/YYYY-MM-DD.json
```

Do not commit unrelated files.

## 8. Commit and Push

Use precise add:

```bash
git add ai-agent/QUEUE.md ai-agent/state.json data/daily/YYYY-MM-DD.json
```

Commit:

```bash
git commit -m "data: add YYYY-MM-DD radar sample"
```

Push:

```bash
git push origin main
```

Confirm clean state:

```bash
git status -sb
git log --oneline -5
```

## 9. Common Mistakes and Recovery

### Mistake: Edited the wrong path

Wrong:

```text
docs/ai-agent/QUEUE.md
```

Correct:

```text
ai-agent/QUEUE.md
```

### Mistake: Task not found

Run:

```bash
npm run agent:status
```

Then confirm the task exists in:

```text
ai-agent/QUEUE.md
```

### Mistake: JSON validation fails

Run:

```bash
npm run validate:daily
```

Fix the reported field, comma, score, or missing URL.

### Mistake: Accidentally changed an unrelated file

Check:

```bash
git diff path/to/file
```

Restore only that file if it is truly accidental:

```bash
git restore path/to/file
```

Avoid:

```bash
git reset --hard
```

unless you fully understand the consequence.

## Definition of Done

A daily update is done when:

- new `data/daily/YYYY-MM-DD.json` exists
- `npm run agent:run -- TASK-XXX` passes
- `npm run build` passes
- only relevant files are committed
- `git status -sb` is clean
- GitHub `origin/main` has the new commit
