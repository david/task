## Bug: switch flags consume following positional args in the CLI parser

**Where the process broke down:** Test gap

**What was missed:** The plan verified `task search` behavior and closed-issue visibility, but it never exercised real CLI argv parsing for commands that combine a presence-only switch with positional input, such as `search --all "rebuild child"` or `show --summary <id>`.

**Why it was missed:** The implementation tasks focused on command behavior after parsing, and the automated search tests called `issueSearch()` directly instead of going through `parseFlags()`. Parser tests covered `--all` only by itself and positional queries only in the canonical `query ... --flag` order, so the shared switch-arity bug stayed hidden until QA used a real shell command.

**Suggestion for future plans:** For every command with positional args plus switch flags, add one parser-level or end-to-end CLI test that puts the switch before the positional argument so argv-handling bugs are caught before manual QA.