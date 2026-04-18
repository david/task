# Code style

Use this doc for durable implementation rules for the root `task` CLI.

## Priority order

1. correctness
2. soundness and explicitness
3. boundary validation and architectural integrity
4. maintainability and local reasoning
5. ergonomics

If these goals conflict, sacrifice ergonomics first.

## Core rules

- Treat argv, stdin, filesystem contents, and JSON reads as untrusted input.
- Prefer explicit parsing and validation over clever shortcuts.
- Do not weaken compiler checks or add lint suppressions without explicit approval.
- Apply the same strictness to tests.
- Prefer small helpers with obvious data flow over abstractions that hide behavior.

## Unsafe construct policy

Casts, unsafe typing, and schema shortcuts are defects unless they are demonstrably unavoidable because of:

1. a real TypeScript limitation, or
2. a real runtime boundary.

When one remains, minimize it, isolate it, validate immediately where possible, and document why it exists.

Classify each remaining unsafe construct as:

1. unavoidable TypeScript limitation
2. runtime boundary
3. architectural debt
4. unjustified shortcut

Default to category 4 unless you can justify otherwise.

## CLI-specific conventions

- Treat `packages/esther/` as off-limits during root `task` CLI work unless the user explicitly asks for Esther changes.
- Keep `task.ts` focused on parsing, dispatch, help text, and output formatting.
- Keep command behavior and storage logic in `commands.ts`.
- Return JSON-compatible data structures from command handlers.
- Emit explicit, user-actionable errors rather than vague failures.
- Preserve machine-readable stdout/stderr contracts when changing CLI behavior.

## Data-handling conventions

- Prefer dedicated command paths over generic metadata mutation when the data has structure.
- Preserve the meaning of standard fields like `status`, `phase`, `priority`, `refs`, and `labels`.
- Do not bypass path-safety checks for stores.
- Avoid silent type drift in `issue.json`; a field that is numeric by convention should stay numeric unless the design intentionally changes.

## Tests and new code

For new and modified code, document and enforce the stricter standard even if older code is looser. Legacy exceptions are not permission to extend the pattern.
