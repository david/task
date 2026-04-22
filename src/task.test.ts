import { describe, test, expect } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { commands } from "./commands-registry"
import { expectJsonObject } from "./commands-test-helpers"
import { parseJsonText } from "./infrastructure/json"
import { jsonValueSchema } from "./json-schema"
import { parseFlags, formatResult, normalizeCommandFlags } from "./task"
import type { Command } from "./types"

function registeredCommand(name: string): Command {
  const command = commands[name]
  if (command === undefined) {
    throw new Error(`Missing test command '${name}'`)
  }
  return command
}

function parseErrorJson(stderr: string): { error: string } {
  const parsedValue = parseJsonText(
    stderr,
    jsonValueSchema,
    "Expected stderr JSON value",
    "Expected stderr JSON value"
  )
  const parsed = expectJsonObject(parsedValue)
  const errorValue = parsed["error"]
  if (typeof errorValue !== "string") {
    throw new Error("Expected stderr JSON error string")
  }
  return { error: errorValue }
}

describe("parseFlags basics", () => {
  test("single flag with value", () => {
    expect(parseFlags(["--status", "ready"])).toEqual({ "--status": "ready" })
  })

  test("boolean flag (no value)", () => {
    expect(parseFlags(["--all"], registeredCommand("search").flags)).toEqual({ "--all": "true" })
  })

  test("multiple flags", () => {
    expect(parseFlags(["--status", "ready", "--priority", "p0"])).toEqual({
      "--status": "ready",
      "--priority": "p0",
    })
  })

  test("empty argv returns empty object", () => {
    expect(parseFlags([])).toEqual({})
  })

  test("--flag=value form throws with suggestion", () => {
    expect(() => parseFlags(["--status=ready"])).toThrow(
      "Unsupported flag format '--status=ready'. Use '--status ready' (space-separated)"
    )
  })
})

describe("parseFlags repeated values and positionals", () => {
  test("repeated flag collects values into array", () => {
    expect(parseFlags(["--where", "a", "--where", "b"])).toEqual({
      "--where": ["a", "b"],
    })
  })

  test("single flag still returns string, not array", () => {
    expect(parseFlags(["--where", "a"])).toEqual({ "--where": "a" })
  })

  test("three repeated flags collects all values", () => {
    expect(parseFlags(["--where", "a", "--where", "b", "--where", "c"])).toEqual({
      "--where": ["a", "b", "c"],
    })
  })

  test("mixed repeated and single flags", () => {
    expect(parseFlags(["--where", "a", "--status", "ready", "--where", "b"])).toEqual({
      "--where": ["a", "b"],
      "--status": "ready",
    })
  })

  test("collects positional args under _", () => {
    expect(parseFlags(["packet", "session", "--limit", "5"], registeredCommand("search").flags)).toEqual({
      _: ["packet", "session"],
      "--limit": "5",
    })
  })

  test("switch flag before positional search text preserves the query", () => {
    expect(parseFlags(["--all", "rebuild", "child"], registeredCommand("search").flags)).toEqual({
      "--all": "true",
      _: ["rebuild", "child"],
    })
  })
})

const positionalIdCommand: Command = {
  description: "Show issue details",
  usage: "task show <id>",
  flags: {},
  examples: [],
  positionalId: true,
  run: async () => ({ ok: true }),
}

describe("normalizeCommandFlags positional ids", () => {
  test("maps a single positional arg to --id for positional-id commands", () => {
    expect(normalizeCommandFlags("show", positionalIdCommand, { _: "ab12", "--summary": "true" })).toEqual({
      "--id": "ab12",
      "--summary": "true",
    })
  })

  test("preserves positional id after a switch flag", () => {
    const showCommand = registeredCommand("show")
    const parsed = parseFlags(["--summary", "ab12"], showCommand.flags)
    expect(parsed).toEqual({ "--summary": "true", _: "ab12" })
    expect(normalizeCommandFlags("show", showCommand, parsed)).toEqual({
      "--id": "ab12",
      "--summary": "true",
    })
  })

  test("leaves positional args alone for commands without positional-id support", () => {
    const searchCommand: Command = {
      description: "Search issues",
      usage: "task search <query>",
      flags: {},
      examples: [],
      run: async () => ({ ok: true }),
    }
    expect(normalizeCommandFlags("search", searchCommand, { _: ["packet", "session"] })).toEqual({
      _: ["packet", "session"],
    })
  })
})

