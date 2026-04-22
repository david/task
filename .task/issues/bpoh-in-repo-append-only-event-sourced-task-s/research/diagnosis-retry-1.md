## Root cause

QA task `qa-06-closed-issues-stay-queryable-and-projections-rebuild` failed before the rebuild step because the shared CLI argv parser treated every flag as if it might take a value.

In the parser introduced by `2fe0aa63` (`refactor(task): stage in-repo rewrite under src`), `src/task.ts:14-21` used the next non-flag token as the value for any `--flag`:

- `const next = argv[i + 1]`
- `if (next && !next.startsWith("--")) { value = next; i++ } else { value = "true" }`

That meant `task search --all "rebuild child"` was parsed as `{"--all": "rebuild child"}` with no positional query left in `args._`. `issueSearch()` in `src/commands.ts:211-217` then saw neither positional text nor `--text` and threw `search query is required (pass positional text or --text)`.

This was a shared parser bug, not a search-index or projection-rebuild bug. The same mechanism also broke other switch-plus-positional forms such as `task show --summary <id>`.

I also checked the current tree: the exact QA repro no longer fails on HEAD. Commit `de5d7cfa` (`fix(task): harden event-sourced cli parsing and checks`) already changes `src/task.ts` so `parseFlags()` consults flag definitions, distinguishes `switch` vs `value`, and preserves positional args after switch flags.

## Regression history

- **Introduced:** `2fe0aa63` (`refactor(task): stage in-repo rewrite under src`)
  - Added the new shared parser in `src/task.ts`.
  - The parser had no flag-arity metadata, so every flag consumed the next non-flag token.
- **Observed in QA:** stored artifact `qa-results:qa-06-closed-issues-stay-queryable-and-projections-rebuild` recorded `search --all "rebuild child"` failing with the missing-query error while `search "rebuild child" --all` succeeded.
- **Current branch state:** `de5d7cfa` already contains the expected fix direction by making flag arity explicit and adding parser coverage.

So this failure is best understood as a regression introduced during the repo-local CLI rewrite and already addressed on the current branch, even though the issue metadata was still left in `qa-failed`.

## Prior issue history

I searched local task history (`task search parser`, `task search "search query"`, `task related --id bpoh --all`) and found no separate earlier issue that documented this same parser bug family.

The only prior diagnosis is this issue's existing `research:diagnosis`, which already identified the shared switch-flag parsing defect.

## What we learned then

From the existing `research:diagnosis` on this issue:

- switch flags need explicit arity metadata instead of generic "maybe consumes the next token" parsing
- parser-level tests must cover switch-before-positional forms, not only command helpers called directly
- a search-only patch would be unsound because the bug lived in the shared parser

## Why that learning didn't stick

This pass mostly confirms the earlier diagnosis rather than changing it.

The practical problem was not that the learning was wrong; it was that QA failure state outlived the follow-up parser fix on the branch. The issue still needed a preserved diagnosis/retro record tied to the failed QA artifact before moving back to `diagnosed`.

## Why does this keep happening?

The deeper bug class is a missing CLI-parser invariant: command metadata originally described help text and defaults, but not whether a flag is a presence-only switch or a value-taking flag. Without that invariant, every new switch flag (`--all`, `--summary`, `--compact`, `--full`, `--jsonl`, etc.) was vulnerable to stealing a following positional argument.

So the repeatable failure mode is: shared parser logic makes assumptions that command metadata does not encode, and direct command-helper tests do not exercise real argv ordering.

## Proposed fix

Minimal correct fix:

1. Add explicit flag kind metadata in `src/types.ts` (`switch` vs `value`).
2. Define commands with that metadata in `src/commands-registry.ts`.
3. Change `parseFlags()` in `src/task.ts` to consume the next argv token only for value-taking flags.
4. Keep positional args intact after switch flags so these all work consistently:
   - `task search --all "rebuild child"`
   - `task show --summary <id>`
   - `task children --all <parent-id>`
5. Add parser-focused tests in `src/task.test.ts` for both search queries and positional-id commands with a switch before the positional argument.

That is the minimal correct fix because the root cause lives in shared parsing, not in `issueSearch()` or the rebuild logic.

## Why was this undetected?

**Category:** Logic bug.

The parser logic was wrong, and the test suite did not cover the argv shape that exposed it.

What the old tests proved:
- command-helper tests proved `issueSearch()` could search when given already-normalized args
- parser tests proved isolated cases like `--all` by itself or positional text without a leading switch

What they did **not** prove:
- that a real CLI invocation with a presence-only switch before positional input preserved the positional input
- that positional-id commands still worked when a switch came first

That gap let the bug pass code review, unit tests, and type checking.

## Verification Contract

### Reproduction setup

Use the QA artifact repo or any fresh temp repo with a closed issue whose title matches the query.

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

Historical failure: exit code 1 with `{"error":"search query is required (pass positional text or --text)"}`.

### User-observable fix proof

After the parser fix:

- `task search --all "rebuild child"` returns the closed issue instead of the missing-query error.
- `task show --summary <id>` succeeds when the switch appears before the positional issue id.
- The original QA repo `/tmp/task-qa-06-lfiy9gvc` now accepts `bun /home/david/task-w0/src/task.ts search --all "rebuild child"` and returns `zz3k-rebuild-child`, which matches the expected post-fix behavior.

### Automated proof

Require both:

1. **Regression test for the reported symptom**
   - `src/task.test.ts`: parse `['--all', 'rebuild', 'child']` for the `search` command and assert `{ '--all': 'true', _: ['rebuild', 'child'] }`.
2. **Detection-gap test for the shared parser contract**
   - `src/task.test.ts`: parse `['--summary', 'ab12']` for the `show` command, then normalize it and assert `{ '--summary': 'true', '--id': 'ab12' }`.

Relevant older tests that were insufficient:
- direct `issueSearch()` tests in `src/commands-basic.test.ts`
- parser tests that exercised switches only in isolation

These new tests close the wiring gap by checking actual argv parsing behavior instead of only post-parse command helpers.

### Fast recheck

Cheapest reliable reruns:

```bash
bun test src/task.test.ts
cd /tmp/task-qa-06-lfiy9gvc && bun /home/david/task-w0/src/task.ts search --all "rebuild child"
```

Then rerun the failed QA task.

## Manual QA Intent

### Primary flows to verify
- search with `--all` before positional query text
- show with `--summary` before positional issue id
- one other positional-id command with a leading switch, such as `children --all <id>`

### Risky surfaces
- any command that mixes presence-only switches with positional args
- repeated value flags (`--where`, `--label`, `--add`, `--remove`) after parser changes
- positional-id normalization after a leading switch

### Required setup
- temp git repo with at least one closed issue
- one parent/child pair for relationship-command spot checks

### Human checks
- command order should not matter for switch flags versus positional input
- failure messages should remain JSON and specific when required positional input is actually missing
- `--all` should widen results, not consume the search text or issue id

## Risk

- Parser changes affect every command, so a mistaken flag-kind table could break value flags or repeated flags.
- A narrow search-only patch would leave the same bug in `show`, `children`, and other commands.
- Because this area sits at the CLI boundary, regressions are most likely to surface only in subprocess or shell-level usage unless parser tests stay broad.