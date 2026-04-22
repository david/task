---
name: deploy
description: >
  Full shipping workflow. Runs pre-merge ship-readiness checks, pushes the
  current branch, opens or reuses a PR, watches required CI, merges only after
  checks pass, then monitors the project's deployment target and reports success
  or failure. Use after /skill:check and /skill:qa.
---

# Deploy — Ship Branch and Watch Deployment

Run the end-to-end shipping flow for the current branch: validate readiness,
push and open or reuse a PR, wait for CI, merge on green, then watch the
deployment target and report the outcome.

If `doc/task-workflow.md` exists, read it before acting.
If `doc/skill-deploy.md` exists, read it before acting.

Treat repo docs as project-specific extensions of this skill.

## Project-specific deployment guidance

If `doc/deployment.md` exists in the repo, read it before doing anything else.
Also read deploy-specific sections of `AGENTS.md`, `CLAUDE.md`, or equivalent
repo docs when they exist.

Use project docs to identify:
- the shipping workflow
- required CI checks or merge policy
- deployment targets and monitoring commands
- any project-specific failure follow-up steps

## When to run

After `/skill:check` has passed and QA is complete or intentionally skipped.

## Readiness checks

Run these first:
1. clean working tree
2. rebase or sync with the latest mainline per project policy
3. migrations or deploy-affecting changes
4. automated confirmation and QA evidence
5. doc freshness
6. diff size / review context

If an issue or work item is available, read the durable workflow artifacts as
the source of truth for check/QA readiness. In the standard task-backed
workflow, this means:
- `check-report/latest`
- `check-report/*`
- `tasks/*`
- `task-status/*`
- `qa-results/*`
- `qa-context/*`

Otherwise ask the user.

## Shipping steps

If readiness is GO:
1. push the branch and ensure a PR exists
2. watch required CI checks
3. merge only after required checks pass
4. monitor the deployment target using project-documented commands
5. report `DEPLOYED`, `NO-GO`, or `WARN`

## Rules

- Keep intentional QA skips visible.
- Do not silently treat missing QA evidence as a pass.
- Do not merge while required CI is pending or failing.
- After merge, inspect deployment status whenever the project documents a way to
  do so.
- Keep this skill read-only with respect to task-backed workflow artifacts unless the
  project explicitly requires a deploy log.
