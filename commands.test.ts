import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { issueCreate, issueShow, issueList, issueClose, issueMetaSet, issueMetaGet, updateArrayField, storeSet, storeGet, storeKeys, resolveIssue, requireFlag } from "./commands"

type IssueResult = { id: string; [k: string]: unknown }

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "issue-test-"))
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("requireFlag", () => {
  test("returns string value", () => {
    expect(requireFlag({ "--title": "hello" }, "--title")).toBe("hello")
  })

  test("returns first element of array", () => {
    expect(requireFlag({ "--title": ["a", "b"] }, "--title")).toBe("a")
  })

  test("throws on missing flag", () => {
    expect(() => requireFlag({}, "--title")).toThrow("--title is required")
  })
})

describe("issueCreate", () => {
  test("generates unique ID and writes well-formed issue.json", async () => {
    const result = (await issueCreate({ "--title": "My First Issue" }, root)) as IssueResult
    expect(result.id).toMatch(/^[a-z0-9]{4}-my-first-issue$/)
    expect(result.title).toBe("My First Issue")
    expect(result.status).toBe("open")
    expect(result.phase).toBe("research")
    expect(result.priority).toBe(2)
    expect(result.description).toBe("")
    expect(result.refs).toEqual([])
    expect(result.created).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).not.toHaveProperty("path")

    // Verify file on disk via resolveIssue
    const { path } = resolveIssue(result.id, root)
    const data = JSON.parse(readFileSync(join(path, "issue.json"), "utf-8"))
    expect(data.title).toBe("My First Issue")
    expect(data.status).toBe("open")
  })

  test("with --github-issue includes github_issue field", async () => {
    const result = (await issueCreate({ "--title": "GH Issue", "--github-issue": "42" }, root)) as IssueResult
    expect(result.github_issue).toBe(42)
    const { path } = resolveIssue(result.id, root)
    const data = JSON.parse(readFileSync(join(path, "issue.json"), "utf-8"))
    expect(data.github_issue).toBe(42)
  })

  test("without --github-issue omits github_issue field", async () => {
    const result = (await issueCreate({ "--title": "No GH" }, root)) as IssueResult
    expect(result).not.toHaveProperty("github_issue")
    const { path } = resolveIssue(result.id, root)
    const data = JSON.parse(readFileSync(join(path, "issue.json"), "utf-8"))
    expect(data).not.toHaveProperty("github_issue")
  })

  test("with --priority overrides default", async () => {
    const result = (await issueCreate({ "--title": "Urgent", "--priority": "0" }, root)) as IssueResult
    expect(result.priority).toBe(0)
    const { path } = resolveIssue(result.id, root)
    const data = JSON.parse(readFileSync(join(path, "issue.json"), "utf-8"))
    expect(data.priority).toBe(0)
  })

  test("rejects missing --title", async () => {
    await expect(issueCreate({}, root)).rejects.toThrow("--title is required")
  })

  test("auto-creates root dirs if missing", async () => {
    const freshRoot = join(root, "fresh-sub")
    const result = (await issueCreate({ "--title": "Auto Dir" }, freshRoot)) as IssueResult
    expect(result.id).toMatch(/^[a-z0-9]{4}-auto-dir$/)
  })

  test("with --label stores labels array", async () => {
    const result = (await issueCreate({ "--title": "Labeled", "--label": ["cli", "bug"] }, root)) as IssueResult
    expect(result.labels).toEqual(["cli", "bug"])
    const { path } = resolveIssue(result.id, root)
    const data = JSON.parse(readFileSync(join(path, "issue.json"), "utf-8"))
    expect(data.labels).toEqual(["cli", "bug"])
  })

  test("without --label defaults to empty array", async () => {
    const result = (await issueCreate({ "--title": "No Labels" }, root)) as IssueResult
    expect(result.labels).toEqual([])
  })

  test("single --label stores as array", async () => {
    const result = (await issueCreate({ "--title": "One Label", "--label": "cli" }, root)) as IssueResult
    expect(result.labels).toEqual(["cli"])
  })

  test("slug derives from title", async () => {
    const result = (await issueCreate({ "--title": "Hello World! 123" }, root)) as IssueResult
    const { path } = resolveIssue(result.id, root)
    expect(path).toMatch(/hello-world-123/)
  })
})

