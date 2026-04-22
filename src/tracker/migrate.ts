import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs"
import { join, resolve } from "node:path"
import type { DomainEvent } from "../../packages/esther/src/index.ts"
import {
  issueBoundaryTag,
  issueClosedEvent,
  issueCreatedEvent,
  issueDocumentRevisionFinalizedEvent,
  issueDocumentRevisionSavedEvent,
  issueMetadataSetEvent,
  type IssueRecord,
} from "./events"
import type { JsonValue } from "../types"
import { rebuildCurrentIssueIndex, rebuildHierarchyIndex, readLegacyIssueRecord, readIssueStoreKeys } from "./projections"
import { joinLegacyStorePath, parseExactDocumentPath } from "./document-paths"
import { getTrackerHandles, listCanonicalIssueIds, listProjectedIssueIds } from "./root"

type LegacyIssueSnapshot = {
  issueId: string
  metadata: IssueRecord
  storeEntries: Array<{ store: string; key: string; content: string }>
  archived: boolean
}

type LegacyIssuePlanBase = {
  issueId: string
  created: IssueRecord
  extraMetadata: Array<{ key: string; value: JsonValue }>
  storeEntries: Array<{ store: string; key: string; content: string }>
  closed: boolean
}

type LegacyIssuePlan =
  | LegacyIssuePlanBase
  | (LegacyIssuePlanBase & { parentId: string })

export type LegacyImportResult = {
  imported: true
  source: string
  issueCount: number
  storeCount: number
}

const ISSUE_REF_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

function issueIdPrefix(issueId: string): string {
  const prefix = issueId.split("-", 1)[0]
  if (prefix === undefined || prefix.length === 0) {
    throw new Error(`Invalid legacy issue ref '${issueId}'`)
  }
  return prefix
}

const STANDARD_METADATA_KEYS = new Set([
  "id",
  "title",
  "description",
  "status",
  "phase",
  "priority",
  "created",
  "updated",
  "refs",
  "labels",
  "github_issue",
])

export async function importLegacyTracker(root: string, sourceRoot: string): Promise<LegacyImportResult> {
  assertTargetTrackerEmpty(root)

  const resolvedSource = resolve(sourceRoot)
  const snapshots = readLegacyIssueSnapshots(resolvedSource)
  if (snapshots.length === 0) {
    throw new Error("legacy_tracker_not_found")
  }

  const plans = planLegacyImport(snapshots)
  const tracker = getTrackerHandles(root)
  for (const plan of plans) {
    await appendLegacyPlan(tracker, plan)
  }

  await rebuildCurrentIssueIndex(root)
  await rebuildHierarchyIndex(root)

  return {
    imported: true,
    source: resolvedSource,
    issueCount: plans.length,
    storeCount: plans.reduce((sum, plan) => sum + plan.storeEntries.length, 0),
  }
}

function normalizeLegacyImportDocumentPath(store: string, key: string): string {
  const normalizedKey = key.endsWith(".md") ? key.slice(0, -".md".length) : key
  return parseExactDocumentPath(joinLegacyStorePath(store, normalizedKey))
}

function buildLegacyPlanEvents(plan: LegacyIssuePlan): DomainEvent[] {
  const updatedAt = normalizeUpdatedAt(plan.created.updated, plan.created.created)
  const createdDate = normalizeCreatedDate(plan.created.created, updatedAt)
  const createdEventIssue: IssueRecord = {
    ...plan.created,
    status: "open",
    created: createdDate,
    updated: updatedAt,
    priority: normalizePriority(plan.created.priority),
  }

  const events: DomainEvent[] = [
    issueCreatedEvent(createdEventIssue, "parentId" in plan ? plan.parentId : undefined),
  ]

  for (const extra of plan.extraMetadata) {
    events.push(issueMetadataSetEvent(plan.issueId, extra.key, extra.value, updatedAt))
  }

  for (const storeEntry of plan.storeEntries) {
    const path = normalizeLegacyImportDocumentPath(storeEntry.store, storeEntry.key)
    events.push(
      issueDocumentRevisionSavedEvent({
        issueId: plan.issueId,
        path,
        revision: 1,
        phase: createdEventIssue.phase,
        draft: true,
        content: storeEntry.content,
        savedAt: updatedAt,
      }),
      issueDocumentRevisionFinalizedEvent({
        issueId: plan.issueId,
        path,
        revision: 1,
        phase: createdEventIssue.phase,
        finalizedAt: updatedAt,
      })
    )
  }

  if (plan.closed) {
    events.push(issueClosedEvent(plan.issueId, updatedAt))
  }

  return events
}

async function appendLegacyPlan(
  tracker: ReturnType<typeof getTrackerHandles>,
  plan: LegacyIssuePlan
): Promise<void> {
  const appended = await tracker.eventStore.append(buildLegacyPlanEvents(plan), {
    expectedPosition: undefined,
    boundaryTags: [issueBoundaryTag(plan.issueId)],
  })
  if (appended.isErr()) {
    throw new Error("message" in appended.error ? appended.error.message : "Tracker operation failed")
  }
}

function assertTargetTrackerEmpty(root: string): void {
  if (
    listCanonicalIssueIds(root).length > 0 ||
    listProjectedIssueIds(root, false).length > 0 ||
    listProjectedIssueIds(root, true).length > 0
  ) {
    throw new Error("target_already_initialized")
  }
}

