task_key: qa-03-invalid-paths-and-help-surface
recorded_at: 2026-04-21T21:29:00Z
role: agent
browser_session: n/a
url: n/a
summary: Rerun passed on the current branch; invalid path rejection and the user-facing command/docs surface are consistent with the approved path-based document model.
status: pass
fixture_issue_id: jr9y-hz11-qa-03-rerun-fixture
checks:
  invalid_key_/research: |
    {"error":"Invalid document key '/research'"}
  invalid_key_research__today: |
    {"error":"Invalid document key 'research//today'"}
  invalid_key_research_dotdot_today: |
    {"error":"Invalid document key 'research/../today'"}
help_surface:
  root_help: |
    task — Local issue tracker for agents
    
    Usage:
      task <command> [flags]
      task <command> --help
    
    Commands:
      create           Create a new issue
      show             Show issue details
      list             List issues
      search           Search issues by text
      children         List child issues in the hierarchy under a parent issue
      parents          List parent issues for an issue in the hierarchy
      related          List parent and child issues related to an issue
      close            Close an issue (append IssueClosed and keep it in place)
      phase next       Get the next configured phase for an issue
      phase set        Advance an issue to a configured phase
      legacy import    Import a legacy tracker snapshot into the repo-local .task event store
      meta set         Set a non-reserved metadata field on an issue
      meta get         Get a metadata field from an issue
      update label     Add or remove labels on an issue
      update refs      Add or remove refs on an issue
      set              Save an issue document from --value, --file, or stdin
      get              Read an issue document path, subtree, or the full document tree
      delete           Delete an issue document path, subtree, or the full document tree
    
    Common workflows:
      task create --title "Child work" --parent ab12                 # Create a child issue
      task legacy import --source /tmp/old-issues                  # One-time legacy migration
      task show ab12                                               # Read an issue
      task show ab12 --summary                                     # Read metadata only
      task list                                                    # List open issues
      task list --where phase=research                             # Filter by metadata
      task list --text "packet session"                            # Compact search
      task list --label cli                                        # Filter by label
      task children m85s                                           # List child issues
      task parents ab12                                            # List parent issues
      task related ab12                                            # List all related issues
      task search packet session                                   # Search by query text
      task update label ab12 --add cli                             # Add a label
  set_help: |
    Save an issue document from --value, --file, or stdin
    
    Usage:
      task set <id> --key <path> [--value <val> | --file <path>]
    
    Note:
      Pass the issue ID either as --id <id> or as the first positional argument.
    
    Flags:
      --id                   Issue ID (or pass as the first positional argument)
      --key                  Document key path (exact path only) (required)
      --value                Value to save (for simple strings)
      --file                 Read value from file path (for multiline content)
    
    Examples:
      task set ab12 --key research/summary --value "quick note"
      task set ab12 --key research/details --file /tmp/details.md
      echo 'content' | task set ab12 --key research/summary
      task set --id ab12 --key research/summary --value "quick note"
  get_help: |
    Read an issue document path, subtree, or the full document tree
    
    Usage:
      task get <id> --key <path|path/|/>
    
    Note:
      Pass the issue ID either as --id <id> or as the first positional argument.
    
    Flags:
      --id                   Issue ID (or pass as the first positional argument)
      --key                  Exact path, subtree selector with trailing '/', or '/' for the full tree (required)
    
    Examples:
      task get ab12 --key research/summary
      task get ab12 --key research/
      task get ab12 --key /
      task get --id ab12 --key research/summary
  delete_help: |
    Delete an issue document path, subtree, or the full document tree
    
    Usage:
      task delete <id> --key <path|path/|/>
    
    Note:
      Pass the issue ID either as --id <id> or as the first positional argument.
    
    Flags:
      --id                   Issue ID (or pass as the first positional argument)
      --key                  Exact path, subtree selector with trailing '/', or '/' for the full tree (required)
    
    Examples:
      task delete ab12 --key research/summary
      task delete ab12 --key research/
      task delete ab12 --key /
      task delete --id ab12 --key research/summary
forbidden_doc_matches: |
  (none)