describe("resolveIssue", () => {
  test("finds active issue by ID", async () => {
    const created = (await issueCreate({ "--title": "Resolve Test" }, root)) as IssueResult
    const resolved = resolveIssue(created.id, root)
    expect(resolved.path).toContain(created.id)
    expect(resolved.archived).toBe(false)
  })

  test("throws for unknown ID", () => {
    expect(() => resolveIssue("zzzz", root)).toThrow("Issue 'zzzz' not found")
  })

  test("rejects invalid ID format", () => {
    expect(() => resolveIssue("../bad", root)).toThrow()
  })

  test("rejects ID with uppercase", () => {
    expect(() => resolveIssue("ABCD", root)).toThrow()
  })
})

describe("issueShow", () => {
  test("finds issue by ID and returns metadata with empty stores", async () => {
    const created = (await issueCreate({ "--title": "Show Test" }, root)) as IssueResult
    const result = await issueShow({ "--id": created.id }, root)
    expect(result.id).toBe(created.id)
    expect(result.metadata.title).toBe("Show Test")
    expect(result.stores).toEqual({})
  })

  test("finds archived issues", async () => {
    const created = (await issueCreate({ "--title": "Archive Show" }, root)) as IssueResult
    await issueClose({ "--id": created.id }, root)
    const result = await issueShow({ "--id": created.id }, root)
    expect(result.metadata.status).toBe("closed")
  })

  test("with store directories lists store names and keys", async () => {
    const created = (await issueCreate({ "--title": "Store Test" }, root)) as IssueResult
    const fakeStdin = (s: string) => () => Promise.resolve(s)
    await storeSet({ "--id": created.id, "--store": "tasks", "--key": "01-setup.md" }, fakeStdin("content"), root)
    await storeSet({ "--id": created.id, "--store": "tasks", "--key": "02-impl.md" }, fakeStdin("content"), root)

    const result = await issueShow({ "--id": created.id }, root)
    expect(result.stores.tasks).toEqual(["01-setup.md", "02-impl.md"])
  })

  test("throws for unknown ID", async () => {
    await expect(issueShow({ "--id": "zzzz" }, root)).rejects.toThrow("Issue 'zzzz' not found")
  })
})

describe("ambiguous ID", () => {
  test("throws with list of matches", () => {
    const ambRoot = join(root, "ambig")
    mkdirSync(join(ambRoot, "aaaa-first"), { recursive: true })
    writeFileSync(join(ambRoot, "aaaa-first", "issue.json"), "{}")
    mkdirSync(join(ambRoot, "aaaa-second"), { recursive: true })
    writeFileSync(join(ambRoot, "aaaa-second", "issue.json"), "{}")

    expect(() => resolveIssue("aaaa", ambRoot)).toThrow(/Ambiguous.*aaaa/)
  })
})

