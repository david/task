import { readFileSync } from "node:fs"
import { basename } from "node:path"
import type { CommandArgs, FlagValue } from "./types"
import {
  deleteTrackedStore,
  getTrackedStoreValue,
  listTrackedStoreKeys,
  saveTrackedStoreValue,
} from "./tracker/issues"
import {
  requireFlag,
  resolveIssue,
  type StoreDeleteResult,
  type StoreLookupResult,
} from "./commands-shared"

const SAFE_NAME_RE = /^[a-zA-Z0-9_.-]+$/

function validateStoreName(name: string): void {
  if (!SAFE_NAME_RE.test(name) || name.includes("..")) {
    throw new Error(`Invalid store name '${name}'`)
  }
}

function validateStoreKey(key: string): void {
  if (!SAFE_NAME_RE.test(key) || key.includes("..")) {
    throw new Error(`Invalid key '${key}'`)
  }
}

function firstValue(value: FlagValue): string {
  return Array.isArray(value) ? value[0] : value
}

export async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk))
      continue
    }
    if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk))
      continue
    }
    throw new Error("Unsupported stdin chunk type")
  }
  return Buffer.concat(chunks).toString()
}

export async function storeSet(
  args: CommandArgs,
  readStdin: () => Promise<string>,
  root: string,
): Promise<{ stored: true }> {
  const id = requireFlag(args, "--id")
  const store = requireFlag(args, "--store")
  const key = requireFlag(args, "--key")
  validateStoreName(store)
  validateStoreKey(key)

  const { path } = resolveIssue(id, root)
  const valueFlag = args["--value"]
  const fileFlag = args["--file"]

  let content: string
  if (valueFlag !== undefined) {
    content = firstValue(valueFlag)
  } else if (fileFlag !== undefined) {
    content = readFileSync(firstValue(fileFlag), "utf-8")
  } else {
    content = await readStdin()
  }

  return saveTrackedStoreValue(root, basename(path), store, key, content)
}

export async function storeGet(
  args: CommandArgs,
  root: string,
): Promise<StoreLookupResult> {
  const id = requireFlag(args, "--id")
  const store = requireFlag(args, "--store")
  const key = requireFlag(args, "--key")
  validateStoreName(store)
  validateStoreKey(key)

  const { path } = resolveIssue(id, root)
  return { value: await getTrackedStoreValue(root, basename(path), store, key) }
}

export async function storeKeys(
  args: CommandArgs,
  root: string,
): Promise<{ keys: string[] }> {
  const id = requireFlag(args, "--id")
  const store = requireFlag(args, "--store")
  validateStoreName(store)

  const { path } = resolveIssue(id, root)
  return { keys: await listTrackedStoreKeys(root, basename(path), store) }
}

export async function storeDelete(
  args: CommandArgs,
  root: string,
): Promise<StoreDeleteResult> {
  const id = requireFlag(args, "--id")
  const store = requireFlag(args, "--store")
  const keyValue = args["--key"]
  validateStoreName(store)

  const key = keyValue === undefined ? undefined : firstValue(keyValue)
  if (key !== undefined) {
    validateStoreKey(key)
  }

  const { path } = resolveIssue(id, root)
  return deleteTrackedStore(root, basename(path), store, key)
}
