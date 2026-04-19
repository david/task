import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  issueChildren,
  issueClose,
  issueCreate,
  issueParents,
  issueRelated,
  issueSearch,
  issueShow,
  issueList,
  legacyImport,
  storeGet,
  updateArrayField,
} from "./commands"
import {
  expectRecordWithFields,
  readCanonicalEvents,
  useTempRoot,
  writeLegacyIssue,
} from "./commands-test-helpers"

const getRoot = useTempRoot("commands-import-hierarchy-")

function seedLegacyParent(legacyRoot: string): void {
  writeLegacyIssue(
    legacyRoot,
    "aaaa-parent-epic",
    {
      title: "Parent Epic",
      description: "Imported parent",
      status: "open",
      phase: "research",
      priority: 1,
      created: "2024-01-01",
      updated: "2024-01-01T10:00:00.000Z",
      refs: ["external-parent-ref"],
      labels: ["epic"],
      github_issue: 101,
    },
    { research: { summary: "parent summary" } }
  )
}

function seedLegacyChild(legacyRoot: string): void {
  writeLegacyIssue(
    legacyRoot,
    "bbbb-child-task",
    {
      title: "Child Task",
      description: "Imported child",
      status: "open",
      phase: "ready-to-code",
      priority: 0,
      created: "2024-01-02",
      updated: "2024-01-02T12:00:00.000Z",
      refs: ["aaaa-parent-epic", "external-child-ref"],
      labels: ["backend"],
      owner: "backend",
    },
    { research: { summary: "child summary" }, tasks: { plan: "child plan" } }
  )
}

function seedLegacyClosedIssue(legacyRoot: string): void {
  writeLegacyIssue(
    legacyRoot,
    "cccc-closed-task",
    {
      title: "Closed Task",
      description: "Imported closed issue",
      status: "closed",
      phase: "done",
      priority: 3,
      created: "2024-01-03",
      updated: "2024-01-03T15:00:00.000Z",
      refs: ["external-closed-ref"],
      labels: ["done"],
    },
    { notes: { summary: "closed summary" } },
    true
  )
}

function seedLegacyImportSource(legacyRoot: string): void {
  seedLegacyParent(legacyRoot)
  seedLegacyChild(legacyRoot)
  seedLegacyClosedIssue(legacyRoot)
}

async function assertLegacyImportListings(targetRoot: string): Promise<void> {
  await expect(legacyImport({ "--source": join(getRoot(), "legacy-import-source") }, targetRoot)).resolves.toEqual({
    imported: true,
    source: join(getRoot(), "legacy-import-source"),
    issueCount: 3,
    storeCount: 4,
  })

  await expect(issueList({ "--fields": "id,title,status" }, targetRoot)).resolves.toEqual([
    { id: "bbbb-child-task", title: "Child Task", status: "open" },
    { id: "aaaa-parent-epic", title: "Parent Epic", status: "open" },
  ])

  const allIssues = await issueList({ "--all": "true", "--fields": "id,title,status" }, targetRoot)
  expectRecordWithFields(allIssues, { id: "cccc-closed-task", title: "Closed Task", status: "closed" })
}

async function assertLegacyImportMetadata(targetRoot: string): Promise<void> {
  const child = await issueShow({ "--id": "bbbb-child-task", "--summary": "true" }, targetRoot)
  const parent = await issueShow({ "--id": "aaaa-parent-epic", "--summary": "true" }, targetRoot)
  const closed = await issueShow({ "--id": "cccc-closed-task", "--summary": "true" }, targetRoot)

  expect(child.metadata).toMatchObject({
    title: "Child Task",
    phase: "ready-to-code",
    owner: "backend",
    refs: ["external-child-ref"],
    labels: ["backend"],
  })
  expect(parent.metadata).toMatchObject({ title: "Parent Epic", github_issue: 101, refs: ["external-parent-ref"] })
  expect(closed.metadata).toMatchObject({ title: "Closed Task", status: "closed", phase: "done" })
}

async function assertLegacyImportRelationsAndStores(targetRoot: string): Promise<void> {
  await expect(issueChildren({ "--id": "aaaa-parent-epic", "--fields": "id,title,status" }, targetRoot)).resolves.toEqual([
    { id: "bbbb-child-task", title: "Child Task", status: "open" },
  ])
  await expect(issueParents({ "--id": "bbbb-child-task", "--fields": "id,title,status" }, targetRoot)).resolves.toEqual([
    { id: "aaaa-parent-epic", title: "Parent Epic", status: "open" },
  ])
  await expect(storeGet({ "--id": "bbbb-child-task", "--store": "research", "--key": "summary" }, targetRoot)).resolves.toEqual({ value: "child summary" })
  await expect(storeGet({ "--id": "bbbb-child-task", "--store": "tasks", "--key": "plan" }, targetRoot)).resolves.toEqual({ value: "child plan" })
  expect((await issueSearch({ "--text": "external-child-ref" }, targetRoot)).map((issue) => issue["id"])).toEqual([
    "bbbb-child-task",
  ])
}

function assertLegacyImportEvents(targetRoot: string): void {
  expect(existsSync(join(targetRoot, ".task", "events", "by-issue", "aaaa-parent-epic"))).toBe(true)
  expect(existsSync(join(targetRoot, ".task", "events", "by-issue", "bbbb-child-task"))).toBe(true)
  expect(existsSync(join(targetRoot, ".task", "events", "by-issue", "cccc-closed-task"))).toBe(true)

  const childEvents = readCanonicalEvents(targetRoot, "bbbb-child-task")
  expect(childEvents).toHaveLength(6)
  const childEventTypes = childEvents.map((event) => event.type)
  expect(childEventTypes).toContain("IssueCreated")
  expect(childEventTypes).toContain("IssueMetadataSet")
  expect(childEventTypes).toContain("StoreRevisionSaved")
  expect(childEventTypes).toContain("StoreRevisionFinalized")

  const closedEvents = readCanonicalEvents(targetRoot, "cccc-closed-task")
  expect(closedEvents.map((event) => event.type)).toContain("IssueClosed")
}

