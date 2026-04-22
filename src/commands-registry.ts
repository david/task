import type { Command, FlagDef, StringMap } from "./types"
import { detectRepoRoot } from "./tracker/root"
import {
  documentDelete,
  documentGet,
  documentSet,
  issueChildren,
  issueClose,
  issueCreate,
  issueList,
  issueMetaGet,
  issueMetaSet,
  issueParents,
  issuePhaseNext,
  issuePhaseSet,
  issueRelated,
  issueSearch,
  issueShow,
  legacyImport,
  readAllStdin,
  updateArrayField,
  workflowBootstrap,
} from "./commands"

type FlagOptions = {
  required: boolean
  defaultValue: string
}

function valueFlag(description: string, options: Partial<FlagOptions> = {}): FlagDef {
  return {
    description,
    kind: "value",
    required: options.required ?? false,
    hasDefault: options.defaultValue !== undefined,
    defaultValue: options.defaultValue ?? "",
  }
}

function switchFlag(description: string): FlagDef {
  return {
    description,
    kind: "switch",
    required: false,
    hasDefault: false,
    defaultValue: "",
  }
}

export const commands: StringMap<Command> = {
  create: {
    description: "Create a new issue",
    usage: "task create --title <title> [--description <desc>] [--github-issue <number>] [--priority <0-4>] [--label <label>] [--parent <id>]",
    flags: {
      "--title": valueFlag("Issue title", { required: true }),
      "--description": valueFlag("Issue description"),
      "--github-issue": valueFlag("GitHub issue number"),
      "--priority": valueFlag("Priority (0=highest, default 2)"),
      "--label": valueFlag("Label (repeatable)"),
      "--parent": valueFlag("Parent issue ID for hierarchy"),
    },
    examples: [
      'task create --title "Fix login bug"',
      'task create --title "Urgent fix" --priority 0',
      'task create --title "New feature" --github-issue 42',
      'task create --title "Fix PDF" --label cli --label bug',
      'task create --title "Add child command" --parent ab12',
    ],
    run: (args) => issueCreate(args, detectRepoRoot(process.cwd())),
  },
  show: {
    description: "Show issue details",
    usage: "task show <id> [--fields <csv>] [--compact] [--summary] [--include-keys]",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
      "--fields": valueFlag("Comma-separated metadata fields to return"),
      "--compact": switchFlag("Return a compact metadata projection suitable for agents"),
      "--summary": switchFlag("Return metadata only (omit document keys unless --include-keys is passed)"),
      "--include-keys": switchFlag("Include current logical document keys in the output"),
      "--include-stores": switchFlag("Deprecated alias for --include-keys"),
    },
    examples: [
      "task show ab12",
      "task show ab12 --summary",
      "task show ab12 --compact",
      "task show ab12 --fields title,phase,refs",
      "task show ab12 --include-keys",
      "task show --id ab12",
    ],
    positionalId: true,
    run: (args) => issueShow(args, detectRepoRoot(process.cwd())),
  },
  list: {
    description: "List issues",
    usage: "task list [--where key=value] [--label <label>] [--text <query>] [--fields <csv>] [--compact|--full] [--sort priority|updated] [--limit <n>] [--jsonl] [--all]",
    flags: {
      "--where": valueFlag("Filter by key=value (repeatable, AND logic)"),
      "--label": valueFlag("Filter by label (repeatable, AND logic)"),
      "--text": valueFlag("Case-insensitive text search across id, title, description, refs, and labels"),
      "--fields": valueFlag("Comma-separated fields to return for each issue"),
      "--compact": switchFlag("Return a compact issue projection suitable for agents (default)"),
      "--full": switchFlag("Return full issue objects instead of the default compact projection"),
      "--sort": valueFlag("Sort by priority (default) or updated"),
      "--limit": valueFlag("Maximum number of results to return"),
      "--jsonl": switchFlag("Format array output as one JSON object per line"),
      "--all": switchFlag("Include closed issues"),
    },
    examples: [
      "task list",
      "task list --where status=open",
      "task list --label cli",
      "task list --label cli --label bug",
      'task list --text "packet session"',
      "task list --sort updated",
      "task list --jsonl --all --limit 10",
      "task list --full --limit 1",
    ],
    run: (args) => issueList(args, detectRepoRoot(process.cwd())),
  },
  search: {
    description: "Search issues by text",
    usage: "task search <query> [--fields <csv>] [--compact|--full] [--sort priority|updated] [--limit <n>] [--jsonl] [--all]",
    flags: {
      "--text": valueFlag("Optional explicit search query (otherwise uses positional query text)"),
      "--fields": valueFlag("Comma-separated fields to return for each issue"),
      "--compact": switchFlag("Return a compact issue projection suitable for agents (default)"),
      "--full": switchFlag("Return full issue objects instead of the default compact projection"),
      "--sort": valueFlag("Sort by priority (default) or updated"),
      "--limit": valueFlag("Maximum number of results to return"),
      "--jsonl": switchFlag("Format array output as one JSON object per line"),
      "--all": switchFlag("Include closed issues"),
    },
    examples: [
      "task search packet session",
      'task search "new packet session page" --sort updated',
      'task search --text "packet session" --jsonl',
    ],
    run: (args) => issueSearch(args, detectRepoRoot(process.cwd())),
  },
  children: {
    description: "List child issues in the hierarchy under a parent issue",
    usage: "task children <id> [--fields <csv>] [--compact|--full] [--sort priority|updated] [--limit <n>] [--jsonl] [--all]",
    flags: {
      "--id": valueFlag("Parent issue ID (or pass as the first positional argument)"),
      "--fields": valueFlag("Comma-separated fields to return for each child issue"),
      "--compact": switchFlag("Return a compact issue projection suitable for agents (default)"),
      "--full": switchFlag("Return full issue objects instead of the default compact projection"),
      "--sort": valueFlag("Sort by priority (default) or updated"),
      "--limit": valueFlag("Maximum number of results to return"),
      "--jsonl": switchFlag("Format array output as one JSON object per line"),
      "--all": switchFlag("Include closed issues"),
    },
    examples: [
      "task children gh549",
      "task children gh549 --sort updated",
      "task children gh549 --fields id,title,phase,status",
      "task children gh549 --full",
      "task children --id gh549",
    ],
    positionalId: true,
    run: (args) => issueChildren(args, detectRepoRoot(process.cwd())),
  },
  parents: {
    description: "List parent issues for an issue in the hierarchy",
    usage: "task parents <id> [--fields <csv>] [--compact|--full] [--sort priority|updated] [--limit <n>] [--jsonl]",
    flags: {
      "--id": valueFlag("Child issue ID (or pass as the first positional argument)"),
      "--fields": valueFlag("Comma-separated fields to return for each parent issue"),
      "--compact": switchFlag("Return a compact issue projection suitable for agents (default)"),
      "--full": switchFlag("Return full issue objects instead of the default compact projection"),
      "--sort": valueFlag("Sort by priority (default) or updated"),
      "--limit": valueFlag("Maximum number of results to return"),
      "--jsonl": switchFlag("Format array output as one JSON object per line"),
    },
    examples: [
      "task parents ojyb",
      "task parents ojyb --sort updated",
      "task parents ojyb --fields id,title,phase,status",
      "task parents ojyb --full",
      "task parents --id ojyb",
    ],
    positionalId: true,
    run: (args) => issueParents(args, detectRepoRoot(process.cwd())),
  },
  related: {
    description: "List parent and child issues related to an issue",
    usage: "task related <id> [--fields <csv>] [--compact|--full] [--sort priority|updated] [--limit <n>] [--jsonl] [--all]",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
      "--fields": valueFlag("Comma-separated fields to return for each related issue"),
      "--compact": switchFlag("Return a compact relation projection suitable for agents (default)"),
      "--full": switchFlag("Return full issue objects instead of the default compact projection"),
      "--sort": valueFlag("Sort by priority (default) or updated"),
      "--limit": valueFlag("Maximum number of results to return"),
      "--jsonl": switchFlag("Format array output as one JSON object per line"),
      "--all": switchFlag("Include closed child issues in the results"),
    },
    examples: [
      "task related gh549",
      "task related gh549 --sort updated",
      "task related gh549 --fields id,title,relation,status",
      "task related gh549 --full",
      "task related --id gh549",
    ],
    positionalId: true,
    run: (args) => issueRelated(args, detectRepoRoot(process.cwd())),
  },
  close: {
    description: "Close an issue (append IssueClosed and keep it in place)",
    usage: "task close <id>",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
    },
    examples: ["task close ab12", "task close --id ab12"],
    positionalId: true,
    run: (args) => issueClose(args, detectRepoRoot(process.cwd())),
  },
  "phase next": {
    description: "Get the next configured phase for an issue",
    usage: "task phase next <id>",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
    },
    examples: ["task phase next ab12", "task phase next --id ab12"],
    positionalId: true,
    run: (args) => issuePhaseNext(args, detectRepoRoot(process.cwd())),
  },
  "phase set": {
    description: "Advance an issue to a configured phase",
    usage: "task phase set <id> --value <phase>",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
      "--value": valueFlag("Next phase", { required: true }),
    },
    examples: [
      "task phase set 0ov2 --value ready-to-code",
      "task phase set --id 0ov2 --value ready-to-code",
    ],
    positionalId: true,
    run: (args) => issuePhaseSet(args, detectRepoRoot(process.cwd())),
  },
  bootstrap: {
    description: "Scaffold workflow docs and repo-local pi skills for the current repo",
    usage: "task bootstrap [--root <path>] [--force]",
    flags: {
      "--root": valueFlag("Target repo root (defaults to the detected current repo root)"),
      "--force": switchFlag("Overwrite existing scaffolded doc files"),
    },
    examples: [
      "task bootstrap",
      "task bootstrap --force",
      "task bootstrap --root ../other-repo",
    ],
    run: (args) => workflowBootstrap(args, detectRepoRoot(process.cwd())),
  },
  "legacy import": {
    description: "Import a legacy tracker snapshot into the repo-local .task event store",
    usage: "task legacy import --source <path>",
    flags: {
      "--source": valueFlag("Path to the legacy tracker root", { required: true }),
    },
    examples: ["task legacy import --source /tmp/old-issues"],
    run: (args) => legacyImport(args, detectRepoRoot(process.cwd())),
  },
  "meta set": {
    description: "Set a non-reserved metadata field on an issue",
    usage: "task meta set <id> --key <key> --value <value>",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
      "--key": valueFlag("Metadata key", { required: true }),
      "--value": valueFlag("Metadata value", { required: true }),
    },
    examples: [
      "task meta set 0ov2 --key owner --value backend",
      "task meta set --id 0ov2 --key owner --value backend",
    ],
    positionalId: true,
    run: (args) => issueMetaSet(args, detectRepoRoot(process.cwd())),
  },
  "meta get": {
    description: "Get a metadata field from an issue",
    usage: "task meta get <id> --key <key>",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
      "--key": valueFlag("Metadata key", { required: true }),
    },
    examples: ["task meta get 0ov2 --key phase", "task meta get --id 0ov2 --key phase"],
    positionalId: true,
    run: (args) => issueMetaGet(args, detectRepoRoot(process.cwd())),
  },
  "update label": {
    description: "Add or remove labels on an issue",
    usage: "task update label <id> [--add <label>] [--remove <label>]",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
      "--add": valueFlag("Label to add (repeatable)"),
      "--remove": valueFlag("Label to remove (repeatable)"),
    },
    examples: [
      "task update label ab12 --add cli",
      "task update label ab12 --add cli --add bug",
      "task update label ab12 --remove cli",
      "task update label ab12 --remove old --add new",
      "task update label --id ab12 --add cli",
    ],
    positionalId: true,
    run: (args) => updateArrayField(args, "labels", detectRepoRoot(process.cwd())),
  },
  "update refs": {
    description: "Add or remove refs on an issue",
    usage: "task update refs <id> [--add <ref>] [--remove <ref>]",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
      "--add": valueFlag("Ref to add (repeatable)"),
      "--remove": valueFlag("Ref to remove (repeatable)"),
    },
    examples: [
      "task update refs ab12 --add m85s",
      "task update refs ab12 --remove m85s",
      "task update refs --id ab12 --add m85s",
    ],
    positionalId: true,
    run: (args) => updateArrayField(args, "refs", detectRepoRoot(process.cwd())),
  },
  set: {
    description: "Save an issue document from --value, --file, or stdin",
    usage: "task set <id> --key <path> [--value <val> | --file <path>]",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
      "--key": valueFlag("Document key path (exact path only)", { required: true }),
      "--value": valueFlag("Value to save (for simple strings)"),
      "--file": valueFlag("Read value from file path (for multiline content)"),
    },
    examples: [
      'task set ab12 --key research/summary --value "quick note"',
      "task set ab12 --key research/details --file /tmp/details.md",
      "echo 'content' | task set ab12 --key research/summary",
      'task set --id ab12 --key research/summary --value "quick note"',
    ],
    positionalId: true,
    run: (args) => documentSet(args, readAllStdin, detectRepoRoot(process.cwd())),
  },
  get: {
    description: "Read an issue document path, subtree, or the full document tree",
    usage: "task get <id> --key <path|path/|/>",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
      "--key": valueFlag("Exact path, subtree selector with trailing '/', or '/' for the full tree", { required: true }),
    },
    examples: [
      "task get ab12 --key research/summary",
      "task get ab12 --key research/",
      "task get ab12 --key /",
      "task get --id ab12 --key research/summary",
    ],
    positionalId: true,
    run: (args) => documentGet(args, detectRepoRoot(process.cwd())),
  },
  delete: {
    description: "Delete an issue document path, subtree, or the full document tree",
    usage: "task delete <id> --key <path|path/|/>",
    flags: {
      "--id": valueFlag("Issue ID (or pass as the first positional argument)"),
      "--key": valueFlag("Exact path, subtree selector with trailing '/', or '/' for the full tree", { required: true }),
    },
    examples: [
      "task delete ab12 --key research/summary",
      "task delete ab12 --key research/",
      "task delete ab12 --key /",
      "task delete --id ab12 --key research/summary",
    ],
    positionalId: true,
    run: (args) => documentDelete(args, detectRepoRoot(process.cwd())),
  },
}
