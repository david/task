## Bug
Switch flags consumed following positional args in the shared CLI parser, causing `task search --all "rebuild child"` to lose its query.

## Where the process broke down
Test gap

## What was missed
The plan covered closed-issue visibility and rebuild behavior, but it never exercised real CLI argv parsing for commands that combine a presence-only switch with positional input. QA found the missing case with `search --all "rebuild child"`; the same parser defect also affected `show --summary <id>`.

## Related past issues
No separate related `task` issue found. This issue's earlier `research:diagnosis` already identified the parser-arity gap.

## What we learned then
Switch flags need explicit arity metadata, and parser-level tests must cover switch-before-positional argument order rather than testing command helpers only after arguments are already normalized.

## Why that learning didn't stick
This pass confirmed the earlier diagnosis rather than discovering a new bug family. The main process problem was that the QA-failure record remained active while the follow-up parser fix and tests landed on the branch.

## Why existing tests missed it
Existing search tests called `issueSearch()` directly, which bypassed `parseFlags()`. Parser tests covered switches in isolation and positional arguments in canonical order, but not the mixed shell invocation shape `--switch <positional>` for commands that accept positional input. A parser-level regression test for `search --all ...` and `show --summary ...` would have caught this immediately.

## Suggestion for future plans
For every command that supports positional input plus switch flags, require at least one parser-level or subprocess CLI test with the switch before the positional argument so shared argv bugs are caught before manual QA.