describe("issueList", () => {
  let listRoot: string

  beforeAll(async () => {
    listRoot = join(root, "list-test")
    await issueCreate({ "--title": "Open One" }, listRoot)
    await issueCreate({ "--title": "Open Two" }, listRoot)
    const toClose = (await issueCreate({ "--title": "Closed One" }, listRoot)) as IssueResult
    await issueClose({ "--id": toClose.id }, listRoot)
  })

  test("returns open issues", async () => {
    const result = await issueList({}, listRoot)
    const titles = result.map((i) => i.title as string)
    expect(titles).toContain("Open One")
    expect(titles).toContain("Open Two")
  })

  test("excludes archived by default", async () => {
    const result = await issueList({}, listRoot)
    const titles = result.map((i) => i.title as string)
    expect(titles).not.toContain("Closed One")
  })

  test("--all includes archived", async () => {
    const result = await issueList({ "--all": "true" }, listRoot)
    const titles = result.map((i) => i.title as string)
    expect(titles).toContain("Closed One")
  })

  test("--where status=open filters correctly", async () => {
    const result = await issueList({ "--where": "status=open" }, listRoot)
    for (const item of result) {
      expect(item.status).toBe("open")
    }
  })

  test("multiple --where applies AND logic", async () => {
    const result = await issueList({ "--where": ["status=open", "phase=research"] }, listRoot)
    for (const item of result) {
      expect(item.status).toBe("open")
      expect(item.phase).toBe("research")
    }
  })

  test("results sorted by priority ascending", async () => {
    const sortRoot = join(root, "sort-test")
    await issueCreate({ "--title": "Low", "--priority": "3" }, sortRoot)
    await issueCreate({ "--title": "High", "--priority": "0" }, sortRoot)
    await issueCreate({ "--title": "Default" }, sortRoot)
    await issueCreate({ "--title": "Medium", "--priority": "1" }, sortRoot)

    const result = await issueList({}, sortRoot)
    const titles = result.map((i) => i.title as string)
    expect(titles).toEqual(["High", "Medium", "Default", "Low"])
  })

  test("issues without priority field sort last", async () => {
    const legacyRoot = join(root, "legacy-test")
    // Create a normal issue
    await issueCreate({ "--title": "Normal", "--priority": "1" }, legacyRoot)
    // Create a legacy issue manually (no priority field)
    mkdirSync(join(legacyRoot, "zzzz-legacy"), { recursive: true })
    writeFileSync(
      join(legacyRoot, "zzzz-legacy", "issue.json"),
      JSON.stringify({ title: "Legacy", status: "open", phase: "research" })
    )

    const result = await issueList({}, legacyRoot)
    const titles = result.map((i) => i.title as string)
    expect(titles).toEqual(["Normal", "Legacy"])
  })
})

describe("issueClose", () => {
  test("moves dir to archive and sets status=closed", async () => {
    const created = (await issueCreate({ "--title": "To Close" }, root)) as IssueResult
    const result = await issueClose({ "--id": created.id }, root)
    expect(result.closed).toBe(true)

    const shown = await issueShow({ "--id": created.id }, root)
    expect(shown.metadata.status).toBe("closed")
  })

  test("on already-archived returns already_closed", async () => {
    const created = (await issueCreate({ "--title": "Double Close" }, root)) as IssueResult
    await issueClose({ "--id": created.id }, root)
    const result = await issueClose({ "--id": created.id }, root)
    expect(result.already_closed).toBe(true)
  })
})

describe("meta", () => {
  test("issueMetaSet adds a new key and returns full issue.json contents", async () => {
    const created = (await issueCreate({ "--title": "Meta Test" }, root)) as IssueResult
    const result = (await issueMetaSet({ "--id": created.id, "--key": "phase", "--value": "architect" }, root)) as Record<string, any>
    expect(result.phase).toBe("architect")
    expect(result.title).toBe("Meta Test")

    // Verify on disk
    const { path } = resolveIssue(created.id, root)
    const data = JSON.parse(readFileSync(join(path, "issue.json"), "utf-8"))
    expect(data.phase).toBe("architect")
  })

  test("issueMetaSet overwrites an existing key", async () => {
    const created = (await issueCreate({ "--title": "Meta Overwrite" }, root)) as IssueResult
    await issueMetaSet({ "--id": created.id, "--key": "phase", "--value": "architect" }, root)
    const result = (await issueMetaSet({ "--id": created.id, "--key": "phase", "--value": "implement" }, root)) as Record<string, any>
    expect(result.phase).toBe("implement")
  })

  test("issueMetaSet on archived issue works", async () => {
    const created = (await issueCreate({ "--title": "Meta Archive" }, root)) as IssueResult
    await issueClose({ "--id": created.id }, root)
    const result = (await issueMetaSet({ "--id": created.id, "--key": "priority", "--value": "high" }, root)) as Record<string, any>
    expect(result.priority).toBe("high")
  })

  test("issueMetaGet returns value for existing key", async () => {
    const created = (await issueCreate({ "--title": "Meta Get" }, root)) as IssueResult
    await issueMetaSet({ "--id": created.id, "--key": "priority", "--value": "low" }, root)
    const result = await issueMetaGet({ "--id": created.id, "--key": "priority" }, root)
    expect(result.value).toBe("low")
  })

  test("issueMetaGet returns null for missing key", async () => {
    const created = (await issueCreate({ "--title": "Meta Get Missing" }, root)) as IssueResult
    const result = await issueMetaGet({ "--id": created.id, "--key": "nonexistent" }, root)
    expect(result.value).toBeNull()
  })

  test("issueMetaSet missing required flags throws", async () => {
    const created = (await issueCreate({ "--title": "Meta Flags" }, root)) as IssueResult
    await expect(issueMetaSet({ "--id": created.id, "--key": "k" }, root)).rejects.toThrow("--value is required")
    await expect(issueMetaSet({ "--id": created.id, "--value": "v" }, root)).rejects.toThrow("--key is required")
    await expect(issueMetaSet({ "--key": "k", "--value": "v" }, root)).rejects.toThrow("--id is required")
  })
})

