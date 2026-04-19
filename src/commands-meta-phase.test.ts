import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import {
  issueCreate,
  issueMetaGet,
  issueMetaSet,
  issueClose,
  issuePhaseNext,
  issuePhaseSet,
  issueShow,
  storeGet,
  storeSet,
} from "./commands"
import { appendTrackedIssueEvents, readTrackedIssueAggregate } from "./tracker/issues"
import { issueMetadataSetEvent } from "./tracker/events"
import {
  expectJsonObject,
  expectRecordWithFields,
  fakeStdin,
  readCanonicalEvents,
  readJsonObject,
  useTempRoot,
  writeTaskSettings,
} from "./commands-test-helpers"

const getRoot = useTempRoot("commands-meta-phase-")

function issueJsonPath(root: string, issueId: string): string {
  return join(root, ".task", "issues", issueId, "issue.json")
}

describe("meta set and get", () => {
  test("issueMetaSet adds a new key and writes it to disk", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Meta Test" }, root))
    const result = (await issueMetaSet({ "--id": created.id, "--key": "owner", "--value": "backend" }, root))
    expect(result.owner).toBe("backend")
    expect(result.title).toBe("Meta Test")
    expect(readJsonObject(issueJsonPath(root, created.id)).owner).toBe("backend")
  })

  test("issueMetaSet overwrites an existing key", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Meta Overwrite" }, root))
    await issueMetaSet({ "--id": created.id, "--key": "owner", "--value": "backend" }, root)
    const beforeUpdate = String((await issueShow({ "--id": created.id, "--full": "true" }, root)).metadata.updated)
    const result = (await issueMetaSet({ "--id": created.id, "--key": "owner", "--value": "frontend" }, root))
    expect(result.owner).toBe("frontend")
    expect(String(result.updated) >= beforeUpdate).toBe(true)
  })

  test("issueMetaSet on closed issue works", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Meta Archive" }, root))
    await issueClose({ "--id": created.id }, root)
    const result = (await issueMetaSet({ "--id": created.id, "--key": "priority", "--value": "high" }, root))
    expect(result.priority).toBe("high")
  })

  test("issueMetaGet returns values or null", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Meta Get" }, root))
    await issueMetaSet({ "--id": created.id, "--key": "priority", "--value": "low" }, root)
    expect(await issueMetaGet({ "--id": created.id, "--key": "priority" }, root)).toEqual({ value: "low" })
    expect(await issueMetaGet({ "--id": created.id, "--key": "nonexistent" }, root)).toEqual({ value: null })
  })
})

describe("meta validation", () => {
  test("rejects reserved keys", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Meta Reserved" }, root))
    await expect(issueMetaSet({ "--id": created.id, "--key": "phase", "--value": "ready-to-code" }, root)).rejects.toThrow(
      "Metadata key 'phase' is reserved; use a dedicated command instead"
    )
    await expect(issueMetaSet({ "--id": created.id, "--key": "status", "--value": "closed" }, root)).rejects.toThrow(
      "Metadata key 'status' is reserved; use a dedicated command instead"
    )
  })

  test("missing required flags throw", async () => {
    const created = (await issueCreate({ "--title": "Meta Flags" }, getRoot()))
    await expect(issueMetaSet({ "--id": created.id, "--key": "k" }, getRoot())).rejects.toThrow("--value is required")
    await expect(issueMetaSet({ "--id": created.id, "--value": "v" }, getRoot())).rejects.toThrow("--key is required")
    await expect(issueMetaSet({ "--key": "k", "--value": "v" }, getRoot())).rejects.toThrow("--id is required")
  })
})

describe("phase transitions", () => {
  test("phase next and phase set honor settings.json", async () => {
    const phaseRoot = join(getRoot(), "phase-commands")
    writeTaskSettings(phaseRoot, {
      defaultPhase: "backlog",
      phases: ["backlog", "in-progress", "done"],
      transitions: { backlog: ["in-progress"], "in-progress": ["done"], done: [] },
    })

    const created = (await issueCreate({ "--title": "Phase Configured" }, phaseRoot))
    expect(created.phase).toBe("backlog")
    await expect(issuePhaseNext({ "--id": created.id }, phaseRoot)).resolves.toEqual({ value: "in-progress" })
    const moved = (await issuePhaseSet({ "--id": created.id, "--value": "in-progress" }, phaseRoot))
    expect(moved.phase).toBe("in-progress")
    expect((await issueShow({ "--id": created.id, "--summary": "true" }, phaseRoot)).metadata.phase).toBe(
      "in-progress"
    )
    await expect(issuePhaseSet({ "--id": created.id, "--value": "backlog" }, phaseRoot)).rejects.toThrow(
      "Invalid phase transition 'in-progress' -> 'backlog'"
    )
  })
})

