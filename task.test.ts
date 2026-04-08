import { describe, test, expect } from "bun:test"
import { parseFlags } from "./task"

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
})

describe("task subprocess", () => {
  const repoRoot = import.meta.dir + "/.."
  const run = (...args: string[]) =>
    Bun.spawnSync(["bun", "task/task.ts", ...args], {
      cwd: repoRoot,
    })

  test("--help exits 0 and shows task", () => {
    const result = run("--help")
    expect(result.exitCode).toBe(0)
    const stdout = result.stdout.toString()
    expect(stdout).toContain("task")
    expect(stdout).toContain("Commands:")
  })

  test("-h exits 0 same as --help", () => {
    const result = run("-h")
    expect(result.exitCode).toBe(0)
    const stdout = result.stdout.toString()
    expect(stdout).toContain("task")
    expect(stdout).toContain("Commands:")
  })

  test("create --help exits 0 and shows flags", () => {
    const result = run("create", "--help")
    expect(result.exitCode).toBe(0)
    const stdout = result.stdout.toString()
    expect(stdout).toContain("Flags:")
    expect(stdout).toContain("--title")
  })

  test("unknown command exits 1 with error JSON", () => {
    const result = run("foo")
    expect(result.exitCode).toBe(1)
    const stderr = result.stderr.toString()
    const err = JSON.parse(stderr)
    expect(err.error).toContain("Unknown command")
    expect(err.error).toContain("foo")
    // stdout must be empty on error
    expect(result.stdout.toString()).toBe("")
  })

  test("partial two-word command lists available subcommands", () => {
    const result = run("meta")
    expect(result.exitCode).toBe(1)
    const stderr = result.stderr.toString()
    const err = JSON.parse(stderr)
    expect(err.error).toContain("Unknown command 'meta'")
    expect(err.error).toContain("meta set")
    expect(err.error).toContain("meta get")
  })
})
