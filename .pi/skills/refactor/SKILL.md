---
name: refactor
description: Project-local `task` workflow for behavior-preserving refactor plans in the task CLI repo. Extends the packaged refactor skill with repo-local issue documents and handoffs.
---

# Refactor — task repo local override

This repo overrides the packaged `refactor` skill for the task repo.

Read these before acting:
1. `../../../skills/refactor/SKILL.md`
2. `../task/SKILL.md`
3. `../../task-workflow.md`
4. `../../../AGENTS.md`
5. `../../../doc/commands.md`
6. `../../../doc/project-management.md`

Apply the packaged base skill as the base workflow. The rules below replace generic
issue-storage and handoff instructions.

## Local workflow contract

- Always use workflow mode.
- Use `bun task.ts` from the repo root.
- Reuse the active issue when present; otherwise create one with label `refactor`.
- Persist the planning artifact at `research/refactor-plan`.
- Persist the approved coding handoff at `research/plan`.
- Inspect current research with `bun task.ts show --id <id> --include-keys` and `bun task.ts get --id <id> --key research/`.
- Write artifacts with:
  - `bun task.ts set --id <id> --key research/refactor-plan --file /tmp/refactor-plan.md`
  - `bun task.ts set --id <id> --key research/plan --file /tmp/plan.md`
- End with exactly: `Next: /skill:taskify <id> --from plan`

## Local issue creation

```bash
bun task.ts create --title "<refactor description>" --label refactor
```
