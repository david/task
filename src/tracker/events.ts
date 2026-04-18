import type { DomainEvent, StoredEvent } from "../../packages/esther/src/index.ts"

export type IssueMetadata = {
  title: string
  description: string
  status: "open"
  phase: string
  priority: number
  created: string
  updated: string
  refs: string[]
  labels: string[]
  github_issue?: number
}

export type IssueRecord = IssueMetadata & {
  id: string
}

export type IssueCreatedPayload = IssueMetadata & {
  issueId: string
  parentId?: string
}

type ParseSuccess<T> = {
  success: true
  data: T
}

type ParseFailure = {
  success: false
  error: string
}

export const storedEventSchema = {
  safeParse(value: unknown): ParseSuccess<StoredEvent> | ParseFailure {
    if (!isStoredEvent(value)) {
      return { success: false, error: "not a StoredEvent" }
    }
    return { success: true, data: value }
  },
}

export function issueBoundaryTag(issueId: string): string {
  return `issue:${issueId}`
}

export function parentTag(parentId: string): string {
  return `parent:${parentId}`
}

export function issueCreatedEvent(
  issue: IssueRecord,
  parentId?: string
): DomainEvent<"IssueCreated", IssueCreatedPayload> {
  return {
    type: "IssueCreated",
    tags: [
      issueBoundaryTag(issue.id),
      "kind:issue",
      ...(parentId === undefined ? [] : [parentTag(parentId)]),
    ],
    payload: {
      issueId: issue.id,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      phase: issue.phase,
      priority: issue.priority,
      created: issue.created,
      updated: issue.updated,
      refs: [...issue.refs],
      labels: [...issue.labels],
      ...(issue.github_issue === undefined ? {} : { github_issue: issue.github_issue }),
      ...(parentId === undefined ? {} : { parentId }),
    },
  }
}

export function foldIssue(events: ReadonlyArray<StoredEvent>): IssueMetadata | undefined {
  let current: IssueMetadata | undefined

  for (const event of events) {
    if (event.type !== "IssueCreated") continue
    const payload = parseIssueCreatedPayload(event.payload)
    if (!payload) continue

    current = {
      title: payload.title,
      description: payload.description,
      status: payload.status,
      phase: payload.phase,
      priority: payload.priority,
      created: payload.created,
      updated: payload.updated,
      refs: [...payload.refs],
      labels: [...payload.labels],
      ...(payload.github_issue === undefined ? {} : { github_issue: payload.github_issue }),
    }
  }

  return current
}

function isStoredEvent(value: unknown): value is StoredEvent {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    typeof record.type === "string" &&
    Array.isArray(record.tags) &&
    typeof record.position === "bigint" &&
    record.timestamp instanceof Date
  )
}

export function parseIssueCreatedPayload(value: unknown): IssueCreatedPayload | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const record = value as Record<string, unknown>

  if (
    typeof record.issueId !== "string" ||
    typeof record.title !== "string" ||
    typeof record.description !== "string" ||
    record.status !== "open" ||
    typeof record.phase !== "string" ||
    typeof record.priority !== "number" ||
    typeof record.created !== "string" ||
    typeof record.updated !== "string" ||
    !isStringArray(record.refs) ||
    !isStringArray(record.labels)
  ) {
    return undefined
  }

  if (record.github_issue !== undefined && typeof record.github_issue !== "number") {
    return undefined
  }

  if (record.parentId !== undefined && typeof record.parentId !== "string") {
    return undefined
  }

  return {
    issueId: record.issueId,
    title: record.title,
    description: record.description,
    status: "open",
    phase: record.phase,
    priority: record.priority,
    created: record.created,
    updated: record.updated,
    refs: [...record.refs],
    labels: [...record.labels],
    ...(record.github_issue === undefined ? {} : { github_issue: record.github_issue }),
    ...(record.parentId === undefined ? {} : { parentId: record.parentId }),
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}