describe("updateArrayField", () => {
  test("adds values to empty field", async () => {
    const created = (await issueCreate({ "--title": "Update Add" }, root)) as IssueResult
    const result = await updateArrayField({ "--id": created.id, "--add": ["cli", "bug"] }, "labels", root)
    expect(result.values).toEqual(["cli", "bug"])
    expect(result.field).toBe("labels")
  })

  test("removes values", async () => {
    const created = (await issueCreate({ "--title": "Update Remove", "--label": ["cli", "bug", "pdf"] }, root)) as IssueResult
    const result = await updateArrayField({ "--id": created.id, "--remove": "bug" }, "labels", root)
    expect(result.values).toEqual(["cli", "pdf"])
  })

  test("add + remove in same call (remove first, then add)", async () => {
    const created = (await issueCreate({ "--title": "Update Both", "--label": ["old"] }, root)) as IssueResult
    const result = await updateArrayField({ "--id": created.id, "--remove": "old", "--add": "new" }, "labels", root)
    expect(result.values).toEqual(["new"])
  })

  test("deduplicates on add", async () => {
    const created = (await issueCreate({ "--title": "Update Dedup", "--label": ["cli"] }, root)) as IssueResult
    const result = await updateArrayField({ "--id": created.id, "--add": "cli" }, "labels", root)
    expect(result.values).toEqual(["cli"])
  })

  test("initializes missing field as empty array", async () => {
    const created = (await issueCreate({ "--title": "Update Missing Field" }, root)) as IssueResult
    // refs exists but let's test with a hypothetical field
    const result = await updateArrayField({ "--id": created.id, "--add": "val" }, "tags", root)
    expect(result.values).toEqual(["val"])
  })

  test("works on refs field", async () => {
    const created = (await issueCreate({ "--title": "Update Refs" }, root)) as IssueResult
    const result = await updateArrayField({ "--id": created.id, "--add": ["m85s", "x0h2"] }, "refs", root)
    expect(result.values).toEqual(["m85s", "x0h2"])
  })

  test("throws when neither --add nor --remove provided", async () => {
    const created = (await issueCreate({ "--title": "Update Neither" }, root)) as IssueResult
    await expect(updateArrayField({ "--id": created.id }, "labels", root)).rejects.toThrow(
      "At least one of --add or --remove is required"
    )
  })

  test("persists to disk", async () => {
    const created = (await issueCreate({ "--title": "Update Persist" }, root)) as IssueResult
    await updateArrayField({ "--id": created.id, "--add": "cli" }, "labels", root)
    const { path } = resolveIssue(created.id, root)
    const data = JSON.parse(readFileSync(join(path, "issue.json"), "utf-8"))
    expect(data.labels).toEqual(["cli"])
  })
})

