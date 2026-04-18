import { randomBytes } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import type { StoredEvent } from "../../packages/esther/src/index.ts"
import { foldIssue, issueBoundaryTag, issueCreatedEvent, type IssueMetadata, type IssueRecord, storedEventSchema } from "./events"
import { materializeHierarchyLink } from "./hierarchy"
import { getTrackerHandles, listCanonicalIssueIds, listProjectedIssueIds } from "./root"

export type CreateIssueInput = {
  title: string
  description: string
  priority: number
  labels: string[]
  githubIssue?: number
  parentRef?: string
}

type QueryStoredEventsByTags = <TState>(
  tags: ReadonlyArray<string>,
  schemas: ReadonlyArray<{ safeParse(value: unknown): { success: true; data: StoredEvent } | { success: false; error?: unknown } }>,
  fold: (events: ReadonlyArray<StoredEvent>) => TState
) => Promise<{ state: TState; maxPosition: bigint | undefined }>

const ISSUE_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"

export async function createTrackedIssue(
  root: string,
  input: CreateIssueInput
): Promise<IssueRecord> {
  const tracker = getTrackerHandles(root)
  const parentId = input.parentRef === undefined
    ? undefined
    : await resolveOpenParentIssueId(root, input.parentRef)
  const id = generateIssueId(root)
  const issue: IssueRecord = {
    id: `${id}-${slugify(input.title)}`,
    title: input.title,
    description: input.description,
    status: "open",
    phase: "research",
    priority: input.priority,
    created: new Date().toISOString().slice(0, 10),
    updated: new Date().toISOString(),
    refs: [],
    labels: [...input.labels],
    ...(input.githubIssue === undefined ? {} : { github_issue: input.githubIssue }),
  }

  const appended = await tracker.eventStore.append([issueCreatedEvent(issue, parentId)], {
    expectedPosition: undefined,
    boundaryTags: [issueBoundaryTag(issue.id)],
  })

  if (appended.isErr()) {
    throw new Error("message" in appended.error ? appended.error.message : "Tracker append failed")
  }

  materializeIssueProjection(root, issue)
  await materializeHierarchyLink(root, issue.id, parentId)
  return issue
}

export async function loadTrackedIssue(
  root: string,
  issueId: string
): Promise<{ id: string; metadata: IssueMetadata; stores: Record<string, string[]> }> {
  const projectionPath = await ensureIssueProjection(root, issueId)
  const metadata = JSON.parse(readFileSync(join(projectionPath, "issue.json"), "utf-8")) as IssueMetadata

  return {
    id: issueId,
    metadata,
    stores: loadIssueStores(projectionPath),
  }
}

export async function listTrackedIssues(root: string, includeAll: boolean): Promise<IssueRecord[]> {
  const archivedIds = new Set<string>(listProjectedIssueIds(root, true))
  const issueIds = new Set<string>(listProjectedIssueIds(root, false))
  for (const issueId of listCanonicalIssueIds(root)) {
    if (!archivedIds.has(issueId)) {
      issueIds.add(issueId)
    }
  }

  const issues: IssueRecord[] = []
  for (const issueId of [...issueIds].sort()) {
    const { metadata } = await loadTrackedIssue(root, issueId)
    issues.push({ id: issueId, ...metadata })
  }

  if (includeAll) {
    const tracker = getTrackerHandles(root)
    for (const issueId of [...archivedIds].sort()) {
      const projectionPath = join(tracker.archiveRoot, issueId)
      const metadata = JSON.parse(readFileSync(join(projectionPath, "issue.json"), "utf-8")) as IssueMetadata
      issues.push({ id: issueId, ...metadata })
    }
  }

  return issues
}

export async function searchTrackedIssues(
  root: string,
  includeAll: boolean,
  query: string
): Promise<IssueRecord[]> {
  const normalized = query.toLowerCase()
  const issues = await listTrackedIssues(root, includeAll)
  return issues.filter((issue) => matchesText(issue, normalized))
}

export function loadArchivedTrackedIssue(
  root: string,
  issueId: string
): { id: string; metadata: IssueMetadata; stores: Record<string, string[]> } {
  const tracker = getTrackerHandles(root)
  const issueDir = join(tracker.archiveRoot, issueId)
  const metadata = JSON.parse(readFileSync(join(issueDir, "issue.json"), "utf-8")) as IssueMetadata

  return {
    id: issueId,
    metadata,
    stores: loadIssueStores(issueDir),
  }
}

