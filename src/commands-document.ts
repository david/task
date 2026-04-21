import { readFileSync } from "node:fs"
import { basename } from "node:path"
import type { CommandArgs, FlagValue } from "./types"
import { requireFlag, resolveIssue } from "./commands-shared"
import { parseDocumentSelector, parseExactDocumentPath } from "./tracker/document-paths"
import {
  deleteTrackedDocument,
  getTrackedDocumentTree,
  saveTrackedDocument,
} from "./tracker/issues"
import type { StoreTreeResult } from "./tracker/stores"

type DocumentDeleteResult = { deleted: boolean; kind: "exact" | "subtree" | "root" }

function firstValue(value: FlagValue): string {
  return Array.isArray(value) ? value[0] : value
}

export async function documentSet(
  args: CommandArgs,
  readStdin: () => Promise<string>,
  root: string,
): Promise<{ stored: true }> {
  const id = requireFlag(args, "--id")
  const path = parseExactDocumentPath(requireFlag(args, "--key"))
  const { path: issuePath } = resolveIssue(id, root)
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

  return saveTrackedDocument(root, basename(issuePath), path, content)
}

export async function documentGet(
  args: CommandArgs,
  root: string,
): Promise<StoreTreeResult> {
  const id = requireFlag(args, "--id")
  const selector = parseDocumentSelector(requireFlag(args, "--key"))
  const { path } = resolveIssue(id, root)
  return getTrackedDocumentTree(root, basename(path), selector)
}

export async function documentDelete(
  args: CommandArgs,
  root: string,
): Promise<DocumentDeleteResult> {
  const id = requireFlag(args, "--id")
  const selector = parseDocumentSelector(requireFlag(args, "--key"))
  const { path } = resolveIssue(id, root)
  return deleteTrackedDocument(root, basename(path), selector)
}
