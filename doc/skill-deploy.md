# Local rules for `/skill:deploy`

## Local readiness evidence

When an issue is available, inspect durable workflow evidence through document
paths, not store commands:
- `check-report/latest`
- `check-report/`
- `tasks/`
- `task-status/`
- `qa-results/`
- `qa-context/`

Use `bun task.ts get --id <id> --key <path-or-subtree>` and `bun task.ts show --id <id> --include-keys`.

## Local verification expectations

- A latest passing `check-report` is required for a clean automated-readiness pass.
- Missing or failed QA evidence is not a silent pass.
- If this repo later adds `doc/deployment.md`, treat it as the authoritative project-specific shipping guide.

## Local write policy

- Keep deploy read-only with respect to issue documents.
- Do not mutate workflow artifacts from this skill.
