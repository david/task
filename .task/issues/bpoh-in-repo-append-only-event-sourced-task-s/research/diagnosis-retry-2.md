## Root cause

QA task `qa-06-closed-issues-stay-queryable-and-projections-rebuild` failed before the rebuild step because the shared CLI argv parser used to treat every `--flag` as if it might consume the following non-flag token.

The regression was introduced in `2fe0aa63` (`refactor(task): stage in-repo rewrite under src`). In that version of `src/task.ts`, `parseFlags()` at lines 17-24 always grabbed the next non-flag token as the flag value:

- `const next = argv[i + 1]`
- `if (next && !next.startsWith("--")) { value = next; i++ } else { value = "true" }`

That broke commands that mix a presence-only switch with positional input. For the failing QA repro, `task search --all "rebuild child"` was parsed as `{ "--all": "rebuild child" }` with no positional query left in `args._`. `issueSearch()` in `src/commands.ts:211-217` then saw neither positional text nor `--text` and threw `search query is required (pass positional text or --text)`.

So the bug was not in search indexing, closed-issue visibility, or projection rebuild logic. It was a shared parser defect at the CLI boundary. The same mechanism also broke other switch-plus-positional forms such as `task show --summary <id>`.

On the current branch, the exact fix direction is already present:

- `src/types.ts:21-27` now records flag kind as `switch` vs `value`
- `src/commands-registry.ts:117-125` marks `search` flags with explicit switch/value metadata
- `src/task.ts:32-35, 55-60` now consults that metadata and consumes the next token only for value-taking flags
- `src/task.test.ts:90-95` and `src/task.test.ts:115-123` now cover the previously-missed switch-before-positional cases

I verified the stored QA repro repo now behaves correctly on HEAD:

- `cd /tmp/task-qa-06-lfiy9gvc && bun /home/david/task-w0/src/task.ts search --all "rebuild child"` returns the closed child
- `cd /tmp/task-qa-06-lfiy9gvc && bun /home/david/task-w0/src/task.ts show --summary zz3k-rebuild-child` also succeeds

## Regression history

- **Introduced:** `2fe0aa63` (`refactor(task): stage in-repo rewrite under src`)
  - added the new shared parser without flag-arity metadata
  - presence-only switches therefore stole following positional tokens
- **Observed in QA:** `qa-results:qa-06-closed-issues-stay-queryable-and-projections-rebuild`
  - `search --all "rebuild child"` failed with the missing-query error
  - `search "rebuild child" --all` succeeded in the same repo, proving order sensitivity rather than search failure
- **Addressed on current branch:** `de5d7cfa` (`fix(task): harden event-sourced cli parsing and checks`)
  - made flag arity explicit
  - updated parsing to respect switch vs value flags
  - added parser tests for the failing argv shapes

This is therefore a real regression introduced by the repo-local rewrite and already corrected in the current branch, while issue metadata still reflected the earlier QA failure.

## Prior issue history

I checked local issue history with `task list --all --text "search query"`, `task list --all --text "parser"`, and `task related --id bpoh --all`.

No separate prior `task` issue surfaced for this same parser bug family.

Within this issue, earlier artifacts already captured the same diagnosis:

- `research:diagnosis`
- `research:diagnosis-retry-1`

So this pass confirms and updates the diagnosis against current branch state rather than discovering a different root cause.

## What we learned then

From the earlier diagnosis on this issue:

- switch flags need explicit arity metadata instead of generic "maybe consumes the next token" parsing
- parser-level tests must cover switch-before-positional input, not only command helpers after args are already normalized
- a search-only patch would be unsound because the defect lived in shared parser code

## Why that learning didn't stick

The learning itself was correct and the branch now reflects it. What did not stick was workflow state: the issue remained in `qa-failed` even after the shared parser fix landed.

So this retry is mainly closing the loop between:

