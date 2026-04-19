import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { issueCreate, issueShow, issueList, issueSearch, issueChildren, issueParents, issueRelated, issueClose, issueMetaSet, issueMetaGet, updateArrayField, storeSet, storeGet, storeKeys, storeDelete, resolveIssue, requireFlag } from "./commands"

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
    expect(String(result.updated)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
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
    expect(result.stores?.tasks).toEqual(["01-setup.md", "02-impl.md"])
  })

  test("--summary omits stores", async () => {
    const created = (await issueCreate({ "--title": "Summary Show" }, root)) as IssueResult
    const result = await issueShow({ "--id": created.id, "--summary": "true" }, root)
    expect(result.metadata.title).toBe("Summary Show")
    expect(result).not.toHaveProperty("stores")
  })

  test("--compact returns agent-friendly metadata and omits stores", async () => {
    const created = (await issueCreate({ "--title": "Compact Show" }, root)) as IssueResult
    const result = await issueShow({ "--id": created.id, "--compact": "true" }, root)
    expect(result.metadata).toEqual({
      title: "Compact Show",
      status: "open",
      phase: "research",
      priority: 2,
      created: expect.any(String),
      updated: expect.any(String),
      refs: [],
      labels: [],
    })
    expect(result).not.toHaveProperty("stores")
  })

  test("--fields narrows metadata and omits stores by default", async () => {
    const created = (await issueCreate({ "--title": "Field Show" }, root)) as IssueResult
    const result = await issueShow({ "--id": created.id, "--fields": "title,phase" }, root)
    expect(result.metadata).toEqual({ title: "Field Show", phase: "research" })
    expect(result).not.toHaveProperty("stores")
  })

  test("--fields with --include-stores keeps stores", async () => {
    const created = (await issueCreate({ "--title": "Field Show Stores" }, root)) as IssueResult
    const fakeStdin = (s: string) => () => Promise.resolve(s)
    await storeSet({ "--id": created.id, "--store": "research", "--key": "summary" }, fakeStdin("content"), root)

    const result = await issueShow(
      { "--id": created.id, "--fields": "title", "--include-stores": "true" },
      root
    )
    expect(result.metadata).toEqual({ title: "Field Show Stores" })
    expect(result.stores?.research).toEqual(["summary"])
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
    const openOne = (await issueCreate(
      { "--title": "Open One", "--description": "Replace new packet session page", "--label": "ui" },
      listRoot
    )) as IssueResult
    await updateArrayField({ "--id": openOne.id, "--add": "epic1" }, "refs", listRoot)
    await issueCreate({ "--title": "Open Two", "--label": ["backend", "packet"] }, listRoot)
    const toClose = (await issueCreate({ "--title": "Closed One" }, listRoot)) as IssueResult
    await issueClose({ "--id": toClose.id }, listRoot)
  })

  test("returns open issues", async () => {
    const result = await issueList({}, listRoot)
    const titles = result.map((i) => i.title as string)
    expect(titles).toContain("Open One")
    expect(titles).toContain("Open Two")
  })

  test("list is compact by default", async () => {
    const result = await issueList({}, listRoot)
    expect(Object.keys(result[0] ?? {}).sort()).toEqual([
      "id",
      "phase",
      "priority",
      "refs",
      "status",
      "title",
    ])
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

  test("--text filters across title, description, refs, and labels", async () => {
    expect((await issueList({ "--text": "packet session" }, listRoot)).map((i) => i.title)).toEqual([
      "Open One",
    ])
    expect((await issueList({ "--text": "epic1" }, listRoot)).map((i) => i.title)).toEqual([
      "Open One",
    ])
    expect((await issueList({ "--text": "backend" }, listRoot)).map((i) => i.title)).toEqual([
      "Open Two",
    ])
  })

  test("--fields projects returned issue objects", async () => {
    const result = await issueList({ "--fields": "id,title,status", "--limit": "1" }, listRoot)
    expect(Object.keys(result[0] ?? {}).sort()).toEqual(["id", "status", "title"])
  })

  test("--compact projects a compact issue shape", async () => {
    const result = await issueList({ "--compact": "true", "--limit": "1" }, listRoot)
    expect(Object.keys(result[0] ?? {}).sort()).toEqual([
      "id",
      "phase",
      "priority",
      "refs",
      "status",
      "title",
    ])
  })

  test("--full returns full issue objects", async () => {
    const result = await issueList({ "--full": "true", "--limit": "1" }, listRoot)
    expect(result[0]).toHaveProperty("description")
    expect(result[0]).toHaveProperty("labels")
    expect(result[0]).toHaveProperty("updated")
  })

  test("--sort updated orders by most recently updated first", async () => {
    const sortRoot = join(root, "updated-sort-test")
    const first = (await issueCreate({ "--title": "First" }, sortRoot)) as IssueResult
    const second = (await issueCreate({ "--title": "Second" }, sortRoot)) as IssueResult
    await Bun.sleep(5)
    await issueMetaSet({ "--id": first.id, "--key": "phase", "--value": "ready-to-code" }, sortRoot)

    const result = await issueList({ "--sort": "updated", "--full": "true" }, sortRoot)
    expect(result.map((i) => i.title)).toEqual(["First", "Second"])
  })

  test("invalid --sort throws", async () => {
    await expect(issueList({ "--sort": "created" }, listRoot)).rejects.toThrow(
      "--sort must be one of: priority, updated"
    )
  })

  test("--limit caps result count", async () => {
    const result = await issueList({ "--limit": "1" }, listRoot)
    expect(result).toHaveLength(1)
  })

  test("invalid --limit throws", async () => {
    await expect(issueList({ "--limit": "0" }, listRoot)).rejects.toThrow(
      "--limit must be a positive integer"
    )
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

describe("issueSearch", () => {
  test("search uses positional query text", async () => {
    const searchRoot = join(root, "search-test")
    await issueCreate({ "--title": "Packet Session Work" }, searchRoot)
    await issueCreate({ "--title": "Something Else" }, searchRoot)

    const result = await issueSearch({ _: ["packet", "session"] }, searchRoot)
    expect(result.map((i) => i.title)).toEqual(["Packet Session Work"])
  })

  test("search accepts --text and is compact by default", async () => {
    const searchRoot = join(root, "search-flag-test")
    await issueCreate({ "--title": "Target Issue" }, searchRoot)

    const result = await issueSearch({ "--text": "target" }, searchRoot)
    expect(result).toHaveLength(1)
    expect(Object.keys(result[0] ?? {}).sort()).toEqual([
      "id",
      "phase",
      "priority",
      "refs",
      "status",
      "title",
    ])
  })

  test("search requires a query", async () => {
    await expect(issueSearch({}, root)).rejects.toThrow(
      "search query is required (pass positional text or --text)"
    )
  })
})

describe("issueChildren / issueParents / issueRelated", () => {
  test("children finds issues that reference the parent and supports field projection", async () => {
    const relationRoot = join(root, "relation-test")
    const parent = (await issueCreate({ "--title": "Parent Epic" }, relationRoot)) as IssueResult
    const child = (await issueCreate({ "--title": "Child One" }, relationRoot)) as IssueResult
    const other = (await issueCreate({ "--title": "Other" }, relationRoot)) as IssueResult

    await updateArrayField({ "--id": child.id, "--add": parent.id }, "refs", relationRoot)
    await updateArrayField({ "--id": other.id, "--add": "external-ref" }, "refs", relationRoot)

    const children = await issueChildren(
      { "--id": parent.id, "--fields": "id,title,phase,status" },
      relationRoot
    )
    expect(children).toEqual([
      {
        id: child.id,
        title: "Child One",
        phase: "research",
        status: "open",
      },
    ])
  })

  test("parents resolves local refs and ignores external refs", async () => {
    const relationRoot = join(root, "relation-test-parents")
    const parent = (await issueCreate({ "--title": "Parent Epic" }, relationRoot)) as IssueResult
    const child = (await issueCreate({ "--title": "Child One" }, relationRoot)) as IssueResult

    await updateArrayField({ "--id": child.id, "--add": [parent.id, "https://example.com/123"] }, "refs", relationRoot)

    const parents = await issueParents(
      { "--id": child.id, "--fields": "id,title,phase,status" },
      relationRoot
    )
    expect(parents).toEqual([
      {
        id: parent.id,
        title: "Parent Epic",
        phase: "research",
        status: "open",
      },
    ])
  })

  test("related combines parent and child relationships and supports compact mode", async () => {
    const relationRoot = join(root, "relation-test-related")
    const target = (await issueCreate({ "--title": "Target" }, relationRoot)) as IssueResult
    const parent = (await issueCreate({ "--title": "Parent" }, relationRoot)) as IssueResult
    const child = (await issueCreate({ "--title": "Child" }, relationRoot)) as IssueResult

    await updateArrayField({ "--id": target.id, "--add": parent.id }, "refs", relationRoot)
    await updateArrayField({ "--id": child.id, "--add": target.id }, "refs", relationRoot)

    const related = await issueRelated({ "--id": target.id, "--compact": "true" }, relationRoot)
    expect(related).toHaveLength(2)
    expect(related).toEqual(
      expect.arrayContaining([
        {
          id: parent.id,
          title: "Parent",
          status: "open",
          phase: "research",
          priority: 2,
          relation: "parent",
        },
        {
          id: child.id,
          title: "Child",
          status: "open",
          phase: "research",
          priority: 2,
          relation: "child",
        },
      ])
    )
  })

  test("related marks both when an issue is both parent and child", async () => {
    const relationRoot = join(root, "relation-test-both")
    const target = (await issueCreate({ "--title": "Target" }, relationRoot)) as IssueResult
    const both = (await issueCreate({ "--title": "Both" }, relationRoot)) as IssueResult

    await updateArrayField({ "--id": target.id, "--add": both.id }, "refs", relationRoot)
    await updateArrayField({ "--id": both.id, "--add": target.id }, "refs", relationRoot)

    const related = await issueRelated(
      { "--id": target.id, "--fields": "id,title,relation" },
      relationRoot
    )
    expect(related).toEqual([{ id: both.id, title: "Both", relation: "both" }])
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
    const result = await issueMetaSet({ "--id": created.id, "--key": "phase", "--value": "spec" }, root)
    expect(result.phase).toBe("spec")
    expect(result.title).toBe("Meta Test")

    // Verify on disk
    const { path } = resolveIssue(created.id, root)
    const data = JSON.parse(readFileSync(join(path, "issue.json"), "utf-8"))
    expect(data.phase).toBe("spec")
  })

  test("issueMetaSet overwrites an existing key", async () => {
    const created = (await issueCreate({ "--title": "Meta Overwrite" }, root)) as IssueResult
    await issueMetaSet({ "--id": created.id, "--key": "phase", "--value": "spec" }, root)
    const beforeUpdate = String((await issueShow({ "--id": created.id, "--full": "true" }, root)).metadata.updated)
    const result = await issueMetaSet({ "--id": created.id, "--key": "phase", "--value": "ready-to-code" }, root)
    expect(result.phase).toBe("ready-to-code")
    expect(String(result.updated) >= beforeUpdate).toBe(true)
  })

  test("issueMetaSet on archived issue works", async () => {
    const created = (await issueCreate({ "--title": "Meta Archive" }, root)) as IssueResult
    await issueClose({ "--id": created.id }, root)
    const result = await issueMetaSet({ "--id": created.id, "--key": "priority", "--value": "high" }, root)
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

  test("storeDelete removes a single key", async () => {
    const created = (await issueCreate({ "--title": "Store Delete Key" }, root)) as IssueResult
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "alpha" }, fakeStdin("a"), root)
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "beta" }, fakeStdin("b"), root)

    const result = await storeDelete({ "--id": created.id, "--store": "docs", "--key": "alpha" }, root)
    expect(result).toEqual({ deleted: true, kind: "key" })
    expect(await storeGet({ "--id": created.id, "--store": "docs", "--key": "alpha" }, root)).toEqual({ value: null })
    expect(await storeKeys({ "--id": created.id, "--store": "docs" }, root)).toEqual({ keys: ["beta"] })
  })

  test("storeDelete removes empty store after deleting its last key", async () => {
    const created = (await issueCreate({ "--title": "Store Delete Last Key" }, root)) as IssueResult
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "only" }, fakeStdin("a"), root)

    const result = await storeDelete({ "--id": created.id, "--store": "docs", "--key": "only" }, root)
    expect(result).toEqual({ deleted: true, kind: "key", removedEmptyStore: true })
    expect(await storeKeys({ "--id": created.id, "--store": "docs" }, root)).toEqual({ keys: [] })

    const shown = await issueShow({ "--id": created.id }, root)
    expect(shown.stores).toEqual({})
  })

  test("storeDelete removes an entire store when --key is omitted", async () => {
    const created = (await issueCreate({ "--title": "Store Delete Store" }, root)) as IssueResult
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "alpha" }, fakeStdin("a"), root)
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "beta" }, fakeStdin("b"), root)

    const result = await storeDelete({ "--id": created.id, "--store": "docs" }, root)
    expect(result).toEqual({ deleted: true, kind: "store" })
    expect(await storeKeys({ "--id": created.id, "--store": "docs" }, root)).toEqual({ keys: [] })
  })

  test("storeDelete is idempotent for missing targets", async () => {
    const created = (await issueCreate({ "--title": "Store Delete Missing" }, root)) as IssueResult
    expect(await storeDelete({ "--id": created.id, "--store": "docs", "--key": "nope" }, root)).toEqual({
      deleted: false,
      kind: "key",
    })
    expect(await storeDelete({ "--id": created.id, "--store": "docs" }, root)).toEqual({
      deleted: false,
      kind: "store",
    })
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
    await expect(
      storeDelete({ "--id": "xxxx" }, root),
    ).rejects.toThrow("--store is required")
  })
})