describe("normalizeCommandFlags validation", () => {
  test("rejects mixing positional id with --id", () => {
    expect(() =>
      normalizeCommandFlags("show", positionalIdCommand, { _: "ab12", "--id": "cd34" })
    ).toThrow("Do not pass both a positional issue ID and --id for 'show'")
  })

  test("rejects multiple positional args for positional-id commands", () => {
    expect(() =>
      normalizeCommandFlags("show", positionalIdCommand, { _: ["ab12", "extra"] })
    ).toThrow("Command 'show' accepts exactly one positional issue ID")
  })
})

describe("formatResult", () => {
  test("formats default output as JSON", () => {
    expect(formatResult({ ok: true }, {})).toBe('{"ok":true}')
  })

  test("formats arrays as JSONL when --jsonl is set", () => {
    expect(formatResult([{ id: 1 }, { id: 2 }], { "--jsonl": "true" })).toBe(
      '{"id":1}\n{"id":2}'
    )
  })

  test("formats empty arrays as empty JSONL output", () => {
    expect(formatResult([], { "--jsonl": "true" })).toBe("")
  })

  test("leaves non-array results as JSON even with --jsonl", () => {
    expect(formatResult({ ok: true }, { "--jsonl": "true" })).toBe('{"ok":true}')
  })
})

const repoRoot = import.meta.dir
const taskScript = join(repoRoot, "task.ts")
const runTask = (cwd: string, ...args: string[]) =>
  Bun.spawnSync(["bun", taskScript, ...args], {
    cwd,
  })

describe("task subprocess root help", () => {
  test("--help exits 0 and shows task", () => {
    const result = runTask(repoRoot, "--help")
    expect(result.exitCode).toBe(0)
    const stdout = result.stdout.toString()
    expect(stdout).toContain("task")
    expect(stdout).toContain("Commands:")
    expect(stdout).toContain("related")
    expect(stdout).toContain("search")
    expect(stdout).toContain("bootstrap")
    expect(stdout).toContain("set")
    expect(stdout).toContain("get")
    expect(stdout).toContain("delete")
    expect(stdout).toContain("phase next")
    expect(stdout).toContain("phase set")
    expect(stdout).toContain("legacy import")
    expect(stdout).toContain("owner")
    expect(stdout).not.toContain("store set")
    expect(stdout).not.toContain("store get")
    expect(stdout).not.toContain("store keys")
    expect(stdout).not.toContain("store delete")
  })

  test("-h exits 0 same as --help", () => {
    const result = runTask(repoRoot, "-h")
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toContain("Commands:")
  })
})

describe("task subprocess command help", () => {
  test("create --help exits 0 and shows flags", () => {
    const result = runTask(repoRoot, "create", "--help")
    expect(result.exitCode).toBe(0)
    const stdout = result.stdout.toString()
    expect(stdout).toContain("Flags:")
    expect(stdout).toContain("--title")
    expect(stdout).toContain("--parent")
  })

  test("legacy import --help exits 0 and shows flags", () => {
    const result = runTask(repoRoot, "legacy", "import", "--help")
    expect(result.exitCode).toBe(0)
    const stdout = result.stdout.toString()
    expect(stdout).toContain("--source")
    expect(stdout).toContain("legacy tracker")
  })

  test("bootstrap --help exits 0 and shows workflow-doc flags", () => {
    const result = runTask(repoRoot, "bootstrap", "--help")
    expect(result.exitCode).toBe(0)
    const stdout = result.stdout.toString()
    expect(stdout).toContain("--root")
    expect(stdout).toContain("--force")
    expect(stdout).toContain("workflow")
  })

  test("set --help exits 0 and shows document flags", () => {
    const result = runTask(repoRoot, "set", "--help")
    expect(result.exitCode).toBe(0)
    const stdout = result.stdout.toString()
    expect(stdout).toContain("--key")
    expect(stdout).toContain("--value")
    expect(stdout).toContain("--file")
    expect(stdout).toContain("document")
  })
})

