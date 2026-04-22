---
name: setup-task-project
description: Scaffold a repo-local `doc/task-workflow.md` so a project can use the packaged task, feature, debug, refactor, code, commit, check, taskify, and deploy skills from this package without local `.pi/skills` overrides.
---

# Setup Task Project

Scaffold the project docs that let another repo use the packaged workflow skills
from this package directly.

Use this after the package is already available in the target project.

## What this creates

By default, this skill scaffolds:

- `doc/task-workflow.md`

The packaged skills consult `doc/task-workflow.md` as the shared workflow
reference and may also read project-native docs when those files exist, for
example:

- `doc/planning.md`
- `doc/debugging.md`
- `doc/refactoring.md`
- `doc/coding.md`
- `doc/committing.md`
- `doc/testing.md`
- `doc/decomposition.md`
- `doc/deployment.md`

## Default behavior

1. Treat the current working directory as the target repo unless the user gives
   an explicit target path.
2. Run `task bootstrap` to scaffold `doc/task-workflow.md`.
3. Do **not** overwrite existing files unless the user explicitly asks to
   refresh or replace them.
4. Read the generated files back and summarize what still needs manual review.

## Command

Run:

```bash
task bootstrap
```

Target another repo explicitly when needed:

```bash
task bootstrap --root <target-repo>
```

Overwrite existing scaffold files only with explicit approval:

```bash
task bootstrap --force
```

## What to verify after scaffolding

Read back at least:

- `doc/task-workflow.md`
- any existing project-native workflow docs such as `doc/coding.md`, `doc/committing.md`, `doc/testing.md`, or `doc/deployment.md`

Confirm:

- the detected repo commands are correct
- the generated artifact paths and handoffs match the repo's intended workflow
- any repo docs referenced by the new docs actually exist or are clearly optional

## Reporting

Report only:
- target repo
- files created vs skipped
- detected verification commands
- any manual TODOs

## Rules

- Default to non-destructive scaffolding.
- Use `--force` only with explicit user approval.
- If command detection is uncertain, scaffold the docs anyway and clearly mark the TODO in your report.
- Do not invent extra repo docs unless the user asks for them.
