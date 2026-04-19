# Task

Bun/TypeScript CLI for managing local agent issues in the filesystem. The root project is the `task` CLI; this file is a compact index into `doc/` for working on that codebase.

## Quick shortcuts

- Repo layout and command/data flow: [doc/architecture.md](doc/architecture.md)
- How to run and use the CLI safely: [doc/commands.md](doc/commands.md)
- Issue fields, phases, refs, labels, and stores: [doc/project-management.md](doc/project-management.md)
- Full-project verification before finishing work: [doc/testing.md](doc/testing.md)
- Correctness rules for new and modified code: [doc/code-style.md](doc/code-style.md)

## Correctness policy

For root `task` CLI work, apply this priority order:

1. correctness
2. soundness and explicitness
3. boundary validation and architectural integrity
4. maintainability and local reasoning
5. ergonomics

Ergonomics is not a valid justification for unsoundness. Unsafe constructs are acceptable only for true TypeScript limitations or true runtime boundaries; anything that remains must be minimized, isolated, documented, and justified. Compiler, lint, boundary, and dependency rules must not be weakened without explicit approval. Apply the same strictness to tests unless it is explicitly waived. See [doc/code-style.md](doc/code-style.md) for the durable implementation rules.

## Gotchas

- Run `bun test` and `bun run typecheck` for the entire project; passing only changed files is not enough.
- Broken windows principle: pre-existing test, typecheck, warning, or quality issues are problems to fix, not noise to ignore.
- `packages/esther/` is a separate nested project with its own docs; do not treat it as part of the root `task` CLI.
- Never modify `packages/esther/` when working on the root `task` CLI unless the user explicitly asks for Esther work.
- Flags must use `--flag value`, not `--flag=value`.
- `task meta set` writes raw strings; be careful with structured fields, especially `priority`.
- Ask rather than guess when requirements or workflow expectations are ambiguous.

## Docs TOC

- [doc/architecture.md](doc/architecture.md) — Open first when changing repo layout, issue storage, command dispatch, output contracts, or anything touching `~/.local/share/issues`.
- [doc/commands.md](doc/commands.md) — Open when you need the exact CLI grammar, command families, output modes, or command-specific traps.
- [doc/project-management.md](doc/project-management.md) — Open when deciding how work should be represented in issue metadata, phases, refs, labels, priorities, or stores.
- [doc/testing.md](doc/testing.md) — Open when changing behavior and deciding what to test, which test file to edit, and what must pass before finishing.
- [doc/code-style.md](doc/code-style.md) — Open when writing or reviewing code to apply the repo's correctness-first policy and unsafe-construct rules.
