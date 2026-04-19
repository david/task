import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  issueChildren,
  issueClose,
  issueCreate,
  issueList,
  issueSearch,
  issueShow,
  storeGet,
  storeSet,
  updateArrayField,
} from "./commands"
import {
  expectRecordWithFields,
  fakeStdin,
  issueProjectionRoot,
  readCanonicalEvents,
  readIssueMetadata,
  useTempRoot,
} from "./commands-test-helpers"

const getRoot = useTempRoot("commands-lifecycle-")

async function assertClosedChildStillQueryable(closeRoot: string, parentId: string, childId: string): Promise<void> {
  const shown = await issueShow({ "--id": childId }, closeRoot)
  const listed = await issueList({ "--all": "true", "--fields": "id,title,status" }, closeRoot)
  const searchResults = await issueSearch({ "--all": "true", "--text": "close child" }, closeRoot)
  expect(shown.metadata["status"]).toBe("closed")
  expectRecordWithFields(listed, { id: childId, title: "Close Child", status: "closed" })
  expect(searchResults.map((issue) => issue["id"])).toContain(childId)
  await expect(issueChildren({ "--id": parentId, "--fields": "id" }, closeRoot)).resolves.toEqual([])
  await expect(
    issueChildren({ "--id": parentId, "--all": "true", "--fields": "id,status,title" }, closeRoot)
  ).resolves.toEqual([{ id: childId, status: "closed", title: "Close Child" }])
}

function assertClosedChildProjection(closeRoot: string, childId: string): void {
  expect(existsSync(join(issueProjectionRoot(closeRoot), childId, "issue.json"))).toBe(true)
  expect(existsSync(join(issueProjectionRoot(closeRoot), ".archive", childId))).toBe(false)
  const closeEvents = readCanonicalEvents(closeRoot, childId).filter((event) => event.type === "IssueClosed")
  expect(closeEvents).toHaveLength(1)
}

async function setupProjectionRebuild(root: string): Promise<{ rebuildRoot: string; parentId: string; childId: string }> {
  const rebuildRoot = join(root, "projection-rebuild")
  const parent = (await issueCreate({ "--title": "Rebuild Parent" }, rebuildRoot))
  const child = (await issueCreate({ "--title": "Rebuild Child", "--parent": parent["id"] }, rebuildRoot))
  await storeSet({ "--id": child["id"], "--store": "research", "--key": "summary" }, fakeStdin("canonical summary"), rebuildRoot)
  await issueClose({ "--id": child["id"] }, rebuildRoot)
  return { rebuildRoot, parentId: parent["id"], childId: child["id"] }
}

function corruptProjectionArtifacts(rebuildRoot: string, parentId: string, childId: string): void {
  rmSync(join(rebuildRoot, ".task", "indexes", "hierarchy"), { recursive: true, force: true })
  rmSync(join(rebuildRoot, ".task", "indexes", "issues"), { recursive: true, force: true })
  rmSync(join(issueProjectionRoot(rebuildRoot), childId, "research"), { recursive: true, force: true })
  rmSync(join(issueProjectionRoot(rebuildRoot), parentId, "issue.json"), { force: true })
  writeFileSync(
    join(issueProjectionRoot(rebuildRoot), childId, "issue.json"),
    `${JSON.stringify({
      title: "Wrong Title",
      description: "wrong description",
      status: "open",
      phase: "research",
      priority: 9,
      created: "",
      updated: "",
      refs: [],
      labels: [],
    }, null, 2)}\n`
  )
}

async function assertProjectionRebuilt(rebuildRoot: string, parentId: string, childId: string): Promise<void> {
  const shown = await issueShow({ "--id": childId }, rebuildRoot)
  const listed = await issueList({ "--all": "true", "--fields": "id,title,status" }, rebuildRoot)
  expect(shown.metadata["title"]).toBe("Rebuild Child")
  expect(shown.metadata["status"]).toBe("closed")
  await expect(storeGet({ "--id": childId, "--store": "research", "--key": "summary" }, rebuildRoot)).resolves.toEqual({
    value: "canonical summary",
  })
  expectRecordWithFields(listed, { id: childId, title: "Rebuild Child", status: "closed" })
  await expect(
    issueChildren({ "--id": parentId, "--all": "true", "--fields": "id,title,status" }, rebuildRoot)
  ).resolves.toEqual([{ id: childId, title: "Rebuild Child", status: "closed" }])
}

