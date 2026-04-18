import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export type StoreEntryState = {
  revision: number
  phase: string
  content: string
  draft: boolean
  visible: boolean
}

export type IssueStoreState = {
  entries: Record<string, Record<string, StoreEntryState>>
}

export type StoreRevisionPlan = {
  revision: number
  supersedesRevision?: number
}

export type StoreDraftRef = {
  store: string
  key: string
  revision: number
  phase: string
}

export function createEmptyIssueStoreState(): IssueStoreState {
  return { entries: {} }
}

function ensureStoreEntries(state: IssueStoreState, store: string): Record<string, StoreEntryState> {
  const existing = state.entries[store]
  if (existing !== undefined) {
    return existing
  }

  const created: Record<string, StoreEntryState> = {}
  state.entries[store] = created
  return created
}

function getEntry(
  state: IssueStoreState,
  store: string,
  key: string
): StoreEntryState | undefined {
  return state.entries[store]?.[key]
}

export function planStoreRevision(
  state: IssueStoreState,
  store: string,
  key: string,
  currentPhase: string
): StoreRevisionPlan {
  const current = getEntry(state, store, key)
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
    store: string
    key: string
    revision: number
    phase: string
    content: string
    draft: boolean
  }
): void {
  const storeEntries = ensureStoreEntries(state, input.store)
  storeEntries[input.key] = {
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
    store: string
    key: string
    revision: number
    phase: string
  }
): void {
  const current = getEntry(state, input.store, input.key)
  if (current === undefined) {
    return
  }

  if (current.revision === input.revision && current.phase === input.phase) {
    current.draft = false
  }
}

export function applyStoreEntryDeleted(
  state: IssueStoreState,
  store: string,
  key: string
): void {
  const current = getEntry(state, store, key)
  if (current !== undefined) {
    current.visible = false
  }
}

export function applyStoreDeleted(state: IssueStoreState, store: string): void {
  const storeEntries = state.entries[store]
  if (storeEntries === undefined) {
    return
  }

  for (const entry of Object.values(storeEntries)) {
    entry.visible = false
  }
}

export function getStoreValue(
  state: IssueStoreState,
  store: string,
  key: string
): string | null {
  const current = getEntry(state, store, key)
  if (current === undefined || !current.visible) {
    return null
  }
  return current.content
}

export function getStoreKeys(state: IssueStoreState, store: string): string[] {
  const storeEntries = state.entries[store]
  if (storeEntries === undefined) {
    return []
  }

  return Object.entries(storeEntries)
    .filter(([, entry]) => entry.visible)
    .map(([key]) => key)
    .sort()
}

export function getVisibleStores(state: IssueStoreState): Record<string, Record<string, string>> {
  const visible: Record<string, Record<string, string>> = {}

  for (const [store, storeEntries] of Object.entries(state.entries)) {
    const currentEntries = Object.entries(storeEntries)
      .filter(([, entry]) => entry.visible)
      .sort(([a], [b]) => a.localeCompare(b))

    if (currentEntries.length === 0) {
      continue
    }

    visible[store] = Object.fromEntries(
      currentEntries.map(([key, entry]) => [key, entry.content])
    )
  }

  return visible
}

export function getOpenStoreDrafts(state: IssueStoreState): StoreDraftRef[] {
  return Object.entries(state.entries)
    .flatMap(([store, storeEntries]) =>
      Object.entries(storeEntries)
        .filter(([, entry]) => entry.visible && entry.draft)
        .map(([key, entry]) => ({
          store,
          key,
          revision: entry.revision,
          phase: entry.phase,
        }))
    )
    .sort((a, b) => {
      const storeCompare = a.store.localeCompare(b.store)
      if (storeCompare !== 0) return storeCompare
      return a.key.localeCompare(b.key)
    })
}

export function materializeVisibleStores(
  issueDir: string,
  stores: Record<string, Record<string, string>>
): void {
  mkdirSync(issueDir, { recursive: true })

  for (const entry of readdirSync(issueDir)) {
    if (entry === "issue.json") continue
    const entryPath = join(issueDir, entry)
    if (statSync(entryPath).isDirectory()) {
      rmSync(entryPath, { recursive: true, force: true })
    }
  }

  for (const [store, keys] of Object.entries(stores)) {
    const storeDir = join(issueDir, store)
    mkdirSync(storeDir, { recursive: true })
    for (const [key, content] of Object.entries(keys)) {
      writeFileSync(join(storeDir, key), content)
    }
  }
}
