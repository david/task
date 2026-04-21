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

type CreatedIssue = Awaited<ReturnType<typeof issueCreate>>
type DocumentEntries = Awaited<ReturnType<typeof documentGet>>["entries"]

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

async function createLegacyIssueFixture(
  rootName: string,
  title: string,
  buildEvents: (issueId: string) => ReadonlyArray<TestIssueEvent>
): Promise<{ root: string; created: CreatedIssue }> {
  const root = join(getRoot(), rootName)
  const created = await issueCreate({ "--title": title }, root)
  await appendLegacyStoreEvents(root, created.id, buildEvents(created.id))
  return { root, created }
}

async function expectDocumentEntries(
  root: string,
  issueId: string,
  key: string,
  entries: DocumentEntries
): Promise<void> {
  await expect(documentGet({ "--id": issueId, "--key": key }, root)).resolves.toEqual({ entries })
}

async function expectShownIssue(
  root: string,
  issueId: string,
  title: string,
  phase: string,
  keys: string[]
): Promise<void> {
  const shown = await issueShow({ "--id": issueId }, root)
  expect(shown.id).toBe(issueId)
  expect(shown.metadata["title"]).toBe(title)
  expect(shown.metadata["phase"]).toBe(phase)
  expect("keys" in shown ? shown.keys : undefined).toEqual(keys)
}

function expectProjectedMarkdown(
  root: string,
  issueId: string,
  pathSegments: string[],
  content: string
): void {
  const path = join(issueProjectionRoot(root), issueId, ...pathSegments)
  expect(readFileSync(path, "utf-8")).toBe(content)
}

function readSavedRevisionPayload(root: string, issueId: string) {
  const savedEvents = readCanonicalEvents(root, issueId).filter((event) => event.type === "IssueDocumentRevisionSaved")
  expect(savedEvents).toHaveLength(1)
  return issueDocumentRevisionSavedPayloadSchema.parse(savedEvents[0]?.payload)
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

async function runLegacyStoreReadCase(): Promise<void> {
  const fixture = await createLegacyIssueFixture("legacy-store-history-read", "Legacy Store History", (issueId) => [
    legacyStoreRevisionSavedEvent({
      issueId,
      store: "research",
      key: "summary",
      revision: 1,
      phase: "research",
      draft: true,
      content: "legacy summary",
      savedAt: "2024-03-01T10:00:00.000Z",
    }),
    legacyStoreRevisionFinalizedEvent({
      issueId,
      store: "research",
      key: "summary",
      revision: 1,
      phase: "research",
      finalizedAt: "2024-03-01T10:05:00.000Z",
    }),
    legacyStoreRevisionSavedEvent({
      issueId,
      store: "tasks",
      key: "plan",
      revision: 1,
      phase: "research",
      draft: true,
      content: "legacy plan",
      savedAt: "2024-03-01T10:10:00.000Z",
    }),
  ])

  await expectDocumentEntries(fixture.root, fixture.created.id, "/", {
    research: { entries: { summary: { value: "legacy summary" } } },
    tasks: { entries: { plan: { value: "legacy plan" } } },
  })
  await expectShownIssue(fixture.root, fixture.created.id, "Legacy Store History", "research", [
    "research/summary",
    "tasks/plan",
  ])
  expectProjectedMarkdown(fixture.root, fixture.created.id, ["research", "summary.md"], "legacy summary")
  expectProjectedMarkdown(fixture.root, fixture.created.id, ["tasks", "plan.md"], "legacy plan")
}

async function runLegacyStoreDeleteCase(): Promise<void> {
  const fixture = await createLegacyIssueFixture("legacy-store-history-delete", "Legacy Store Delete", (issueId) => [
    legacyStoreRevisionSavedEvent({
      issueId,
      store: "research",
      key: "summary",
      revision: 1,
      phase: "research",
      draft: true,
      content: "summary",
      savedAt: "2024-03-02T09:00:00.000Z",
    }),
    legacyStoreRevisionSavedEvent({
      issueId,
      store: "research",
      key: "notes",
      revision: 1,
      phase: "research",
      draft: true,
      content: "notes",
      savedAt: "2024-03-02T09:01:00.000Z",
    }),
    legacyStoreRevisionSavedEvent({
      issueId,
      store: "qa",
      key: "checklist",
      revision: 1,
      phase: "research",
      draft: true,
      content: "checklist",
      savedAt: "2024-03-02T09:02:00.000Z",
    }),
    legacyStoreEntryDeletedEvent({
      issueId,
      store: "research",
      key: "summary",
      deletedAt: "2024-03-02T09:03:00.000Z",
    }),
    legacyStoreDeletedEvent({
      issueId,
      store: "qa",
      deletedAt: "2024-03-02T09:04:00.000Z",
    }),
  ])

  await expectDocumentEntries(fixture.root, fixture.created.id, "/", {
    research: { entries: { notes: { value: "notes" } } },
  })
  await expectShownIssue(fixture.root, fixture.created.id, "Legacy Store Delete", "research", ["research/notes"])
}

async function runLegacyStoreResaveCase(): Promise<void> {
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
  await documentSet({ "--id": created.id, "--key": "research/summary", "--value": "phase two" }, throwOnStdinRead, root)
  await expectDocumentEntries(root, created.id, "research/summary", {
    research: { entries: { summary: { value: "phase two" } } },
  })

  const payload = readSavedRevisionPayload(root, created.id)
  expect(payload.issueId).toBe(created.id)
  expect(payload.path).toBe("research/summary")
  expect(payload.revision).toBe(2)
  expect(payload.phase).toBe("ready-to-code")
  expect("supersedesRevision" in payload ? payload.supersedesRevision : undefined).toBe(1)
  expect(payload.content).toBe("phase two")
}

function throwOnStdinRead(): never {
  throw new Error("stdin should not be read")
}

function registerLegacyStoreReadTest(): void {
  test("reads old store revisions through the document surface and materialized projections", async () => {
    await runLegacyStoreReadCase()
  })
}

function registerLegacyStoreDeleteTest(): void {
  test("maps old store delete events onto the current document tree", async () => {
    await runLegacyStoreDeleteCase()
  })
}

function registerLegacyStoreResaveTest(): void {
  test("treats legacy finalized revisions as prior history for later path-based saves", async () => {
    await runLegacyStoreResaveCase()
  })
}

describe("legacy canonical store history", () => {
  registerLegacyStoreReadTest()
  registerLegacyStoreDeleteTest()
  registerLegacyStoreResaveTest()
})
