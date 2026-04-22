# Local rules for `/skill:feature`

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

```bash
bun task.ts create --title "<feature name>" --label prd
```
