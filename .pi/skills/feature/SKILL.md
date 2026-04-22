---
name: feature
description: Project-local `task` workflow for feature specs in the task CLI repo. Extends the packaged feature skill with repo-local issue documents, commands, and handoffs.
---

# Feature — task repo local override

This repo overrides the packaged `feature` skill for the task repo.

Read these before acting:
1. `../../../skills/feature/SKILL.md`
2. `../task/SKILL.md`
3. `../../task-workflow.md`
4. `../../../AGENTS.md`
5. `../../../doc/commands.md`
6. `../../../doc/project-management.md`

Apply the packaged base skill as the base workflow. The rules below replace generic
issue-storage and handoff instructions.

## Local workflow contract

- Always run in issue-backed mode.
- Use `bun task.ts` from the repo root.
- Reuse the current issue when one is already in play; otherwise create one with label `prd`.
- Persist the PRD at `research/prd`.
- Persist the approved implementation handoff at `research/plan`.
- Inspect existing research with `bun task.ts show --id <id> --include-keys` and `bun task.ts get --id <id> --key research/`.
- Write artifacts with:
  - `bun task.ts set --id <id> --key research/prd --file /tmp/prd.md`
  - `bun task.ts set --id <id> --key research/plan --file /tmp/plan.md`
- Do not claim completion until both writes succeed.
- End with exactly: `Next: /skill:taskify <id> --from plan`

## Local issue creation

Use:

```bash
bun task.ts create --title "<feature name>" --label prd
```

## Local artifact naming

- spec draft / approved spec: `research/prd`
- approved coding handoff: `research/plan`

Keep historical supporting notes under other `research/...` paths when needed,
but `research/plan` is the canonical implementation handoff.
