import { randomBytes } from "node:crypto"
import { join } from "node:path"
import type { SliceError } from "../../packages/esther/src/index.ts"
import { issueBoundaryTag, issueCreatedEvent, type IssueMetadata, type IssueRecord } from "./events"
import { readLegacyIssueRecord, rebuildIssueProjection } from "./projections"
import { loadTaskSettings } from "./settings"
import { getTrackerHandles, listCanonicalIssueIds, listProjectedIssueIds } from "./root"

function byteToIssueChar(value: number): string {
  const normalizedIndex = value % ISSUE_ID_CHARS.length
  const char = ISSUE_ID_CHARS[normalizedIndex]
  if (char === undefined) {
    throw new Error(`Invalid generated issue-id index '${normalizedIndex}'`)
  }
  return char
}

type CreateIssueInputBase = {
  title: string
  description: string
  priority: number
  labels: string[]
}

export type CreateIssueInput =
  | CreateIssueInputBase
  | (CreateIssueInputBase & { githubIssue: number })
  | (CreateIssueInputBase & { parentRef: string })
  | (CreateIssueInputBase & { githubIssue: number; parentRef: string })

const ISSUE_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"

function issueIdPrefix(issueId: string): string {
  const prefix = issueId.split("-", 1)[0]
  if (prefix === undefined || prefix.length === 0) {
    throw new Error(`Invalid issue ID '${issueId}'`)
  }
  return prefix
}

type ResolvedTrackedIssue = {
  issueId: string
  archived: boolean
}

export async function createTrackedIssue(root: string, input: CreateIssueInput): Promise<IssueRecord> {
  const tracker = getTrackerHandles(root)
  const settings = loadTaskSettings(root)
  const parentId = "parentRef" in input
    ? await resolveOpenParentIssueId(root, input.parentRef)
    : undefined
  const id = generateIssueId(root)
  const issue: IssueRecord = {
    id: `${id}-${slugify(input.title)}`,
    title: input.title,
    description: input.description,
    status: "open",
    phase: settings.defaultPhase,
    priority: input.priority,
    created: new Date().toISOString().slice(0, 10),
    updated: new Date().toISOString(),
    refs: [],
    labels: [...input.labels],
    ...("githubIssue" in input ? { github_issue: input.githubIssue } : {}),
  }

  const appended = await tracker.eventStore.append([issueCreatedEvent(issue, parentId)], {
    expectedPosition: undefined,
    boundaryTags: [issueBoundaryTag(issue.id)],
  })

  if (appended.isErr()) {
    throw sliceErrorToError(appended.error)
  }

  await rebuildIssueProjection(root, issue.id)
  return issue
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

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const bytes = randomBytes(4)
    let candidate = ""
    for (const byte of bytes) {
      candidate += byteToIssueChar(byte)
    }

    const collision = [...knownIds].some((issueId) => issueId.startsWith(`${candidate}-`))
    if (!collision) {
      return candidate
    }
  }

  throw new Error("Failed to generate unique ID after 100 attempts")
}

function resolveTrackedIssueId(root: string, issueRef: string): ResolvedTrackedIssue {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(issueRef)) {
    throw new Error(
      `Invalid parent issue ID '${issueRef}': must be lowercase alphanumeric (with optional slug)`
    )
  }

  const prefix = issueIdPrefix(issueRef)
  const currentIds = new Set<string>(
    listProjectedIssueIds(root, false).filter((issueId) => issueId.startsWith(`${prefix}-`))
  )

  for (const issueId of listCanonicalIssueIds(root)) {
    if (issueId.startsWith(`${prefix}-`)) {
      currentIds.add(issueId)
    }
  }

  const archivedIds = new Set<string>(
    listProjectedIssueIds(root, true)
      .filter((issueId) => issueId.startsWith(`${prefix}-`))
      .filter((issueId) => !currentIds.has(issueId))
  )

  const matches = [
    ...[...currentIds].sort().map((issueId) => ({ issueId, archived: false as const })),
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
  const match = matches[0]
  if (match === undefined) {
    throw new Error(`Parent issue '${issueRef}' not found`)
  }
  return match
}

async function resolveOpenParentIssueId(root: string, parentRef: string): Promise<string> {
  const resolved = resolveTrackedIssueId(root, parentRef)
  if (resolved.archived) {
    throw new Error(`Parent issue '${parentRef}' is closed`)
  }

  const metadata = await loadParentMetadata(root, resolved.issueId)
  if (metadata.status !== "open") {
    throw new Error(`Parent issue '${parentRef}' is closed`)
  }

  return resolved.issueId
}

async function loadParentMetadata(root: string, issueId: string): Promise<IssueMetadata> {
  const canonical = await rebuildIssueProjection(root, issueId)
  if (canonical !== undefined) {
    return canonical.state.metadata
  }

  const tracker = getTrackerHandles(root)
  const current = readLegacyIssueRecord(join(tracker.issueRoot, issueId), issueId)
  if (current !== undefined) {
    const { id: _id, ...metadata } = current
    return metadata
  }

  const archived = readLegacyIssueRecord(join(tracker.archiveRoot, issueId), issueId)
  if (archived !== undefined) {
    const { id: _id, ...metadata } = archived
    return metadata
  }

  throw new Error(`Parent issue '${issueId}' not found`)
}

function sliceErrorToError(error: SliceError): Error {
  return new Error("message" in error ? error.message : "Tracker operation failed")
}