1. the stored QA artifact,
2. the approved diagnosis, and
3. the branch state that now matches the approved fix.

## Why does this keep happening?

The repeatable bug class is missing boundary invariants in shared CLI parsing.

Originally, command metadata described help text and defaults but did not encode whether a flag was a presence-only switch or a value-taking flag. That meant the parser had to guess, and its guess was wrong for every switch followed by positional input.

The durable lesson is: shared boundary code must not depend on semantics that command metadata does not express. When the invariant is missing, every command using switches plus positional args becomes vulnerable.

## Proposed fix

Approved minimal fix shape:

1. Keep explicit flag-kind metadata (`switch` vs `value`) in command definitions.
2. Keep `parseFlags()` consuming the next argv token only for value-taking flags.
3. Preserve positional arguments after switch flags for both query-style and positional-id commands.
4. Keep parser-level regression tests for both:
   - `search --all "rebuild child"`
   - `show --summary <id>`
5. Do not patch `issueSearch()` alone; the parser contract must stay correct across all commands.

On the current branch, this fix shape already exists in `de5d7cfa`.

## Why was this undetected?

**Category:** Logic bug.

What existing tests proved before QA found it:

- direct command-helper tests proved `issueSearch()` worked when passed already-normalized args
- parser tests proved some isolated cases like `--all` by itself or positional text in canonical order

What they did **not** prove:

- that a real CLI invocation with a switch before positional input preserved that positional input
- that positional-id commands still worked when a switch came first

That gap let the parser regression survive code review, unit tests, and type checking.

## Verification Contract

### Reproduction setup

Use the stored QA repo or any fresh temp repo with a closed issue whose title matches the search text.

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

Historical failure:

```json
{"error":"search query is required (pass positional text or --text)"}
```

### User-observable fix proof

After the fix:

- `task search --all "rebuild child"` returns the closed issue instead of a missing-query error
- `task show --summary <id>` succeeds when the switch comes before the positional id
- command order is no longer significant for presence-only switches versus positional input

### Automated proof

Required automated proof for this bug family:

1. `src/task.test.ts:90-95`
   - `parseFlags(["--all", "rebuild", "child"], registeredCommand("search").flags)` preserves both the switch and the positional query
2. `src/task.test.ts:115-123`
   - parsing then normalizing `show --summary ab12` preserves the positional id and produces `--id`
3. Relevant helper tests such as `src/commands-basic.test.ts:208-225` remain valuable but are not sufficient alone because they bypass argv parsing

I ran:

```bash
bun test src/task.test.ts
bun test src/commands-basic.test.ts
```

Both passed on the current branch.

### Fast recheck

Cheapest reliable reruns:

```bash
bun test src/task.test.ts
cd /tmp/task-qa-06-lfiy9gvc && bun /home/david/task-w0/src/task.ts search --all "rebuild child"
```

Then rerun QA task `qa-06-closed-issues-stay-queryable-and-projections-rebuild`.

## Manual QA Intent

### Primary flows to verify
- `search --all <query>` with the switch before positional query text
- `show --summary <id>` with the switch before the positional id
- one relationship command using the same pattern, such as `children --all <parent-id>`

### Risky surfaces
- any command mixing presence-only switches with positional args
- repeated value flags after parser changes (`--where`, `--label`, `--add`, `--remove`)
- positional-id normalization after a leading switch

### Required setup
- temp git repo with at least one closed issue
- one parent/child pair for a relationship-command spot check

### Human checks
- switch order should not steal or hide positional input
- `--all` should widen results, not consume the query or id
- actual missing-input failures should still return clear JSON errors

## Risk

- Parser behavior is shared across the whole CLI, so incorrect flag metadata could break unrelated commands.
- Narrow command-specific patches would reintroduce inconsistency because the bug class lives in shared parsing.
- Future commands can regress if new flags are added without correct switch/value metadata or without parser-level tests.

## Disposition

bugfix-now