export function materializeIssueProjection(root: string, issue: IssueRecord): void {
  const tracker = getTrackerHandles(root)
  const issueDir = join(tracker.issueRoot, issue.id)
  mkdirSync(issueDir, { recursive: true })
  writeFileSync(join(issueDir, "issue.json"), `${JSON.stringify(stripIssueId(issue), null, 2)}\n`)
}

async function ensureIssueProjection(root: string, issueId: string): Promise<string> {
  const tracker = getTrackerHandles(root)
  const issueDir = join(tracker.issueRoot, issueId)
  const issueJson = join(issueDir, "issue.json")
  if (existsSync(issueJson)) {
    return issueDir
  }

  const rebuilt = await rebuildIssueProjectionFromHistory(root, issueId)
  if (rebuilt === undefined) {
    throw new Error(`Issue '${issueId}' not found`)
  }
  return rebuilt
}

async function rebuildIssueProjectionFromHistory(root: string, issueId: string): Promise<string | undefined> {
  const tracker = getTrackerHandles(root)
  const queryByTags = tracker.eventStore.queryByTags as unknown as QueryStoredEventsByTags
  const result = await queryByTags(
    [issueBoundaryTag(issueId)],
    [storedEventSchema],
    (events) => foldIssue(events)
  )

  if (result.state === undefined) {
    return undefined
  }

  materializeIssueProjection(root, { id: issueId, ...result.state })
  return join(tracker.issueRoot, issueId)
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

function generateIssueId(root: string): string {
  const knownIds = new Set<string>([
    ...listProjectedIssueIds(root, false),
    ...listProjectedIssueIds(root, true),
    ...listCanonicalIssueIds(root),
  ])

  for (let attempt = 0; attempt < 100; attempt++) {
    const bytes = randomBytes(4)
    let candidate = ""
    for (let i = 0; i < 4; i++) {
      candidate += ISSUE_ID_CHARS[bytes[i] % ISSUE_ID_CHARS.length]
    }

    const collision = [...knownIds].some((issueId) => issueId.startsWith(`${candidate}-`))
    if (!collision) {
      return candidate
    }
  }

  throw new Error("Failed to generate unique ID after 100 attempts")
}

function stripIssueId(issue: IssueRecord): IssueMetadata {
  const { id: _id, ...metadata } = issue
  return metadata
}

function loadIssueStores(path: string): Record<string, string[]> {
  const stores: Record<string, string[]> = {}
  const entries = readdirSync(path)
  for (const entry of entries) {
    if (entry === "issue.json") continue
    const entryPath = join(path, entry)
    if (statSync(entryPath).isDirectory()) {
      stores[entry] = readdirSync(entryPath).sort()
    }
  }
  return stores
}

function matchesText(issue: IssueRecord, normalizedQuery: string): boolean {
  const haystacks: string[] = [issue.id, issue.title, issue.description]
  haystacks.push(...issue.refs)
  haystacks.push(...issue.labels)
  return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery))
}

type ResolvedTrackedIssue = {
  issueId: string
  archived: boolean
}

function resolveTrackedIssueId(root: string, issueRef: string): ResolvedTrackedIssue {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(issueRef)) {
    throw new Error(
      `Invalid parent issue ID '${issueRef}': must be lowercase alphanumeric (with optional slug)`
    )
  }

  const prefix = issueRef.split("-")[0]
  const archivedIds = new Set<string>(
    listProjectedIssueIds(root, true).filter((issueId) => issueId.startsWith(`${prefix}-`))
  )
  const activeIds = new Set<string>(
    listProjectedIssueIds(root, false).filter((issueId) => issueId.startsWith(`${prefix}-`))
  )

  for (const issueId of listCanonicalIssueIds(root)) {
    if (issueId.startsWith(`${prefix}-`) && !archivedIds.has(issueId)) {
      activeIds.add(issueId)
    }
  }

  const matches = [
    ...[...activeIds].sort().map((issueId) => ({ issueId, archived: false as const })),
    ...[...archivedIds].sort().map((issueId) => ({ issueId, archived: true as const })),
  ]

  if (matches.length === 0) {
    throw new Error(`Parent issue '${issueRef}' not found`)
  }

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous parent issue ID '${issueRef}': ${matches.map((match) => match.issueId).join(", ")}`
    )
  }

  return matches[0]
}

async function resolveOpenParentIssueId(root: string, parentRef: string): Promise<string> {
  const resolved = resolveTrackedIssueId(root, parentRef)
  if (resolved.archived) {
    throw new Error(`Parent issue '${parentRef}' is closed`)
  }

  const parent = await loadTrackedIssue(root, resolved.issueId)
  if (parent.metadata.status !== "open") {
    throw new Error(`Parent issue '${parentRef}' is not open`)
  }

  return parent.id
}
