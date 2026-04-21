import { describe, test, expect } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseFlags, formatResult, normalizeCommandFlags } from "./task"
import type { Command } from "./src/types"

function parseError(stderr: string): { error: string } {
  return JSON.parse(stderr) as { error: string }
}

describe("parseFlags", () => {
  test("single flag with value", () => {
    expect(parseFlags(["--status", "ready"])).toEqual({ "--status": "ready" })
  })

  test("boolean flag (no value)", () => {
    expect(parseFlags(["--all"])).toEqual({ "--all": "true" })
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
    expect(parseFlags(["packet", "session", "--limit", "5"])).toEqual({
      _: ["packet", "session"],
      "--limit": "5",
    })
  })
})

describe("normalizeCommandFlags", () => {
  const positionalIdCommand: Command = {
    description: "Show issue details",
    usage: "task show <id>",
    flags: {},
    examples: [],
    positionalId: true,
    run: async () => ({ ok: true }),
  }

  test("maps a single positional arg to --id for positional-id commands", () => {
    expect(normalizeCommandFlags("show", positionalIdCommand, { _: "ab12", "--summary": "true" })).toEqual({
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

describe("task subprocess", () => {
  const repoRoot = import.meta.dir
  const taskScript = join(repoRoot, "task.ts")
  const run = (cwd: string, ...args: string[]) =>
    Bun.spawnSync(["bun", taskScript, ...args], {
      cwd,
    })

  test("--help exits 0 and shows the approved document surface", () => {
    const result = run(repoRoot, "--help")
    expect(result.exitCode).toBe(0)
    const stdout = result.stdout.toString()
    expect(stdout).toContain("task")
    expect(stdout).toContain("Commands:")
    expect(stdout).toContain("related")
    expect(stdout).toContain("search")
    expect(stdout).toContain("set")
    expect(stdout).toContain("get")
    expect(stdout).toContain("delete")
    expect(stdout).not.toContain("store set")
    expect(stdout).not.toContain("store get")
    expect(stdout).not.toContain("store keys")
    expect(stdout).not.toContain("store delete")
  })

  test("-h exits 0 same as --help", () => {
    const result = run(repoRoot, "-h")
    expect(result.exitCode).toBe(0)
    const stdout = result.stdout.toString()
    expect(stdout).toContain("task")
    expect(stdout).toContain("Commands:")
  })

  test("set --help exits 0 and shows document flags", () => {
    const result = run(repoRoot, "set", "--help")
    expect(result.exitCode).toBe(0)
    const stdout = result.stdout.toString()
    expect(stdout).toContain("Flags:")
    expect(stdout).toContain("--key")
    expect(stdout).toContain("--value")
    expect(stdout).toContain("--file")
    expect(stdout).toContain("document")
  })

  test("document commands work through bun task.ts", () => {
    const cwd = mkdtempSync(join(tmpdir(), "task-root-cli-docs-"))

    const created = run(cwd, "create", "--title", "Document CLI")
    expect(created.exitCode).toBe(0)
    const createdJson = JSON.parse(created.stdout.toString()) as { id: string }
    expect(typeof createdJson.id).toBe("string")

    const saved = run(cwd, "set", createdJson.id, "--key", "research/notes/today", "--value", "hello")
    expect(saved.exitCode).toBe(0)
    expect(saved.stdout.toString()).toBe('{"stored":true}')

    const exact = run(cwd, "get", createdJson.id, "--key", "research/notes/today")
    expect(exact.exitCode).toBe(0)
    expect(exact.stdout.toString()).toBe(
      '{"entries":{"research":{"entries":{"notes":{"entries":{"today":{"value":"hello"}}}}}}}'
    )
  })

  test("invalid exact document selectors fail clearly through bun task.ts", () => {
    const cwd = mkdtempSync(join(tmpdir(), "task-root-cli-invalid-key-"))

    const created = run(cwd, "create", "--title", "Invalid Path")
    expect(created.exitCode).toBe(0)
    const createdJson = JSON.parse(created.stdout.toString()) as { id: string }

    const invalid = run(cwd, "set", createdJson.id, "--key", "research/", "--value", "hello")
    expect(invalid.exitCode).toBe(1)
    const err = parseError(invalid.stderr.toString())
    expect(err.error).toContain("Subtree selector 'research/' is not allowed here")
    expect(invalid.stdout.toString()).toBe("")
  })

  test("unknown command exits 1 with error JSON", () => {
    const result = run(repoRoot, "foo")
    expect(result.exitCode).toBe(1)
    const err = parseError(result.stderr.toString())
    expect(err.error).toContain("Unknown command")
    expect(err.error).toContain("foo")
    expect(result.stdout.toString()).toBe("")
  })

  test("partial two-word command lists available subcommands", () => {
    const result = run(repoRoot, "meta")
    expect(result.exitCode).toBe(1)
    const err = parseError(result.stderr.toString())
    expect(err.error).toContain("Unknown command 'meta'")
    expect(err.error).toContain("meta set")
    expect(err.error).toContain("meta get")
  })
})
