import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { StringMap } from "../types"
import type { DocumentSelector } from "./document-paths"
import { isPathWithinPrefix, splitDocumentPath } from "./document-paths"

export type StoreEntryState = {
  revision: number
  phase: string
  content: string
  draft: boolean
  visible: boolean
}

export type IssueStoreState = {
  entries: StringMap<StoreEntryState>
}

export type StoreTreeNode =
  | { value: string }
  | { entries: StringMap<StoreTreeNode> }
  | { value: string; entries: StringMap<StoreTreeNode> }

export type StoreTreeResult = {
  entries: StringMap<StoreTreeNode>
}

type MutableStoreTreeNode = {
  hasValue: boolean
  value: string
  childEntries: StringMap<MutableStoreTreeNode>
}

export type StoreRevisionPlan =
  | { revision: number }
  | { revision: number; supersedesRevision: number }

export type StoreDraftRef = {
  path: string
  revision: number
  phase: string
}

export function createEmptyIssueStoreState(): IssueStoreState {
  return { entries: {} }
}

function getEntry(
  state: IssueStoreState,
  path: string
): StoreEntryState | undefined {
  return state.entries[path]
}

function ensureNode(entries: StringMap<MutableStoreTreeNode>, segments: readonly string[]): MutableStoreTreeNode {
  const [segment, ...rest] = segments
  if (segment === undefined) {
    throw new Error("Document path must contain at least one segment")
  }

  const existing = entries[segment]
  const node: MutableStoreTreeNode = existing ?? { hasValue: false, value: "", childEntries: {} }
  entries[segment] = node

  if (rest.length === 0) {
    return node
  }

  return ensureNode(node.childEntries, rest)
}

function pruneEmptyNodes(entries: StringMap<MutableStoreTreeNode>): StringMap<StoreTreeNode> {
  const next: StringMap<StoreTreeNode> = {}

  for (const [segment, node] of Object.entries(entries)) {
    const childEntries = pruneEmptyNodes(node.childEntries)
    if (node.hasValue && Object.keys(childEntries).length > 0) {
      next[segment] = { value: node.value, entries: childEntries }
      continue
    }

    if (node.hasValue) {
      next[segment] = { value: node.value }
      continue
    }

    if (Object.keys(childEntries).length > 0) {
      next[segment] = { entries: childEntries }
    }
  }

  return next
}

function visibleEntries(state: IssueStoreState): Array<[string, StoreEntryState]> {
  return Object.entries(state.entries)
    .filter(([, entry]) => entry.visible)
    .sort(([a], [b]) => a.localeCompare(b))
}

export function planStoreRevision(
  state: IssueStoreState,
  path: string,
  currentPhase: string
): StoreRevisionPlan {
  const current = getEntry(state, path)
  if (current === undefined) {
    return { revision: 1 }
  }

  if (current.visible && current.draft && current.phase === currentPhase) {
    return { revision: current.revision }
  }

  return {
    revision: current.revision + 1,
    supersedesRevision: current.revision,
  }
}

export function applyStoreRevisionSaved(
  state: IssueStoreState,
  input: {
    path: string
    revision: number
    phase: string
    content: string
    draft: boolean
  }
): void {
  state.entries[input.path] = {
    revision: input.revision,
    phase: input.phase,
    content: input.content,
    draft: input.draft,
    visible: true,
  }
}

export function applyStoreRevisionFinalized(
  state: IssueStoreState,
  input: {
    path: string
    revision: number
    phase: string
  }
): void {
  const current = getEntry(state, input.path)
  if (current === undefined) {
    return
  }

  if (current.revision === input.revision && current.phase === input.phase) {
    current.draft = false
  }
}

export function applyStoreEntryDeleted(
  state: IssueStoreState,
  path: string
): void {
  const current = getEntry(state, path)
  if (current !== undefined) {
    current.visible = false
  }
}

export function applyStoreSubtreeDeleted(state: IssueStoreState, pathPrefix: string): void {
  for (const [path, entry] of Object.entries(state.entries)) {
    if (isPathWithinPrefix(path, pathPrefix)) {
      entry.visible = false
    }
  }
}

export function applyStoreDeleted(state: IssueStoreState): void {
  for (const entry of Object.values(state.entries)) {
    entry.visible = false
  }
}

export function getStoreValue(
  state: IssueStoreState,
  path: string
): string | null {
  const current = getEntry(state, path)
  if (current === undefined || !current.visible) {
    return null
  }
  return current.content
}

export function getStoreKeys(state: IssueStoreState, pathPrefix: string): string[] {
  return visibleEntries(state)
    .map(([path]) => path)
    .filter((path) => path.startsWith(`${pathPrefix}/`))
    .map((path) => path.slice(pathPrefix.length + 1))
    .sort()
}

export function getStoreTree(
  state: IssueStoreState,
  selector: DocumentSelector
): StoreTreeResult {
  const treeEntries: StringMap<MutableStoreTreeNode> = {}

  for (const [path, entry] of visibleEntries(state)) {
    if (
      selector.kind === "exact" && !isPathWithinPrefix(path, selector.path)
      || selector.kind === "subtree" && !isPathWithinPrefix(path, selector.path)
    ) {
      continue
    }

    const node = ensureNode(treeEntries, splitDocumentPath(path))
    node.hasValue = true
    node.value = entry.content
  }

  return { entries: pruneEmptyNodes(treeEntries) }
}

export function getVisibleStores(state: IssueStoreState): StringMap<StringMap<string>> {
  const grouped: StringMap<StringMap<string>> = {}

  for (const [path, entry] of visibleEntries(state)) {
    const [store, ...rest] = splitDocumentPath(path)
    if (store === undefined || rest.length === 0) {
      continue
    }

    const key = rest.join("/")
    const storeEntries = grouped[store] ?? {}
    storeEntries[key] = entry.content
    grouped[store] = storeEntries
  }

  return Object.fromEntries(
    Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([store, storeEntries]) => [
        store,
        Object.fromEntries(
          Object.entries(storeEntries).sort(([a], [b]) => a.localeCompare(b))
        ),
      ])
  )
}

export function getOpenStoreDrafts(state: IssueStoreState): StoreDraftRef[] {
  return visibleEntries(state)
    .filter(([, entry]) => entry.draft)
    .map(([path, entry]) => ({
      path,
      revision: entry.revision,
      phase: entry.phase,
    }))
}

export function hasVisibleEntries(state: IssueStoreState): boolean {
  return visibleEntries(state).length > 0
}

export function hasVisibleEntry(state: IssueStoreState, path: string): boolean {
  return getEntry(state, path)?.visible ?? false
}

export function hasVisibleEntriesUnderPrefix(state: IssueStoreState, pathPrefix: string): boolean {
  return visibleEntries(state).some(([path]) => isPathWithinPrefix(path, pathPrefix))
}

export function materializeVisibleStores(
  issueDir: string,
  stores: StringMap<StringMap<string>>
): void {
  mkdirSync(issueDir, { recursive: true })

  for (const entry of readdirSync(issueDir)) {
    if (entry === "issue.json") continue
    rmSync(join(issueDir, entry), { recursive: true, force: true })
  }

  for (const [store, keys] of Object.entries(stores)) {
    const storeDir = join(issueDir, store)
    mkdirSync(storeDir, { recursive: true })
    for (const [key, content] of Object.entries(keys)) {
      const filePath = join(storeDir, key)
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, content)
    }
  }
}
