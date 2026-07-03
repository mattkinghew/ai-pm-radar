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

## Safety Constraint

The agent MUST NOT:

- delete files outside scope
- modify system config
- execute network installs
- run infinite loops
- auto-commit
- auto-push
- auto-rollback
