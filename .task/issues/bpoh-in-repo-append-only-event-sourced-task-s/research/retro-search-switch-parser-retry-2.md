## Bug
Switch flags consumed following positional args in the shared CLI parser, causing `task search --all "rebuild child"` to lose its query.

## Where the process broke down
Test gap

## What was missed
The task/QA planning covered closed-issue visibility and rebuild behavior, but it did not require parser-level coverage for commands that combine a presence-only switch with positional input. QA hit the missing case with `search --all "rebuild child"`; the same parser defect also affected `show --summary <id>`.

## Related past issues
No separate related `task` issue found. This issue's earlier `research:diagnosis` and `research:diagnosis-retry-1` already identified the parser-arity gap.

## What we learned then
Switch flags need explicit arity metadata, and parser-level tests must cover switch-before-positional argument order rather than testing command helpers only after arguments are already normalized.

## Why that learning didn't stick
The branch now reflects that learning, but the issue workflow state lagged behind the fix. QA failure remained recorded after the parser fix and regression tests landed, so this retry mainly reconciles the stored QA artifact with current branch state.

## Why existing tests missed it
Existing search tests called `issueSearch()` directly, which bypassed `parseFlags()`. Earlier parser tests covered switches in isolation and positional args in canonical order, but not the mixed shell shape `--switch <positional>`. A parser-level regression test for both `search --all ...` and `show --summary ...` is the durable safeguard.

## Suggestion for future plans
For every command that accepts positional input plus switch flags, require at least one parser-level or subprocess CLI test that puts a switch before the positional input so shared argv bugs are caught before manual QA.