function assertProjectionArtifacts(rebuildRoot: string, parentId: string, childId: string): void {
  const rebuiltIssue = readIssueMetadata(join(issueProjectionRoot(rebuildRoot), childId, "issue.json"))
  expect(rebuiltIssue["title"]).toBe("Rebuild Child")
  expect(rebuiltIssue["status"]).toBe("closed")
  expect(readFileSync(join(issueProjectionRoot(rebuildRoot), childId, "research", "summary"), "utf-8")).toBe(
    "canonical summary"
  )
  expect(existsSync(join(issueProjectionRoot(rebuildRoot), parentId, "issue.json"))).toBe(true)
  expect(existsSync(join(rebuildRoot, ".task", "indexes", "issues", "current.json"))).toBe(true)
  expect(existsSync(join(rebuildRoot, ".task", "indexes", "hierarchy", "parents-by-child.json"))).toBe(true)
  expect(existsSync(join(rebuildRoot, ".task", "indexes", "hierarchy", "children-by-parent.json"))).toBe(true)
}

describe("issueClose", () => {
  test("appends IssueClosed and keeps the issue queryable", async () => {
    const closeRoot = join(getRoot(), "close-current-state")
    const parent = (await issueCreate({ "--title": "Close Parent" }, closeRoot))
    const child = (await issueCreate({ "--title": "Close Child", "--parent": parent["id"] }, closeRoot))

    const result = await issueClose({ "--id": child["id"] }, closeRoot)
    expect("closed" in result && result.closed).toBe(true)
    await assertClosedChildStillQueryable(closeRoot, parent["id"], child["id"])
    assertClosedChildProjection(closeRoot, child["id"])
  })

  test("already-closed returns already_closed without another close event", async () => {
    const closeRoot = join(getRoot(), "double-close")
    const created = (await issueCreate({ "--title": "Double Close" }, closeRoot))
    await issueClose({ "--id": created["id"] }, closeRoot)
    const result = await issueClose({ "--id": created["id"] }, closeRoot)
    expect("already_closed" in result && result.already_closed).toBe(true)
    expect(readCanonicalEvents(closeRoot, created["id"]).filter((event) => event.type === "IssueClosed")).toHaveLength(1)
  })
})

describe("projection rebuilds", () => {
  test("rebuilds missing and corrupt projections from canonical history", async () => {
    const setup = await setupProjectionRebuild(getRoot())
    corruptProjectionArtifacts(setup.rebuildRoot, setup.parentId, setup.childId)
    await assertProjectionRebuilt(setup.rebuildRoot, setup.parentId, setup.childId)
    assertProjectionArtifacts(setup.rebuildRoot, setup.parentId, setup.childId)
  })
})

describe("updateArrayField labels", () => {
  test("adds values to empty field", async () => {
    const created = (await issueCreate({ "--title": "Update Add" }, getRoot()))
    const result = await updateArrayField({ "--id": created["id"], "--add": ["cli", "bug"] }, "labels", getRoot())
    expect(result.values).toEqual(["cli", "bug"])
    expect(result.field).toBe("labels")
  })

  test("removes values and handles add/remove together", async () => {
    const root = getRoot()
    const remove = (await issueCreate({ "--title": "Update Remove", "--label": ["cli", "bug", "pdf"] }, root))
    const both = (await issueCreate({ "--title": "Update Both", "--label": ["old"] }, root))
    expect((await updateArrayField({ "--id": remove["id"], "--remove": "bug" }, "labels", root)).values).toEqual([
      "cli",
      "pdf",
    ])
    expect(
      (await updateArrayField({ "--id": both["id"], "--remove": "old", "--add": "new" }, "labels", root)).values
    ).toEqual(["new"])
  })

  test("deduplicates and persists to disk", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Update Dedup", "--label": ["cli"] }, root))
    const result = await updateArrayField({ "--id": created["id"], "--add": "cli" }, "labels", root)
    expect(result.values).toEqual(["cli"])
    expect(readIssueMetadata(join(resolveIssuePath(root, created["id"]), "issue.json")).labels).toEqual(["cli"])
  })
})

describe("updateArrayField validation", () => {
  test("rejects unsupported fields", async () => {
    const created = (await issueCreate({ "--title": "Update Missing Field" }, getRoot()))
    await expect(updateArrayField({ "--id": created["id"], "--add": "val" }, "tags", getRoot())).rejects.toThrow(
      "Unsupported array field 'tags'"
    )
  })

  test("works on refs and requires add or remove", async () => {
    const root = getRoot()
    const refsIssue = (await issueCreate({ "--title": "Update Refs" }, root))
    const neitherIssue = (await issueCreate({ "--title": "Update Neither" }, root))
    expect((await updateArrayField({ "--id": refsIssue["id"], "--add": ["m85s", "x0h2"] }, "refs", root)).values).toEqual([
      "m85s",
      "x0h2",
    ])
    await expect(updateArrayField({ "--id": neitherIssue["id"] }, "labels", root)).rejects.toThrow(
      "At least one of --add or --remove is required"
    )
  })
})

function resolveIssuePath(root: string, issueId: string): string {
  return join(issueProjectionRoot(root), issueId)
}
