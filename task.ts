import type { Command } from "./types"
import { commands } from "./commands"

export type ParsedFlags = Record<string, string | string[] | undefined>

export function parseFlags(argv: string[]): ParsedFlags {
  const flags: ParsedFlags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith("--")) {
      if (arg.includes("=")) {
        throw new Error(
          `Unsupported flag format '${arg}'. Use '${arg.split("=")[0]} ${arg.split("=")[1]}' (space-separated)`
        )
      }
      let value: string
      const next = argv[i + 1]
      if (next && !next.startsWith("--")) {
        value = next
        i++
      } else {
        value = "true"
      }
      const existing = flags[arg]
      if (existing === undefined) {
        flags[arg] = value
      } else if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        flags[arg] = [existing, value]
      }
    }
  }
  return flags
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
  lines.push("  task show --id ab12                                          # Read an issue")
  lines.push("  task list                                                    # List open issues")
  lines.push("  task list --where phase=research                             # Filter by metadata")
  lines.push("  task list --label cli                                        # Filter by label")
  lines.push("  task update label --id ab12 --add cli                        # Add a label")
  lines.push("  task update refs --id ab12 --add m85s                        # Add a ref")
  lines.push("  task store get --id ab12 --store research --key summary      # Get stored research")
  lines.push('  task store set --id ab12 --store research --key summary --value "..."  # Save research')
  lines.push("  task meta set --id ab12 --key phase --value architect        # Update issue phase")
  lines.push("")
  lines.push('Run "task <command> --help" for details.')
  console.log(lines.join("\n"))
}

function printCommandHelp(cmdName: string, cmd: Command): void {
  const lines = [
    cmd.description,
    "",
    "Usage:",
    `  ${cmd.usage}`,
    "",
    "Flags:",
  ]
  const flagEntries = Object.entries(cmd.flags)
  if (flagEntries.length === 0) {
    lines.push("  (none)")
  } else {
    for (const [flag, def] of flagEntries) {
      const req = def.required ? " (required)" : ""
      const dflt = def.default ? ` (default: ${def.default})` : ""
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

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Root help
  if (args.length === 0 || isHelp(args[0])) {
    printHelp()
    return
  }

  // Two-level dispatch: try "word1 word2" key first, then fall back to "word1"
  let cmdName: string
  let cmd: Command | undefined
  let flagStart: number

  const twoWord = args[1] !== undefined ? `${args[0]} ${args[1]}` : undefined
  if (twoWord && commands[twoWord]) {
    cmdName = twoWord
    cmd = commands[twoWord]
    flagStart = 2
  } else {
    cmdName = args[0]
    cmd = commands[cmdName]
    flagStart = 1
  }

  if (!cmd) {
    // Check if the single word is a prefix of any two-word commands
    const prefix = args[0]
    const twoWordCmds = Object.keys(commands).filter((k) => k.startsWith(prefix + " "))
    if (twoWordCmds.length > 0) {
      throw new Error(
        `Unknown command '${prefix}'. Available: ${twoWordCmds.join(", ")}. Run 'task --help' for all commands`
      )
    }
    throw new Error(`Unknown command '${cmdName}'. Run 'task --help' for available commands`)
  }

  // Command help
  if (isHelp(args[flagStart])) {
    printCommandHelp(cmdName, cmd)
    return
  }

  const flags = parseFlags(args.slice(flagStart))
  const result = await cmd.run(flags)
  process.stdout.write(JSON.stringify(result))
}

main().catch((err: Error) => {
  process.stderr.write(JSON.stringify({ error: err.message }))
  process.exit(1)
})
