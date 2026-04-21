import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { documentGet, documentSet, issueCreate, issuePhaseSet, issueShow } from "./commands"
import { issueProjectionRoot, readCanonicalEvents, useTempRoot, writeTaskSettings } from "./commands-test-helpers"
import { issueDocumentRevisionSavedPayloadSchema } from "./tracker/events"
import { appendTrackedIssueEvents, readTrackedIssueAggregate } from "./tracker/issues"
import type { JsonValue } from "./types"

type TestIssueEvent = {
  type: string
  tags: string[]
  payload: JsonValue
}

type LegacyStoreRevisionSavedEventInputBase = {
  issueId: string
  store: string
  key: string
  revision: number
  phase: string
  draft: boolean
  content: string
  savedAt: string
}

type LegacyStoreRevisionSavedEventInput =
  | LegacyStoreRevisionSavedEventInputBase
  | (LegacyStoreRevisionSavedEventInputBase & {
      supersedesRevision: number
    })

const getRoot = useTempRoot("commands-document-legacy-history-")

async function appendLegacyStoreEvents(
  root: string,
  issueId: string,
  events: ReadonlyArray<TestIssueEvent>
): Promise<void> {
  const aggregate = await readTrackedIssueAggregate(root, issueId)
  await appendTrackedIssueEvents(root, issueId, events, aggregate.maxPosition)
}

function legacyStoreRevisionSavedEvent(input: LegacyStoreRevisionSavedEventInput): TestIssueEvent {
  return {
    type: "StoreRevisionSaved",
    tags: [`issue:${input.issueId}`, `store:${input.store}`],
    payload: {
      issueId: input.issueId,
      store: input.store,
      key: input.key,
      revision: input.revision,
      phase: input.phase,
      draft: input.draft,
      content: input.content,
      savedAt: input.savedAt,
      ...("supersedesRevision" in input ? { supersedesRevision: input.supersedesRevision } : {}),
    },
  }
}

function legacyStoreRevisionFinalizedEvent(input: {
  issueId: string
  store: string
  key: string
  revision: number
  phase: string
  finalizedAt: string
}): TestIssueEvent {
  return {
    type: "StoreRevisionFinalized",
    tags: [`issue:${input.issueId}`, `store:${input.store}`],
    payload: input,
  }
}

function legacyStoreEntryDeletedEvent(input: {
  issueId: string
  store: string
  key: string
  deletedAt: string
}): TestIssueEvent {
  return {
    type: "StoreEntryDeleted",
    tags: [`issue:${input.issueId}`, `store:${input.store}`],
    payload: input,
  }
}

function legacyStoreDeletedEvent(input: {
  issueId: string
  store: string
  deletedAt: string
}): TestIssueEvent {
  return {
    type: "StoreDeleted",
    tags: [`issue:${input.issueId}`, `store:${input.store}`],
    payload: input,
  }
}