async function setupPhaseDraftFixture(root: string): Promise<string> {
  const phaseRoot = join(root, "phase-finalizes-drafts")
  writeTaskSettings(phaseRoot, {
    defaultPhase: "research",
    phases: ["research", "ready-to-code"],
    transitions: { research: ["ready-to-code"], "ready-to-code": [] },
  })
  const created = (await issueCreate({ "--title": "Finalize Drafts" }, phaseRoot))
  await storeSet({ "--id": created.id, "--store": "research", "--key": "summary" }, fakeStdin("draft summary"), phaseRoot)
  await storeSet({ "--id": created.id, "--store": "tasks", "--key": "plan" }, fakeStdin("draft plan"), phaseRoot)
  await issuePhaseSet({ "--id": created.id, "--value": "ready-to-code" }, phaseRoot)
  return created.id
}

describe("phase-driven store revisions", () => {
  test("phase change finalizes open store drafts", async () => {
    const phaseRoot = join(getRoot(), "phase-finalizes-drafts")
    const issueId = await setupPhaseDraftFixture(getRoot())
    expect(await storeGet({ "--id": issueId, "--store": "research", "--key": "summary" }, phaseRoot)).toEqual({
      value: "draft summary",
    })

    const finalized = readCanonicalEvents(phaseRoot, issueId)
      .filter((event) => event.type === "StoreRevisionFinalized")
      .map((event) => expectJsonObject(event.payload))

    expect(finalized).toHaveLength(2)
    expectRecordWithFields(finalized, { store: "research", key: "summary", revision: 1, phase: "research" })
    expectRecordWithFields(finalized, { store: "tasks", key: "plan", revision: 1, phase: "research" })
  })

  test("editing the same key in a later phase creates a new revision", async () => {
    const revisionRoot = join(getRoot(), "phase-store-revisions")
    writeTaskSettings(revisionRoot, {
      defaultPhase: "research",
      phases: ["research", "ready-to-code"],
      transitions: { research: ["ready-to-code"], "ready-to-code": [] },
    })

    const created = (await issueCreate({ "--title": "Store Revisions" }, revisionRoot))
    await storeSet({ "--id": created.id, "--store": "research", "--key": "summary" }, fakeStdin("phase one"), revisionRoot)
    await issuePhaseSet({ "--id": created.id, "--value": "ready-to-code" }, revisionRoot)
    await storeSet({ "--id": created.id, "--store": "research", "--key": "summary" }, fakeStdin("phase two"), revisionRoot)
    expect(await storeGet({ "--id": created.id, "--store": "research", "--key": "summary" }, revisionRoot)).toEqual({
      value: "phase two",
    })

    const saved = readCanonicalEvents(revisionRoot, created.id)
      .filter((event) => event.type === "StoreRevisionSaved")
      .map((event) => expectJsonObject(event.payload))
      .filter((payload) => payload.store === "research" && payload.key === "summary")

    expect(saved).toHaveLength(2)
    expectRecordWithFields(saved, { revision: 1, phase: "research", content: "phase one" })
    expectRecordWithFields(saved, { revision: 2, phase: "ready-to-code", content: "phase two", supersedesRevision: 1 })
  })

  test("stale issue writes fail with optimistic-concurrency errors", async () => {
    const concurrencyRoot = join(getRoot(), "stale-issue-writes")
    const created = (await issueCreate({ "--title": "Stale Writer" }, concurrencyRoot))
    const aggregate = await readTrackedIssueAggregate(concurrencyRoot, created.id)
    await issueMetaSet({ "--id": created.id, "--key": "owner", "--value": "backend" }, concurrencyRoot)

    await expect(
      appendTrackedIssueEvents(
        concurrencyRoot,
        created.id,
        [issueMetadataSetEvent(created.id, "owner", "frontend", new Date().toISOString())],
        aggregate.maxPosition
      )
    ).rejects.toThrow("Append precondition failed: queried tag boundary changed before append")

    await expect(issueMetaGet({ "--id": created.id, "--key": "owner" }, concurrencyRoot)).resolves.toEqual({
      value: "backend",
    })
  })
})
