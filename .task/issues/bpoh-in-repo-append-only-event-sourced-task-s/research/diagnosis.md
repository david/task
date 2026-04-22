## Observed failure

QA task `qa-06-closed-issues-stay-queryable-and-projections-rebuild` failed before the rebuild step.

- Expected: `bun /home/david/task-w0/src/task.ts search --all "rebuild child"` should return the closed child issue.
- Actual: the command exited with `{"error":"search query is required (pass positional text or --text)"}`.
- Repro from QA artifact: in `/tmp/task-qa-06-lfiy9gvc`, run `search --all "rebuild child"` after closing `zz3k-rebuild-child`.
- Control: `search "rebuild child" --all` succeeds in the same repo.

## Root cause

This is a generic CLI parser bug, not a search-index or rebuild bug.

1. `parseFlags()` in `src/task.ts:24-56` treats **every** flag as if it may consume the following non-flag token as that flag's value.
2. The specific bug is at `src/task.ts:43-44`:
   - `const next = argv[i + 1]`
   - `const value = next !== undefined && !next.startsWith("--") ? next : "true"`
3. Because `--all` is a presence-only switch, `search --all "rebuild child"` should leave `"rebuild child"` as positional query text. Instead, the parser stores it as the value of `--all` and removes it from `args._`.
4. `issueSearch()` in `src/commands.ts:210-215` then sees no positional query and no `--text`, so it throws `search query is required...`.

The underlying design problem is that command metadata does not encode whether a flag is a switch or requires a value:

- `FlagDef` in `src/types.ts:12-16` has only description/required/default metadata.
- `parseFlags()` is called generically from `src/task.ts:217` with no per-command arity information.

So the parser cannot distinguish `--all`, `--summary`, `--jsonl`, `--compact`, `--full`, etc. from value-taking flags.

I confirmed the bug is broader than `search`: for example `task show --summary <id>` also fails because `--summary` consumes the positional issue id.

## Proposed fix

Make flag arity explicit and let parsing use it.

Minimal correct fix:

1. Extend command flag metadata (for example in `src/types.ts` / `src/commands-registry.ts`) so each flag declares whether it is a presence-only switch or takes a value.
2. Change `parseFlags()` to accept the resolved command metadata and only consume the next argv token for flags that actually take values.
3. Keep positional arguments intact after switch flags, so these forms work consistently:
   - `task search --all "rebuild child"`
   - `task show --summary <id>`
   - `task children --all <parent-id>`
4. Preserve current repeated-value behavior for value flags like `--where`, `--label`, `--add`, and `--remove`.

This is the minimal correct fix because the bug is in the shared argv parser, and a search-only patch would leave the same failure mode in other commands.

## Why this was undetected

**Detection gap category:** Logic bug.

The parser logic is wrong for switch flags, and current tests do not cover the mixed-order cases that expose it.

Specifically:

- `src/task.test.ts` verifies `--all` only in isolation and positional query parsing only with the positional text before flags.
- Search tests in `src/commands-basic.test.ts` call `issueSearch()` directly, so they bypass the CLI argv parser entirely.
- QA task 06 is the first check that exercised a real shell command with a switch flag before positional query text.

## Verification contract

### Reproduction setup

Use the QA repo from the artifact or any fresh temp repo with one closed issue whose title matches the search query.

Canonical repro:

```bash
export TASK_CLI="bun /home/david/task-w0/src/task.ts"
REPO=$(mktemp -d)
cd "$REPO"
git init -q
CHILD_JSON=$($TASK_CLI create --title "Rebuild Child")
CHILD_ID=$(echo "$CHILD_JSON" | jq -r '.id')
$TASK_CLI close "$CHILD_ID"
$TASK_CLI search --all "rebuild child"
```

### User-observable fix proof

After the fix:

- `task search --all "rebuild child"` returns the closed issue instead of the missing-query error.
- `task show --summary <id>` also succeeds, proving the parser no longer steals positional args after switch flags.

### Automated proof

Add both of these:

1. **Regression test for the reported symptom**
   - In `src/task.test.ts`, add parser coverage showing that a switch flag before positional text preserves both:
     - `parseFlags(["--all", "rebuild", "child"])` keeps `--all: "true"` and `_: ["rebuild", "child"]`.
2. **Detection-gap test for the broader parser contract**
   - Add a second parser/normalization test covering a positional-id command with a switch first, e.g. `show --summary ab12`, so presence-only flags before a positional id remain valid.

Before landing, the normal project gates still need to pass:

```bash
bun test
bun run typecheck
```

### Fast recheck

During implementation, the cheapest reliable rerun is:

```bash
bun test src/task.test.ts
```

Then rerun the failed QA flow:

```bash
bun /home/david/task-w0/src/task.ts search --all "rebuild child"
```

## Risk

- Parser changes affect every CLI command, so an incorrect arity table could break value-taking flags or repeated flags.
- The fix must not regress existing forms like `task search --text "packet session"`, `task list --where ... --where ...`, or positional-id normalization.
- Because the bug is shared, a narrow search-only patch would leave inconsistent behavior elsewhere.