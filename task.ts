import { commands } from "./src/commands-registry"
import type {
  Command,
  CommandArgs,
  CommandFlag,
  FlagDef,
  FlagValue,
  JsonOutputValue,
  StringMap,
} from "./src/types"

export type ParsedFlags = CommandArgs

function toCommandFlag(value: string): CommandFlag {
  if (!value.startsWith("--")) {
    throw new Error(`Invalid flag '${value}'`)
  }
  return value
}

function appendFlagValue(existing: FlagValue | undefined, nextValue: string): FlagValue {
  if (existing === undefined) {
    return nextValue
  }
  if (Array.isArray(existing)) {
    existing.push(nextValue)
    return existing
  }
  return [existing, nextValue]
}

function flagConsumesValue(flag: CommandFlag, flagDefs: StringMap<FlagDef> | undefined): boolean {
  const definition = flagDefs?.[flag]
  return definition?.kind !== "switch"
}

export function parseFlags(argv: string[], flagDefs?: StringMap<FlagDef>): ParsedFlags {
  const flags: ParsedFlags = {}
  const positional: string[] = []

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === undefined) {
      break
    }

    if (arg.startsWith("--")) {
      if (arg.includes("=")) {
        const [flagName, flagValue] = arg.split("=", 2)
        throw new Error(
          `Unsupported flag format '${arg}'. Use '${flagName} ${flagValue}' (space-separated)`
        )
      }

      const flag = toCommandFlag(arg)
      const next = argv[i + 1]
      const consumeValue = flagConsumesValue(flag, flagDefs)
      const value = consumeValue && next !== undefined && !next.startsWith("--") ? next : "true"
      if (consumeValue && next !== undefined && !next.startsWith("--")) {
        i += 1
      }

      flags[flag] = appendFlagValue(flags[flag], value)
      continue
    }

    positional.push(arg)
  }

  if (positional.length === 1) {
    const [onlyPositional] = positional
    if (onlyPositional !== undefined) {
      flags["_"] = onlyPositional
    }
  } else if (positional.length > 1) {
    const [firstPositional, ...rest] = positional
    if (firstPositional !== undefined) {
      flags["_"] = [firstPositional, ...rest]
    }
  }

  return flags
}

export function formatResult(result: JsonOutputValue, flags: ParsedFlags): string {
  if (flags["--jsonl"] !== undefined && Array.isArray(result)) {
    return result.map((item) => JSON.stringify(item)).join("\n")
  }
  return JSON.stringify(result)
}

function printHelp(): void {
  const lines = [
    "task — Local issue tracker for agents",
    "",
    "Usage:",
    "  task <command> [flags]",
    "  task <command> --help",
    "",
    "Commands:",
  ]
  for (const [name, cmd] of Object.entries(commands)) {
    lines.push(`  ${name.padEnd(16)} ${cmd.description}`)
  }
  lines.push("")
  lines.push("Common workflows:")
  lines.push("  task create --title \"Child work\" --parent ab12                 # Create a child issue")
  lines.push("  task legacy import --source /tmp/old-issues                  # One-time legacy migration")
  lines.push("  task show ab12                                               # Read an issue")
  lines.push("  task show ab12 --summary                                     # Read metadata only")
  lines.push("  task list                                                    # List open issues")
  lines.push("  task list --where phase=research                             # Filter by metadata")
  lines.push("  task list --text \"packet session\"                            # Compact search")
  lines.push("  task list --label cli                                        # Filter by label")
  lines.push("  task children m85s                                           # List child issues")
  lines.push("  task parents ab12                                            # List parent issues")
  lines.push("  task related ab12                                            # List all related issues")
  lines.push("  task search packet session                                   # Search by query text")
  lines.push("  task update label ab12 --add cli                             # Add a label")
  lines.push("  task update refs ab12 --add m85s                             # Add a ref")
  lines.push("  task phase next ab12                                         # Get the next configured phase")
  lines.push("  task phase set ab12 --value ready-to-code                    # Advance issue phase")
  lines.push("  task get ab12 --key research/summary                         # Read an issue document")
  lines.push('  task set ab12 --key research/summary --value "..."                 # Save an issue document')
  lines.push("  task delete ab12 --key research/summary                      # Delete one document path")
  lines.push("  task delete ab12 --key research/                             # Delete a document subtree")
  lines.push("  task meta set ab12 --key owner --value backend               # Update non-reserved metadata")
  lines.push("  task show --id ab12                                          # Legacy flag form still works")
  lines.push("")
  lines.push('Run "task <command> --help" for details.')
  console.log(lines.join("\n"))
}

