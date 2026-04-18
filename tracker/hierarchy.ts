import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { StoredEvent } from "../packages/esther/src/index.ts"
import { parseIssueCreatedPayload, storedEventSchema } from "./events"
import { getTrackerHandles, listProjectedIssueIds } from "./root"

type QueryStoredEventsByTags = <TState>(
  tags: ReadonlyArray<string>,
  schemas: ReadonlyArray<{ safeParse(value: unknown): { success: true; data: StoredEvent } | { success: false; error?: unknown } }>,
  fold: (events: ReadonlyArray<StoredEvent>) => TState
) => Promise<{ state: TState; maxPosition: bigint | undefined }>

type HierarchyIndex = {
  parentsByChild: Record<string, string[]>
  childrenByParent: Record<string, string[]>
}

function createEmptyHierarchyIndex(): HierarchyIndex {
  return {
    parentsByChild: {},
    childrenByParent: {},
  }
}

function hierarchyIndexDir(root: string): string {
  return join(getTrackerHandles(root).trackerRoot, "indexes", "hierarchy")
}

function hierarchyIndexPaths(root: string): { parentsPath: string; childrenPath: string } {
  const dir = hierarchyIndexDir(root)
  return {
    parentsPath: join(dir, "parents-by-child.json"),
    childrenPath: join(dir, "children-by-parent.json"),
  }
}

function addHierarchyLink(index: HierarchyIndex, childId: string, parentId: string): void {
  const parents = index.parentsByChild[childId] ?? []
  if (!parents.includes(parentId)) {
    parents.push(parentId)
    parents.sort()
    index.parentsByChild[childId] = parents
  }

  const children = index.childrenByParent[parentId] ?? []
  if (!children.includes(childId)) {
    children.push(childId)
    children.sort()
    index.childrenByParent[parentId] = children
  }
}

function isStringArrayRecord(value: unknown): value is Record<string, string[]> {
  if (typeof value !== "object" || value === null) return false
  return Object.values(value).every(
    (entry) => Array.isArray(entry) && entry.every((item) => typeof item === "string")
  )
}

function readHierarchyIndex(root: string): HierarchyIndex | undefined {
  const { parentsPath, childrenPath } = hierarchyIndexPaths(root)
  if (!existsSync(parentsPath) || !existsSync(childrenPath)) {
    return undefined
  }

  try {
    const parentsByChild = JSON.parse(readFileSync(parentsPath, "utf-8")) as unknown
    const childrenByParent = JSON.parse(readFileSync(childrenPath, "utf-8")) as unknown
    if (!isStringArrayRecord(parentsByChild) || !isStringArrayRecord(childrenByParent)) {
      return undefined
    }
    return {
      parentsByChild,
      childrenByParent,
    }
  } catch {
    return undefined
  }
}

function writeHierarchyIndex(root: string, index: HierarchyIndex): void {
  const { parentsPath, childrenPath } = hierarchyIndexPaths(root)
  mkdirSync(hierarchyIndexDir(root), { recursive: true })
  writeFileSync(parentsPath, `${JSON.stringify(index.parentsByChild, null, 2)}\n`)
  writeFileSync(childrenPath, `${JSON.stringify(index.childrenByParent, null, 2)}\n`)
}

function foldHierarchyIndex(events: ReadonlyArray<StoredEvent>): HierarchyIndex {
  const index = createEmptyHierarchyIndex()

  for (const event of events) {
    if (event.type !== "IssueCreated") continue
    const payload = parseIssueCreatedPayload(event.payload)
    if (!payload?.parentId) continue
    addHierarchyLink(index, payload.issueId, payload.parentId)
  }

  return index
}

async function rebuildHierarchyIndex(root: string): Promise<HierarchyIndex> {
  const tracker = getTrackerHandles(root)
  const queryByTags = tracker.eventStore.queryByTags as unknown as QueryStoredEventsByTags
  const result = await queryByTags(["kind:issue"], [storedEventSchema], (events) =>
    foldHierarchyIndex(events)
  )
  writeHierarchyIndex(root, result.state)
  return result.state
}

async function loadHierarchyIndex(root: string): Promise<HierarchyIndex> {
  return readHierarchyIndex(root) ?? rebuildHierarchyIndex(root)
}

export async function materializeHierarchyLink(
  root: string,
  childId: string,
  parentId: string | undefined
): Promise<void> {
  if (parentId === undefined) {
    return
  }

  const index = readHierarchyIndex(root) ?? (await rebuildHierarchyIndex(root))
  addHierarchyLink(index, childId, parentId)
  writeHierarchyIndex(root, index)
}

export async function listHierarchyChildren(
  root: string,
  parentId: string,
  includeArchived: boolean
): Promise<string[]> {
  const index = await loadHierarchyIndex(root)
  const childIds = [...(index.childrenByParent[parentId] ?? [])]
  if (includeArchived) {
    return childIds
  }

  const archivedIds = new Set<string>(listProjectedIssueIds(root, true))
  return childIds.filter((childId) => !archivedIds.has(childId))
}

export async function listHierarchyParents(root: string, childId: string): Promise<string[]> {
  const index = await loadHierarchyIndex(root)
  return [...(index.parentsByChild[childId] ?? [])]
}
