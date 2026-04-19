import { describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  issueCreate,
  issueSearch,
  issueShow,
  issueClose,
  issueList,
  requireFlag,
  resolveIssue,
  storeSet,
} from "./commands"
import {
  fakeStdin,
  issueProjectionRoot,
  readJsonObject,
  useTempRoot,
} from "./commands-test-helpers"

const getRoot = useTempRoot("commands-basic-")

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

describe("issueCreate basics", () => {
  test("generates unique ID and writes well-formed issue.json", async () => {
    const root = getRoot()
    const result = (await issueCreate({ "--title": "My First Issue" }, root))
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

    const { path } = resolveIssue(result.id, root)
    const data = readJsonObject(join(path, "issue.json"))
    expect(data.title).toBe("My First Issue")
    expect(data.status).toBe("open")
  })

  test("supports github issues and explicit priority", async () => {
    const root = getRoot()
    const result = (await issueCreate(
      { "--title": "GH Issue", "--github-issue": "42", "--priority": "0" },
      root
    ))

    const { path } = resolveIssue(result.id, root)
    const data = readJsonObject(join(path, "issue.json"))
    expect(result.github_issue).toBe(42)
    expect(result.priority).toBe(0)
    expect(data.github_issue).toBe(42)
    expect(data.priority).toBe(0)
  })

  test("rejects missing --title", async () => {
    await expect(issueCreate({}, getRoot())).rejects.toThrow("--title is required")
  })

  test("auto-creates root dirs if missing", async () => {
    const freshRoot = join(getRoot(), "fresh-sub")
    const result = (await issueCreate({ "--title": "Auto Dir" }, freshRoot))
    expect(result.id).toMatch(/^[a-z0-9]{4}-auto-dir$/)
  })
})

describe("issueCreate labels and events", () => {
  test("stores labels arrays consistently", async () => {
    const root = getRoot()
    const labeled = (await issueCreate({ "--title": "Labeled", "--label": ["cli", "bug"] }, root))
    const single = (await issueCreate({ "--title": "One Label", "--label": "cli" }, root))
    const unlabeled = (await issueCreate({ "--title": "No Labels" }, root))

    expect(labeled.labels).toEqual(["cli", "bug"])
    expect(single.labels).toEqual(["cli"])
    expect(unlabeled.labels).toEqual([])
    expect(readJsonObject(join(resolveIssue(labeled.id, root).path, "issue.json")).labels).toEqual(["cli", "bug"])
  })

  test("slug derives from title", async () => {
    const root = getRoot()
    const result = (await issueCreate({ "--title": "Hello World! 123" }, root))
    expect(resolveIssue(result.id, root).path).toMatch(/hello-world-123/)
  })

  test("writes canonical Esther event files under the repo-local tracker", async () => {
    const repoRoot = join(getRoot(), "repo-local-events")
    const result = (await issueCreate({ "--title": "Event Backed" }, repoRoot))
    const eventDir = join(repoRoot, ".task", "events", "by-issue", result.id)
    const eventFiles = readdirSync(eventDir).filter((entry) => entry.endsWith(".json"))
    expect(eventFiles).toHaveLength(1)
  })
})

describe("resolveIssue", () => {
  test("finds active issue by ID", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Resolve Test" }, root))
    const resolved = resolveIssue(created.id, root)
    expect(resolved.path).toContain(created.id)
    expect(resolved.archived).toBe(false)
  })

  test("throws for unknown ID", () => {
    expect(() => resolveIssue("zzzz", getRoot())).toThrow("Issue 'zzzz' not found")
  })

  test("rejects invalid IDs", () => {
    expect(() => resolveIssue("../bad", getRoot())).toThrow()
    expect(() => resolveIssue("ABCD", getRoot())).toThrow()
  })
})

