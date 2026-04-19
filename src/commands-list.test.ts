import { beforeAll, describe, expect, test } from "bun:test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { issueClose, issueCreate, issueList, issueMetaSet, updateArrayField } from "./commands"
import { issueProjectionRoot, useTempRoot } from "./commands-test-helpers"

const getRoot = useTempRoot("commands-list-")

let listRoot = ""
let labelRoot = ""

async function setupListFixtures(root: string): Promise<string> {
  const target = join(root, "list-test")
  const openOne = (await issueCreate(
    { "--title": "Open One", "--description": "Replace new packet session page", "--label": "ui" },
    target
  ))
  await updateArrayField({ "--id": openOne.id, "--add": "epic1" }, "refs", target)
  await issueCreate({ "--title": "Open Two", "--label": ["backend", "packet"] }, target)
  const toClose = (await issueCreate({ "--title": "Closed One" }, target))
  await issueClose({ "--id": toClose.id }, target)
  return target
}

async function setupLabelFixtures(root: string): Promise<string> {
  const target = join(root, "label-filter-test")
  await issueCreate({ "--title": "CLI Issue", "--label": ["cli", "bug"] }, target)
  await issueCreate({ "--title": "PDF Issue", "--label": ["pdf", "bug"] }, target)
  await issueCreate({ "--title": "No Labels" }, target)
  return target
}

beforeAll(async () => {
  listRoot = await setupListFixtures(getRoot())
  labelRoot = await setupLabelFixtures(getRoot())
})

describe("issueList default behavior", () => {
  test("returns open issues only", async () => {
    const titles = (await issueList({}, listRoot)).map((i) => i.title)
    expect(titles).toContain("Open One")
    expect(titles).toContain("Open Two")
    expect(titles).not.toContain("Closed One")
  })

  test("list is compact by default", async () => {
    const result = await issueList({}, listRoot)
    expect(Object.keys(result[0] ?? {}).sort()).toEqual(["id", "phase", "priority", "refs", "status", "title"])
  })

  test("all includes closed issues", async () => {
    const titles = (await issueList({ "--all": "true" }, listRoot)).map((i) => i.title)
    expect(titles).toContain("Closed One")
  })

  test("where applies status and phase filters", async () => {
    const openOnly = await issueList({ "--where": "status=open" }, listRoot)
    const openResearch = await issueList({ "--where": ["status=open", "phase=research"] }, listRoot)
    expect(openOnly.every((item) => item.status === "open")).toBe(true)
    expect(openResearch.every((item) => item.status === "open" && item.phase === "research")).toBe(true)
  })
})

describe("issueList text and projection flags", () => {
  test("text searches title description refs and labels", async () => {
    expect((await issueList({ "--text": "packet session" }, listRoot)).map((i) => i.title)).toEqual(["Open One"])
    expect((await issueList({ "--text": "epic1" }, listRoot)).map((i) => i.title)).toEqual(["Open One"])
    expect((await issueList({ "--text": "backend" }, listRoot)).map((i) => i.title)).toEqual(["Open Two"])
  })

  test("fields projects returned issue objects", async () => {
    const result = await issueList({ "--fields": "id,title,status", "--limit": "1" }, listRoot)
    expect(Object.keys(result[0] ?? {}).sort()).toEqual(["id", "status", "title"])
  })

  test("compact and full choose different shapes", async () => {
    const compact = await issueList({ "--compact": "true", "--limit": "1" }, listRoot)
    const full = await issueList({ "--full": "true", "--limit": "1" }, listRoot)
    expect(Object.keys(compact[0] ?? {}).sort()).toEqual(["id", "phase", "priority", "refs", "status", "title"])
    expect(full[0]).toHaveProperty("description")
    expect(full[0]).toHaveProperty("labels")
    expect(full[0]).toHaveProperty("updated")
  })

  test("limit caps result count", async () => {
    expect(await issueList({ "--limit": "1" }, listRoot)).toHaveLength(1)
  })
})

describe("issueList sorting and validation", () => {
  test("sort updated orders by most recently updated first", async () => {
    const sortRoot = join(getRoot(), "updated-sort-test")
    const first = (await issueCreate({ "--title": "First" }, sortRoot))
    await issueCreate({ "--title": "Second" }, sortRoot)
    await Bun.sleep(5)
    await issueMetaSet({ "--id": first.id, "--key": "owner", "--value": "backend" }, sortRoot)
    expect((await issueList({ "--sort": "updated", "--full": "true" }, sortRoot)).map((i) => i.title)).toEqual([
      "First",
      "Second",
    ])
  })

  test("sorts priority ascending", async () => {
    const sortRoot = join(getRoot(), "sort-test")
    await issueCreate({ "--title": "Low", "--priority": "3" }, sortRoot)
    await issueCreate({ "--title": "High", "--priority": "0" }, sortRoot)
    await issueCreate({ "--title": "Default" }, sortRoot)
    await issueCreate({ "--title": "Medium", "--priority": "1" }, sortRoot)
    expect((await issueList({}, sortRoot)).map((i) => i.title)).toEqual(["High", "Medium", "Default", "Low"])
  })

  test("legacy issues without priority sort last", async () => {
    const legacyRoot = join(getRoot(), "legacy-test")
    await issueCreate({ "--title": "Normal", "--priority": "1" }, legacyRoot)
    mkdirSync(join(issueProjectionRoot(legacyRoot), "zzzz-legacy"), { recursive: true })
    writeFileSync(
      join(issueProjectionRoot(legacyRoot), "zzzz-legacy", "issue.json"),
      JSON.stringify({ title: "Legacy", status: "open", phase: "research" })
    )
    expect((await issueList({}, legacyRoot)).map((i) => i.title)).toEqual(["Normal", "Legacy"])
  })

  test("invalid sort and limit throw", async () => {
    await expect(issueList({ "--sort": "created" }, listRoot)).rejects.toThrow(
      "--sort must be one of: priority, updated"
    )
    await expect(issueList({ "--limit": "0" }, listRoot)).rejects.toThrow(
      "--limit must be a positive integer"
    )
  })
})

describe("issueList label filters", () => {
  test("filters by a single label", async () => {
    expect((await issueList({ "--label": "cli" }, labelRoot)).map((i) => i.title)).toEqual(["CLI Issue"])
  })

  test("single-item label arrays still work", async () => {
    const titles = (await issueList({ "--label": ["bug"] }, labelRoot)).map((i) => i.title)
    expect(titles).toContain("CLI Issue")
    expect(titles).toContain("PDF Issue")
    expect(titles).not.toContain("No Labels")
  })

  test("multiple labels use AND logic", async () => {
    expect((await issueList({ "--label": ["bug", "cli"] }, labelRoot)).map((i) => i.title)).toEqual([
      "CLI Issue",
    ])
  })

  test("no match returns empty", async () => {
    expect(await issueList({ "--label": "nonexistent" }, labelRoot)).toEqual([])
  })

  test("combines with where", async () => {
    const titles = (await issueList({ "--label": "bug", "--where": "status=open" }, labelRoot)).map(
      (i) => i.title
    )
    expect(titles).toContain("CLI Issue")
    expect(titles).toContain("PDF Issue")
  })
})