function printCommandHelp(cmdName: string, cmd: Command): void {
  const lines = [cmd.description, "", "Usage:", `  ${cmd.usage}`]
  if ("positionalId" in cmd && cmd.positionalId) {
    lines.push("", "Note:", "  Pass the issue ID either as --id <id> or as the first positional argument.")
  }
  lines.push("", "Flags:")
  const flagEntries = Object.entries(cmd.flags)
  if (flagEntries.length === 0) {
    lines.push("  (none)")
  } else {
    for (const [flag, def] of flagEntries) {
      const req = def.required ? " (required)" : ""
      const dflt = def.hasDefault ? ` (default: ${def.defaultValue})` : ""
      lines.push(`  ${flag.padEnd(22)} ${def.description}${req}${dflt}`)
    }
  }
  if (cmd.examples.length > 0) {
    lines.push("")
    lines.push("Examples:")
    for (const ex of cmd.examples) {
      lines.push(`  ${ex}`)
    }
  }
  console.log(lines.join("\n"))
}

function isHelp(arg: string | undefined): boolean {
  return arg === "--help" || arg === "-h"
}

function positionalValues(value: FlagValue): string[] {
  return Array.isArray(value) ? value : [value]
}

export function normalizeCommandFlags(
  cmdName: string,
  cmd: Command,
  flags: ParsedFlags
): ParsedFlags {
  if (!("positionalId" in cmd && cmd.positionalId) || flags["_"] === undefined) {
    return flags
  }

  if (flags["--id"] !== undefined) {
    throw new Error(`Do not pass both a positional issue ID and --id for '${cmdName}'`)
  }

  const positional = positionalValues(flags["_"])
  if (positional.length !== 1) {
    throw new Error(`Command '${cmdName}' accepts exactly one positional issue ID`)
  }

  const [issueId] = positional
  const normalized: ParsedFlags = { ...flags, "--id": issueId }
  delete normalized["_"]
  return normalized
}

function resolveCommand(args: string[]): { cmdName: string; cmd: Command; flagStart: number } {
  const [firstArg, secondArg] = args
  if (firstArg === undefined) {
    throw new Error("No command provided")
  }

  const twoWord = secondArg !== undefined ? `${firstArg} ${secondArg}` : undefined
  if (twoWord !== undefined) {
    const twoWordCommand = commands[twoWord]
    if (twoWordCommand !== undefined) {
      return { cmdName: twoWord, cmd: twoWordCommand, flagStart: 2 }
    }
  }

  const oneWordCommand = commands[firstArg]
  if (oneWordCommand !== undefined) {
    return { cmdName: firstArg, cmd: oneWordCommand, flagStart: 1 }
  }

  const twoWordCmds = Object.keys(commands).filter((key) => key.startsWith(`${firstArg} `))
  if (twoWordCmds.length > 0) {
    throw new Error(
      `Unknown command '${firstArg}'. Available: ${twoWordCmds.join(", ")}. Run 'task --help' for all commands`
    )
  }

  throw new Error(`Unknown command '${firstArg}'. Run 'task --help' for available commands`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const firstArg = args[0]

  if (args.length === 0 || isHelp(firstArg)) {
    printHelp()
    return
  }

  const { cmdName, cmd, flagStart } = resolveCommand(args)
  if (isHelp(args[flagStart])) {
    printCommandHelp(cmdName, cmd)
    return
  }

  const flags = normalizeCommandFlags(cmdName, cmd, parseFlags(args.slice(flagStart), cmd.flags))
  const result = await cmd.run(flags)
  process.stdout.write(formatResult(result, flags))
}

void (async () => {
  try {
    await main()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(JSON.stringify({ error: message }))
    process.exit(1)
  }
})()