function registerLegacyImportSuccessTest(): void {
  test("imports legacy issues stores hierarchy and closed state", async () => {
    const legacyRoot = join(getRoot(), "legacy-import-source")
    const targetRoot = join(getRoot(), "legacy-import-target")
    seedLegacyImportSource(legacyRoot)

    await assertLegacyImportListings(targetRoot)
    await assertLegacyImportMetadata(targetRoot)
    await assertLegacyImportRelationsAndStores(targetRoot)
    assertLegacyImportEvents(targetRoot)
  })
}

function registerLegacyImportAmbiguousParentTest(): void {
  test("aborts ambiguous parent inference without partial state", async () => {
    const legacyRoot = join(getRoot(), "legacy-import-ambiguous-source")
    const targetRoot = join(getRoot(), "legacy-import-ambiguous-target")

    writeLegacyIssue(legacyRoot, "aaaa-first-parent", {
      title: "First Parent",
      description: "",
      status: "open",
      phase: "research",
      priority: 1,
      created: "2024-02-01",
      updated: "2024-02-01T00:00:00.000Z",
      refs: [],
      labels: [],
    })
    writeLegacyIssue(legacyRoot, "bbbb-second-parent", {
      title: "Second Parent",
      description: "",
      status: "open",
      phase: "research",
      priority: 1,
      created: "2024-02-01",
      updated: "2024-02-01T00:00:00.000Z",
      refs: [],
      labels: [],
    })
    writeLegacyIssue(legacyRoot, "cccc-child", {
      title: "Ambiguous Child",
      description: "",
      status: "open",
      phase: "research",
      priority: 1,
      created: "2024-02-01",
      updated: "2024-02-01T00:00:00.000Z",
      refs: ["aaaa-first-parent", "bbbb-second-parent"],
      labels: [],
    })

    await expect(legacyImport({ "--source": legacyRoot }, targetRoot)).rejects.toThrow("ambiguous_legacy_parent")
    await expect(issueList({ "--all": "true" }, targetRoot)).resolves.toEqual([])
    expect(existsSync(join(targetRoot, ".task", "events", "by-issue"))).toBe(false)
  })
}

describe("legacy import", () => {
  registerLegacyImportSuccessTest()
  registerLegacyImportAmbiguousParentTest()
})

describe("issue hierarchy commands", () => {
  test("create with parent drives hierarchy queries without refs mutation", async () => {
    const relationRoot = join(getRoot(), "relation-test")
    const parent = (await issueCreate({ "--title": "Parent Epic" }, relationRoot))
    const child = (await issueCreate({ "--title": "Child One", "--parent": parent["id"] }, relationRoot))

    await expect(issueChildren({ "--id": parent["id"], "--fields": "id,title,phase,status" }, relationRoot)).resolves.toEqual([
      { id: child["id"], title: "Child One", phase: "research", status: "open" },
    ])
    await expect(issueParents({ "--id": child["id"], "--fields": "id,title,phase,status" }, relationRoot)).resolves.toEqual([
      { id: parent["id"], title: "Parent Epic", phase: "research", status: "open" },
    ])
    await expect(issueRelated({ "--id": parent["id"], "--compact": "true" }, relationRoot)).resolves.toEqual([
      { id: child["id"], title: "Child One", status: "open", phase: "research", priority: 2, relation: "child" },
    ])
    expect((await issueShow({ "--id": child["id"], "--summary": "true" }, relationRoot)).metadata["refs"]).toEqual([])
  })

  test("create rejects unknown parent references", async () => {
    const relationRoot = join(getRoot(), "relation-test-missing-parent")
    await expect(issueCreate({ "--title": "Child One", "--parent": "zzzz" }, relationRoot)).rejects.toThrow(
      "Parent issue 'zzzz' not found"
    )
  })

  test("create rejects closed parent issues", async () => {
    const relationRoot = join(getRoot(), "relation-test-closed-parent")
    const parent = (await issueCreate({ "--title": "Parent Epic" }, relationRoot))
    await issueClose({ "--id": parent["id"] }, relationRoot)
    await expect(issueCreate({ "--title": "Child One", "--parent": parent["id"] }, relationRoot)).rejects.toThrow(
      `Parent issue '${parent["id"]}' is closed`
    )
  })

  test("relationship commands ignore refs without hierarchy links", async () => {
    const relationRoot = join(getRoot(), "relation-test-ignore-refs")
    const parent = (await issueCreate({ "--title": "Parent Epic" }, relationRoot))
    const child = (await issueCreate({ "--title": "Child One" }, relationRoot))
    await updateArrayField({ "--id": child["id"], "--add": [parent["id"], "https://example.com/123"] }, "refs", relationRoot)

    await expect(issueChildren({ "--id": parent["id"] }, relationRoot)).resolves.toEqual([])
    await expect(issueParents({ "--id": child["id"] }, relationRoot)).resolves.toEqual([])
    await expect(issueRelated({ "--id": parent["id"], "--fields": "id,title,relation" }, relationRoot)).resolves.toEqual([])
  })
})
