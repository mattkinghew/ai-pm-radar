# AI Agent Task Queue

This file is the controlled task queue for AI-assisted project work.

## Safety Rules

- One task at a time.
- Tasks must be reviewed before execution.
- Tasks must be approved before run mode.
- The executor must not delete files.
- The executor must not run destructive git commands.
- The executor must not auto-commit or auto-push.
- Validation must pass before any manual commit.

## Task Format

Use this format for future tasks:

- id: TASK-XXX
  title: Short task title
  type: docs | safety | build | test | refactor
  priority: high | medium | low
  status: pending | approved | running | done | blocked
  scope: ai-pm-radar
  risk: low | medium | high
  approval_required: true
  input: |
    Detailed instruction for the agent.
  validation:
    - npm run validate:data
    - npm run validate:daily
    - npm run build

## Pending Tasks

- id: TASK-001
  title: Verify Level 3 safety executor
  type: safety
  priority: high
  status: pending
  scope: ai-pm-radar
  risk: low
  approval_required: true
  input: |
    Verify that the Level 3 executor can read the queue, require approval,
    write audit logs, and run validation checks without modifying project code.
  validation:
    - npm run validate:data
    - npm run validate:daily
    - npm run build

- id: TASK-002
  title: Add 2026-07-02 daily radar sample
  type: docs
  priority: high
  status: pending
  scope: ai-pm-radar
  risk: low
  approval_required: true
  input: |
    Add a new daily JSON file for 2026-07-02 with 5 to 6 AI PM radar entries.
    The entries should be relevant to AI product management, AI tools, NGO/education use cases,
    SME operations, and practical AI adoption risks.
    Keep source_url, source_name, business_angle, ai_pm_angle, and risk_note complete.
  validation:
    - npm run validate:data
    - npm run validate:daily
    - npm run build

- id: TASK-003
  title: Add daily content generation SOP
  type: docs
  priority: high
  status: pending
  scope: ai-pm-radar
  risk: low
  approval_required: true
  input: |
    Add a reusable daily content generation SOP for AI PM Radar.
    The SOP should explain how to collect sources, generate daily JSON,
    review quality, run validation, and commit updates safely through the
    Level 3 agent workflow.
  validation:
    - npm run validate:data
    - npm run validate:daily
    - npm run build

- id: TASK-004
  title: Add daily update operator prompt
  type: docs
  priority: high
  status: pending
  scope: ai-pm-radar
  risk: low
  approval_required: true
  input: |
    Add a reusable daily update operator prompt template.
    The prompt should let the user paste candidate sources and receive a safe,
    structured update plan for creating data/daily/YYYY-MM-DD.json, reviewing it,
    running the Level 3 validation gate, and committing only relevant files.
  validation:
    - npm run validate:data
    - npm run validate:daily
    - npm run build

## Safety Constraint

The agent MUST NOT:

- delete files outside scope
- modify system config
- execute network installs
- run infinite loops
- auto-commit
- auto-push
- auto-rollback