describe("legacy canonical store history", () => {
  test("reads old store revisions through the document surface and materialized projections", async () => {
    const root = join(getRoot(), "legacy-store-history-read")
    const created = await issueCreate({ "--title": "Legacy Store History" }, root)

    await appendLegacyStoreEvents(root, created.id, [
      legacyStoreRevisionSavedEvent({
        issueId: created.id,
        store: "research",
        key: "summary",
        revision: 1,
        phase: "research",
        draft: true,
        content: "legacy summary",
        savedAt: "2024-03-01T10:00:00.000Z",
      }),
      legacyStoreRevisionFinalizedEvent({
        issueId: created.id,
        store: "research",
        key: "summary",
        revision: 1,
        phase: "research",
        finalizedAt: "2024-03-01T10:05:00.000Z",
      }),
      legacyStoreRevisionSavedEvent({
        issueId: created.id,
        store: "tasks",
        key: "plan",
        revision: 1,
        phase: "research",
        draft: true,
        content: "legacy plan",
        savedAt: "2024-03-01T10:10:00.000Z",
      }),
    ])

    await expect(documentGet({ "--id": created.id, "--key": "/" }, root)).resolves.toEqual({
      entries: {
        research: { entries: { summary: { value: "legacy summary" } } },
        tasks: { entries: { plan: { value: "legacy plan" } } },
      },
    })

    const shown = await issueShow({ "--id": created.id }, root)
    expect(shown.id).toBe(created.id)
    expect(shown.metadata["title"]).toBe("Legacy Store History")
    expect(shown.metadata["phase"]).toBe("research")
    expect("keys" in shown ? shown.keys : undefined).toEqual(["research/summary", "tasks/plan"])

    expect(readFileSync(join(issueProjectionRoot(root), created.id, "research", "summary.md"), "utf-8")).toBe(
      "legacy summary"
    )
    expect(readFileSync(join(issueProjectionRoot(root), created.id, "tasks", "plan.md"), "utf-8")).toBe(
      "legacy plan"
    )
  })

  test("maps old store delete events onto the current document tree", async () => {
    const root = join(getRoot(), "legacy-store-history-delete")
    const created = await issueCreate({ "--title": "Legacy Store Delete" }, root)

    await appendLegacyStoreEvents(root, created.id, [
      legacyStoreRevisionSavedEvent({
        issueId: created.id,
        store: "research",
        key: "summary",
        revision: 1,
        phase: "research",
        draft: true,
        content: "summary",
        savedAt: "2024-03-02T09:00:00.000Z",
      }),
      legacyStoreRevisionSavedEvent({
        issueId: created.id,
        store: "research",
        key: "notes",
        revision: 1,
        phase: "research",
        draft: true,
        content: "notes",
        savedAt: "2024-03-02T09:01:00.000Z",
      }),
      legacyStoreRevisionSavedEvent({
        issueId: created.id,
        store: "qa",
        key: "checklist",
        revision: 1,
        phase: "research",
        draft: true,
        content: "checklist",
        savedAt: "2024-03-02T09:02:00.000Z",
      }),
      legacyStoreEntryDeletedEvent({
        issueId: created.id,
        store: "research",
        key: "summary",
        deletedAt: "2024-03-02T09:03:00.000Z",
      }),
      legacyStoreDeletedEvent({
        issueId: created.id,
        store: "qa",
        deletedAt: "2024-03-02T09:04:00.000Z",
      }),
    ])

    await expect(documentGet({ "--id": created.id, "--key": "/" }, root)).resolves.toEqual({
      entries: {
        research: { entries: { notes: { value: "notes" } } },
      },
    })
    const shown = await issueShow({ "--id": created.id }, root)
    expect(shown.id).toBe(created.id)
    expect(shown.metadata["title"]).toBe("Legacy Store Delete")
    expect("keys" in shown ? shown.keys : undefined).toEqual(["research/notes"])
  })

  test("treats legacy finalized revisions as prior history for later path-based saves", async () => {
    const root = join(getRoot(), "legacy-store-history-resave")
    writeTaskSettings(root, {
      defaultPhase: "research",
      phases: ["research", "ready-to-code"],
      transitions: { research: ["ready-to-code"], "ready-to-code": [] },
    })

    const created = await issueCreate({ "--title": "Legacy Store Resave" }, root)
    await appendLegacyStoreEvents(root, created.id, [
      legacyStoreRevisionSavedEvent({
        issueId: created.id,
        store: "research",
        key: "summary",
        revision: 1,
        phase: "research",
        draft: true,
        content: "phase one",
        savedAt: "2024-03-03T08:00:00.000Z",
      }),
      legacyStoreRevisionFinalizedEvent({
        issueId: created.id,
        store: "research",
        key: "summary",
        revision: 1,
        phase: "research",
        finalizedAt: "2024-03-03T08:05:00.000Z",
      }),
    ])

    await issuePhaseSet({ "--id": created.id, "--value": "ready-to-code" }, root)
    await documentSet({ "--id": created.id, "--key": "research/summary", "--value": "phase two" }, () => {
      throw new Error("stdin should not be read")
    }, root)

    await expect(documentGet({ "--id": created.id, "--key": "research/summary" }, root)).resolves.toEqual({
      entries: {
        research: { entries: { summary: { value: "phase two" } } },
      },
    })

    const savedEvents = readCanonicalEvents(root, created.id).filter((event) => event.type === "IssueDocumentRevisionSaved")
    expect(savedEvents).toHaveLength(1)
    const payload = issueDocumentRevisionSavedPayloadSchema.parse(savedEvents[0]?.payload)
    expect(payload.issueId).toBe(created.id)
    expect(payload.path).toBe("research/summary")
    expect(payload.revision).toBe(2)
    expect(payload.phase).toBe("ready-to-code")
    expect("supersedesRevision" in payload ? payload.supersedesRevision : undefined).toBe(1)
    expect(payload.content).toBe("phase two")
  })
})
