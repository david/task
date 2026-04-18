import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import {
  createFilesystemCheckpointStore,
  createFilesystemEventStore,
  type CheckpointStore,
  type EventStore,
} from "../packages/esther/src/index.ts"

export type TrackerHandles = {
  repoRoot: string
  trackerRoot: string
  issueRoot: string
  archiveRoot: string
  eventStore: EventStore
  checkpointStore: CheckpointStore
}

function directoryExists(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

export function resolveRepoRoot(start: string): string {
  return resolve(start)
}

export function detectRepoRoot(start: string): string {
  let current = resolve(start)
  const fallback = current

  while (true) {
    if (directoryExists(join(current, ".task")) || existsSync(join(current, ".git"))) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) {
      return fallback
    }
    current = parent
  }
}

export function getTrackerRoot(start: string): string {
  return join(resolveRepoRoot(start), ".task")
}

export function getIssueRoot(start: string): string {
  return join(getTrackerRoot(start), "issues")
}

export function getArchiveRoot(start: string): string {
  return join(getIssueRoot(start), ".archive")
}

export function ensureTrackerLayout(start: string): {
  repoRoot: string
  trackerRoot: string
  issueRoot: string
  archiveRoot: string
} {
  const repoRoot = resolveRepoRoot(start)
  const trackerRoot = join(repoRoot, ".task")
  const issueRoot = join(trackerRoot, "issues")
  const archiveRoot = join(issueRoot, ".archive")

  mkdirSync(archiveRoot, { recursive: true })

  return {
    repoRoot,
    trackerRoot,
    issueRoot,
    archiveRoot,
  }
}

export function getTrackerHandles(start: string): TrackerHandles {
  const { repoRoot, trackerRoot, issueRoot, archiveRoot } = ensureTrackerLayout(start)
  return {
    repoRoot,
    trackerRoot,
    issueRoot,
    archiveRoot,
    eventStore: createFilesystemEventStore({ root: trackerRoot }),
    checkpointStore: createFilesystemCheckpointStore({ root: trackerRoot }),
  }
}

export function listProjectedIssueIds(start: string, archived = false): string[] {
  const root = archived ? getArchiveRoot(start) : getIssueRoot(start)
  if (!directoryExists(root)) return []

  return readdirSync(root)
    .filter((entry) => entry !== ".archive")
    .filter((entry) => directoryExists(join(root, entry)))
    .sort()
}

export function listCanonicalIssueIds(start: string): string[] {
  const root = join(getTrackerRoot(start), "events", "by-issue")
  if (!directoryExists(root)) return []

  return readdirSync(root)
    .filter((entry) => directoryExists(join(root, entry)))
    .sort()
}