describe("issueList --label filter", () => {
  let labelRoot: string

  beforeAll(async () => {
    labelRoot = join(root, "label-filter-test")
    await issueCreate({ "--title": "CLI Issue", "--label": ["cli", "bug"] }, labelRoot)
    await issueCreate({ "--title": "PDF Issue", "--label": ["pdf", "bug"] }, labelRoot)
    await issueCreate({ "--title": "No Labels", }, labelRoot)
  })

  test("filters by single label", async () => {
    const result = await issueList({ "--label": "cli" }, labelRoot)
    expect(result.map(i => i.title)).toEqual(["CLI Issue"])
  })

  test("multiple labels use AND logic", async () => {
    const result = await issueList({ "--label": ["bug"] }, labelRoot)
    const titles = result.map(i => i.title)
    expect(titles).toContain("CLI Issue")
    expect(titles).toContain("PDF Issue")
    expect(titles).not.toContain("No Labels")
  })

  test("multiple labels narrow results", async () => {
    const result = await issueList({ "--label": ["bug", "cli"] }, labelRoot)
    expect(result.map(i => i.title)).toEqual(["CLI Issue"])
  })

  test("no match returns empty", async () => {
    const result = await issueList({ "--label": "nonexistent" }, labelRoot)
    expect(result).toEqual([])
  })

  test("combines with --where", async () => {
    const result = await issueList({ "--label": "bug", "--where": "status=open" }, labelRoot)
    const titles = result.map(i => i.title)
    expect(titles).toContain("CLI Issue")
    expect(titles).toContain("PDF Issue")
  })
})