function readLegacyIssueSnapshots(sourceRoot: string): LegacyIssueSnapshot[] {
  if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
    throw new Error("legacy_tracker_not_found")
  }

  const snapshots: LegacyIssueSnapshot[] = []
  const seen = new Set<string>()

  for (const entry of readLegacyIssueDirectory(sourceRoot, false)) {
    if (seen.has(entry.issueId)) {
      throw new Error(`duplicate_legacy_issue_id:${entry.issueId}`)
    }
    seen.add(entry.issueId)
    snapshots.push(entry)
  }

  for (const entry of readLegacyIssueDirectory(join(sourceRoot, ".archive"), true)) {
    if (seen.has(entry.issueId)) {
      throw new Error(`duplicate_legacy_issue_id:${entry.issueId}`)
    }
    seen.add(entry.issueId)
    snapshots.push(entry)
  }

  return snapshots.sort((a, b) => a.issueId.localeCompare(b.issueId))
}

function readLegacyIssueDirectory(root: string, archived: boolean): LegacyIssueSnapshot[] {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return []
  }

  const snapshots: LegacyIssueSnapshot[] = []
  for (const entry of readdirSync(root).sort()) {
    if (entry.startsWith(".")) {
      continue
    }

    const issueDir = join(root, entry)
    if (!statSync(issueDir).isDirectory()) {
      continue
    }

    const metadata = readLegacyIssueRecord(issueDir, entry)
    if (metadata === undefined) {
      continue
    }

    const storeEntries = readLegacyStoreEntries(issueDir)
    snapshots.push({
      issueId: entry,
      metadata,
      storeEntries,
      archived,
    })
  }

  return snapshots
}

function readLegacyStoreEntries(issueDir: string): Array<{ store: string; key: string; content: string }> {
  const storeEntries: Array<{ store: string; key: string; content: string }> = []
  for (const [store, keys] of Object.entries(readIssueStoreKeys(issueDir)).sort(([a], [b]) => a.localeCompare(b))) {
    for (const key of keys) {
      const keyPath = join(issueDir, store, key)
      if (!statSync(keyPath).isFile()) {
        continue
      }
      storeEntries.push({
        store,
        key,
        content: readFileSync(keyPath, "utf-8"),
      })
    }
  }
  return storeEntries
}

function planLegacyImport(snapshots: ReadonlyArray<LegacyIssueSnapshot>): LegacyIssuePlan[] {
  const issueIds = snapshots.map((snapshot) => snapshot.issueId)

  return snapshots.map((snapshot) => {
    const parentResolution = inferLegacyParent(snapshot.metadata.refs, snapshot.issueId, issueIds)
    const created: IssueRecord = {
      ...snapshot.metadata,
      status: "open",
      refs: parentResolution.externalRefs,
      labels: [...snapshot.metadata.labels],
    }

    const extraMetadata = Object.entries(snapshot.metadata)
      .filter(
        (entry): entry is [string, JsonValue] => !STANDARD_METADATA_KEYS.has(entry[0]) && entry[1] !== undefined
      )
      .map(([key, value]) => ({ key, value }))

    const planBase: LegacyIssuePlanBase = {
      issueId: snapshot.issueId,
      created,
      extraMetadata,
      storeEntries: snapshot.storeEntries,
      closed: snapshot.archived || snapshot.metadata.status === "closed",
    }

    return "parentId" in parentResolution
      ? { ...planBase, parentId: parentResolution.parentId }
      : planBase
  })
}

type ResolvedLegacyIssueRef =
  | { kind: "external" }
  | { kind: "ambiguous" }
  | { kind: "issue"; issueId: string }

function inferLegacyParent(
  refs: ReadonlyArray<string>,
  issueId: string,
  issueIds: ReadonlyArray<string>
): { externalRefs: string[] } | { parentId: string; externalRefs: string[] } {
  const externalRefs: string[] = []
  const localParents = new Set<string>()

  for (const ref of refs) {
    const resolved = resolveLegacyIssueRef(ref, issueIds)
    if (resolved.kind === "external") {
      externalRefs.push(ref)
      continue
    }

    if (resolved.kind === "ambiguous") {
      throw new Error("ambiguous_legacy_parent")
    }

    localParents.add(resolved.issueId)
  }

  if (localParents.size > 1) {
    throw new Error("ambiguous_legacy_parent")
  }

  const [parentId] = [...localParents]
  if (parentId === issueId) {
    return { externalRefs }
  }

  return parentId === undefined ? { externalRefs } : { parentId, externalRefs }
}

function resolveLegacyIssueRef(
  ref: string,
  issueIds: ReadonlyArray<string>
): ResolvedLegacyIssueRef {
  if (!ISSUE_REF_RE.test(ref)) {
    return { kind: "external" }
  }

  const prefix = issueIdPrefix(ref)
  const matches = issueIds.filter((issueId) => issueId.startsWith(`${prefix}-`))
  if (matches.length === 0) {
    return { kind: "external" }
  }
  if (matches.length > 1) {
    return { kind: "ambiguous" }
  }
  const match = matches[0]
  if (match === undefined) {
    return { kind: "external" }
  }
  return { kind: "issue", issueId: match }
}

function normalizeCreatedDate(created: string, updatedAt: string): string {
  if (typeof created === "string" && created.length > 0) {
    return created
  }
  return updatedAt.slice(0, 10)
}

function normalizeUpdatedAt(updated: string, created: string): string {
  if (typeof updated === "string" && updated.length > 0) {
    return updated
  }
  if (typeof created === "string" && created.length > 0) {
    return `${created}T00:00:00.000Z`
  }
  return new Date().toISOString()
}

function normalizePriority(priority: JsonValue | undefined): number {
  return typeof priority === "number" && Number.isFinite(priority) ? priority : 2
}