describe("issueShow basics", () => {
  test("returns metadata and empty stores for a new issue", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Show Test" }, root))
    const result = await issueShow({ "--id": created.id }, root)
    expect(result.id).toBe(created.id)
    expect(result.metadata.title).toBe("Show Test")
    expect("stores" in result ? result.stores : undefined).toEqual({})
  })

  test("finds closed issues", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Archive Show" }, root))
    await issueClose({ "--id": created.id }, root)
    const result = await issueShow({ "--id": created.id }, root)
    expect(result.metadata.status).toBe("closed")
  })

  test("lists store names and keys", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Store Test" }, root))
    await storeSet({ "--id": created.id, "--store": "tasks", "--key": "01-setup.md" }, fakeStdin("content"), root)
    await storeSet({ "--id": created.id, "--store": "tasks", "--key": "02-impl.md" }, fakeStdin("content"), root)

    const result = await issueShow({ "--id": created.id }, root)
    expect("stores" in result ? result.stores.tasks : undefined).toEqual(["01-setup.md", "02-impl.md"])
  })

  test("throws for unknown ID", async () => {
    await expect(issueShow({ "--id": "zzzz" }, getRoot())).rejects.toThrow("Issue 'zzzz' not found")
  })
})

describe("issueShow projections", () => {
  test("summary omits stores", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Summary Show" }, root))
    const result = await issueShow({ "--id": created.id, "--summary": "true" }, root)
    expect(result.metadata.title).toBe("Summary Show")
    expect(result).not.toHaveProperty("stores")
  })

  test("compact returns agent-friendly metadata", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Compact Show" }, root))
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

  test("fields narrows metadata and include-stores restores stores", async () => {
    const root = getRoot()
    const basic = (await issueCreate({ "--title": "Field Show" }, root))
    const withStores = (await issueCreate({ "--title": "Field Show Stores" }, root))
    await storeSet({ "--id": withStores.id, "--store": "research", "--key": "summary" }, fakeStdin("content"), root)

    const narrowed = await issueShow({ "--id": basic.id, "--fields": "title,phase" }, root)
    const full = await issueShow(
      { "--id": withStores.id, "--fields": "title", "--include-stores": "true" },
      root
    )

    expect(narrowed.metadata).toEqual({ title: "Field Show", phase: "research" })
    expect(narrowed).not.toHaveProperty("stores")
    expect(full.metadata).toEqual({ title: "Field Show Stores" })
    expect("stores" in full ? full.stores.research : undefined).toEqual(["summary"])
  })
})

describe("issueSearch and isolation", () => {
  test("search accepts positional queries and --text", async () => {
    const positionalRoot = join(getRoot(), "search-test")
    await issueCreate({ "--title": "Packet Session Work" }, positionalRoot)
    await issueCreate({ "--title": "Something Else" }, positionalRoot)
    expect((await issueSearch({ _: ["packet", "session"] }, positionalRoot)).map((i) => i.title)).toEqual([
      "Packet Session Work",
    ])

    const flagRoot = join(getRoot(), "search-flag-test")
    await issueCreate({ "--title": "Target Issue" }, flagRoot)
    const result = await issueSearch({ "--text": "target" }, flagRoot)
    expect(result).toHaveLength(1)
    expect(Object.keys(result[0] ?? {}).sort()).toEqual(["id", "phase", "priority", "refs", "status", "title"])
  })

  test("search requires a query", async () => {
    await expect(issueSearch({}, getRoot())).rejects.toThrow(
      "search query is required (pass positional text or --text)"
    )
  })

  test("keeps state isolated per repo", async () => {
    const root = getRoot()
    const repoA = join(root, "repo-a")
    const repoB = join(root, "repo-b")
    const externalRoot = join(root, "outside-repos")
    const created = (await issueCreate({ "--title": "Repo A Only" }, repoA))
    await issueCreate({ "--title": "Outside" }, externalRoot)

    expect((await issueList({}, repoA)).map((issue) => issue.id)).toEqual([created.id])
    expect(await issueList({}, repoB)).toEqual([])
    expect(existsSync(join(repoA, ".task", "events", "by-issue", created.id))).toBe(true)
  })
})

describe("ambiguous ID", () => {
  test("throws with list of matches", () => {
    const root = join(getRoot(), "ambig")
    mkdirSync(join(issueProjectionRoot(root), "aaaa-first"), { recursive: true })
    writeFileSync(join(issueProjectionRoot(root), "aaaa-first", "issue.json"), "{}")
    mkdirSync(join(issueProjectionRoot(root), "aaaa-second"), { recursive: true })
    writeFileSync(join(issueProjectionRoot(root), "aaaa-second", "issue.json"), "{}")
    expect(() => resolveIssue("aaaa", root)).toThrow(/Ambiguous.*aaaa/)
  })
})