describe("store", () => {
  const fakeStdin = (content: string) => () => Promise.resolve(content)

  test("storeSet creates store directory and writes file", async () => {
    const created = (await issueCreate({ "--title": "Store Set Test" }, root)) as IssueResult
    const result = await storeSet(
      { "--id": created.id, "--store": "research", "--key": "summary" },
      fakeStdin("hello world"),
      root,
    )
    expect(result).toEqual({ stored: true })

    // Verify round-trip via storeGet
    const got = await storeGet({ "--id": created.id, "--store": "research", "--key": "summary" }, root)
    expect(got.value).toBe("hello world")
  })

  test("storeGet reads back the written content", async () => {
    const created = (await issueCreate({ "--title": "Store Get Test" }, root)) as IssueResult
    await storeSet(
      { "--id": created.id, "--store": "data", "--key": "notes" },
      fakeStdin("some notes"),
      root,
    )
    const result = await storeGet({ "--id": created.id, "--store": "data", "--key": "notes" }, root)
    expect(result).toEqual({ value: "some notes" })
  })

  test("storeGet returns null for missing key", async () => {
    const created = (await issueCreate({ "--title": "Store Get Missing Key" }, root)) as IssueResult
    // Create the store by writing a different key
    await storeSet({ "--id": created.id, "--store": "mystore", "--key": "exists" }, fakeStdin("x"), root)
    const result = await storeGet({ "--id": created.id, "--store": "mystore", "--key": "nope" }, root)
    expect(result).toEqual({ value: null })
  })

  test("storeGet returns null for missing store", async () => {
    const created = (await issueCreate({ "--title": "Store Get Missing Store" }, root)) as IssueResult
    const result = await storeGet({ "--id": created.id, "--store": "nonexistent", "--key": "nope" }, root)
    expect(result).toEqual({ value: null })
  })

  test("storeKeys lists all keys in a store", async () => {
    const created = (await issueCreate({ "--title": "Store Keys Test" }, root)) as IssueResult
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "alpha" }, fakeStdin("a"), root)
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "beta" }, fakeStdin("b"), root)
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "gamma" }, fakeStdin("c"), root)
    const result = await storeKeys({ "--id": created.id, "--store": "docs" }, root)
    expect(result.keys.sort()).toEqual(["alpha", "beta", "gamma"])
  })

  test("storeKeys returns empty array for missing store", async () => {
    const created = (await issueCreate({ "--title": "Store Keys Empty" }, root)) as IssueResult
    const result = await storeKeys({ "--id": created.id, "--store": "nope" }, root)
    expect(result).toEqual({ keys: [] })
  })

  test("store values round-trip unchanged (arbitrary content)", async () => {
    const created = (await issueCreate({ "--title": "Store Roundtrip" }, root)) as IssueResult
    const content = "line1\nline2\n\ttabbed\n🎉 emoji\nnull bytes: \x00"
    await storeSet({ "--id": created.id, "--store": "raw", "--key": "blob" }, fakeStdin(content), root)
    const result = await storeGet({ "--id": created.id, "--store": "raw", "--key": "blob" }, root)
    expect(result.value).toBe(content)
  })

  test("storeSet with --value flag stores the value", async () => {
    const created = (await issueCreate({ "--title": "Store Value Flag" }, root)) as IssueResult
    const neverCalled = () => { throw new Error("stdin should not be read") }
    await storeSet(
      { "--id": created.id, "--store": "notes", "--key": "quick", "--value": "simple string" },
      neverCalled,
      root,
    )
    const got = await storeGet({ "--id": created.id, "--store": "notes", "--key": "quick" }, root)
    expect(got.value).toBe("simple string")
  })

  test("storeSet with --file flag reads from file", async () => {
    const created = (await issueCreate({ "--title": "Store File Flag" }, root)) as IssueResult
    const tmpFile = join(root, "tmp-content.md")
    writeFileSync(tmpFile, "line one\nline two\nline three")
    const neverCalled = () => { throw new Error("stdin should not be read") }
    await storeSet(
      { "--id": created.id, "--store": "docs", "--key": "readme", "--file": tmpFile },
      neverCalled,
      root,
    )
    const got = await storeGet({ "--id": created.id, "--store": "docs", "--key": "readme" }, root)
    expect(got.value).toBe("line one\nline two\nline three")
  })

  test("storeSet --value takes precedence over --file", async () => {
    const created = (await issueCreate({ "--title": "Store Precedence" }, root)) as IssueResult
    const tmpFile = join(root, "tmp-ignored.md")
    writeFileSync(tmpFile, "file content")
    const neverCalled = () => { throw new Error("stdin should not be read") }
    await storeSet(
      { "--id": created.id, "--store": "prec", "--key": "test", "--value": "flag wins", "--file": tmpFile },
      neverCalled,
      root,
    )
    const got = await storeGet({ "--id": created.id, "--store": "prec", "--key": "test" }, root)
    expect(got.value).toBe("flag wins")
  })

  test("invalid store name is rejected", async () => {
    const created = (await issueCreate({ "--title": "Store Bad Name" }, root)) as IssueResult
    await expect(
      storeSet({ "--id": created.id, "--store": "../bad", "--key": "k" }, fakeStdin("x"), root),
    ).rejects.toThrow("Invalid store name '../bad'")
    await expect(
      storeSet({ "--id": created.id, "--store": "foo/bar", "--key": "k" }, fakeStdin("x"), root),
    ).rejects.toThrow("Invalid store name 'foo/bar'")
  })

  test("invalid store key is rejected", async () => {
    const created = (await issueCreate({ "--title": "Store Bad Key" }, root)) as IssueResult
    await expect(
      storeSet({ "--id": created.id, "--store": "valid", "--key": "foo/bar" }, fakeStdin("x"), root),
    ).rejects.toThrow("Invalid key 'foo/bar'")
    await expect(
      storeSet({ "--id": created.id, "--store": "valid", "--key": ".." }, fakeStdin("x"), root),
    ).rejects.toThrow("Invalid key '..'")
  })

  test("missing required flags throw", async () => {
    await expect(
      storeSet({ "--store": "s", "--key": "k" }, fakeStdin("x"), root),
    ).rejects.toThrow("--id is required")
    await expect(
      storeSet({ "--id": "xxxx", "--key": "k" }, fakeStdin("x"), root),
    ).rejects.toThrow("--store is required")
    await expect(
      storeSet({ "--id": "xxxx", "--store": "s" }, fakeStdin("x"), root),
    ).rejects.toThrow("--key is required")
    await expect(
      storeGet({ "--store": "s", "--key": "k" }, root),
    ).rejects.toThrow("--id is required")
    await expect(
      storeKeys({ "--id": "xxxx" }, root),
    ).rejects.toThrow("--store is required")
  })
})