describe("task subprocess document commands", () => {
  test("save nested content, read exact, read subtree, delete subtree, and confirm removal", () => {
    const cwd = mkdtempSync(join(tmpdir(), "task-cli-docs-"))

    const created = runTask(cwd, "create", "--title", "Document CLI")
    expect(created.exitCode).toBe(0)
    const createdJson = expectJsonObject(parseJsonText(
      created.stdout.toString(),
      jsonValueSchema,
      "Expected create stdout JSON value",
      "Expected create stdout JSON value"
    ))
    const id = createdJson["id"]
    expect(typeof id).toBe("string")
    if (typeof id !== "string") {
      throw new Error("Expected create result to include string id")
    }

    const saved = runTask(cwd, "set", id, "--key", "research/notes/today", "--value", "hello")
    expect(saved.exitCode).toBe(0)
    expect(saved.stdout.toString()).toBe('{"stored":true}')

    const exact = runTask(cwd, "get", id, "--key", "research/notes/today")
    expect(exact.exitCode).toBe(0)
    expect(exact.stdout.toString()).toBe('{"entries":{"research":{"entries":{"notes":{"entries":{"today":{"value":"hello"}}}}}}}')

    const subtree = runTask(cwd, "get", id, "--key", "research/")
    expect(subtree.exitCode).toBe(0)
    expect(subtree.stdout.toString()).toBe('{"entries":{"research":{"entries":{"notes":{"entries":{"today":{"value":"hello"}}}}}}}')

    const deleted = runTask(cwd, "delete", id, "--key", "research/")
    expect(deleted.exitCode).toBe(0)
    expect(deleted.stdout.toString()).toBe('{"deleted":true,"kind":"subtree"}')

    const root = runTask(cwd, "get", id, "--key", "/")
    expect(root.exitCode).toBe(0)
    expect(root.stdout.toString()).toBe('{"entries":{}}')
  })
})

describe("task subprocess command errors", () => {
  test("unknown command exits 1 with error JSON", () => {
    const result = runTask(repoRoot, "foo")
    expect(result.exitCode).toBe(1)
    const err = parseErrorJson(result.stderr.toString())
    expect(err.error).toContain("Unknown command")
    expect(err.error).toContain("foo")
    expect(result.stdout.toString()).toBe("")
  })

  test("partial two-word command lists available subcommands", () => {
    const result = runTask(repoRoot, "meta")
    expect(result.exitCode).toBe(1)
    const err = parseErrorJson(result.stderr.toString())
    expect(err.error).toContain("Unknown command 'meta'")
    expect(err.error).toContain("meta set")
    expect(err.error).toContain("meta get")
  })

  test("partial phase command lists phase subcommands", () => {
    const result = runTask(repoRoot, "phase")
    expect(result.exitCode).toBe(1)
    const err = parseErrorJson(result.stderr.toString())
    expect(err.error).toContain("Unknown command 'phase'")
    expect(err.error).toContain("phase next")
    expect(err.error).toContain("phase set")
  })

  test("partial legacy command lists legacy subcommands", () => {
    const result = runTask(repoRoot, "legacy")
    expect(result.exitCode).toBe(1)
    const err = parseErrorJson(result.stderr.toString())
    expect(err.error).toContain("Unknown command 'legacy'")
    expect(err.error).toContain("legacy import")
  })
})
