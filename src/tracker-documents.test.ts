import { describe, expect, test } from "bun:test"
import { issueCreate } from "./commands"
import { useTempRoot } from "./commands-test-helpers"
import { parseDocumentSelector, parseExactDocumentPath } from "./tracker/document-paths"
import {
  deleteTrackedDocument,
  getTrackedDocumentTree,
  saveTrackedDocument,
} from "./tracker/issues"

const getRoot = useTempRoot("tracker-documents-")

describe("document path parsing", () => {
  test("accepts exact paths, subtree selectors, and the root selector", () => {
    expect(parseExactDocumentPath("research/notes/today")).toBe("research/notes/today")
    expect(parseDocumentSelector("research/notes/today")).toEqual({ kind: "exact", path: "research/notes/today" })
    expect(parseDocumentSelector("research/")).toEqual({ kind: "subtree", path: "research" })
    expect(parseDocumentSelector("/")).toEqual({ kind: "root" })
  })

  test("rejects invalid key forms", () => {
    expect(() => parseExactDocumentPath("/")).toThrow("Root selector '/' is not allowed here")
    expect(() => parseExactDocumentPath("research/")).toThrow("Subtree selector 'research/' is not allowed here")
    expect(() => parseDocumentSelector("/research")).toThrow("Invalid document key '/research'")
    expect(() => parseDocumentSelector("research//today")).toThrow("Invalid document key 'research//today'")
    expect(() => parseDocumentSelector("research/../today")).toThrow("Invalid document key 'research/../today'")
    expect(() => parseDocumentSelector("research/notes.today")).toThrow("Invalid document key 'research/notes.today'")
  })
})

describe("tracked document core", () => {
  test("saves exact paths and reads exact, subtree, and root trees", async () => {
    const root = getRoot()
    const created = await issueCreate({ "--title": "Document Tree" }, root)

    await saveTrackedDocument(root, created.id, "research", "overview")
    await saveTrackedDocument(root, created.id, "research/notes/today", "hello")
    await saveTrackedDocument(root, created.id, "qa/checklist", "done")

    expect(await getTrackedDocumentTree(root, created.id, parseDocumentSelector("research"))).toEqual({
      entries: {
        research: {
          value: "overview",
          entries: {
            notes: {
              entries: {
                today: { value: "hello" },
              },
            },
          },
        },
      },
    })

    expect(await getTrackedDocumentTree(root, created.id, parseDocumentSelector("research/"))).toEqual({
      entries: {
        research: {
          value: "overview",
          entries: {
            notes: {
              entries: {
                today: { value: "hello" },
              },
            },
          },
        },
      },
    })

    expect(await getTrackedDocumentTree(root, created.id, parseDocumentSelector("/"))).toEqual({
      entries: {
        qa: {
          entries: {
            checklist: { value: "done" },
          },
        },
        research: {
          value: "overview",
          entries: {
            notes: {
              entries: {
                today: { value: "hello" },
              },
            },
          },
        },
      },
    })
  })

  test("missing selectors return an empty tree", async () => {
    const root = getRoot()
    const created = await issueCreate({ "--title": "Missing Tree" }, root)

    expect(await getTrackedDocumentTree(root, created.id, parseDocumentSelector("research"))).toEqual({ entries: {} })
    expect(await getTrackedDocumentTree(root, created.id, parseDocumentSelector("research/"))).toEqual({ entries: {} })
    expect(await getTrackedDocumentTree(root, created.id, parseDocumentSelector("/"))).toEqual({ entries: {} })
  })

  test("exact, subtree, and root deletes update only the targeted visible documents", async () => {
    const root = getRoot()
    const created = await issueCreate({ "--title": "Delete Tree" }, root)

    await saveTrackedDocument(root, created.id, "research", "overview")
    await saveTrackedDocument(root, created.id, "research/notes/today", "hello")
    await saveTrackedDocument(root, created.id, "qa/checklist", "done")

    expect(await deleteTrackedDocument(root, created.id, parseDocumentSelector("research"))).toEqual({
      deleted: true,
      kind: "exact",
    })
    expect(await getTrackedDocumentTree(root, created.id, parseDocumentSelector("research"))).toEqual({
      entries: {
        research: {
          entries: {
            notes: {
              entries: {
                today: { value: "hello" },
              },
            },
          },
        },
      },
    })

    expect(await deleteTrackedDocument(root, created.id, parseDocumentSelector("research/"))).toEqual({
      deleted: true,
      kind: "subtree",
    })
    expect(await getTrackedDocumentTree(root, created.id, parseDocumentSelector("research"))).toEqual({ entries: {} })
    expect(await getTrackedDocumentTree(root, created.id, parseDocumentSelector("/"))).toEqual({
      entries: {
        qa: {
          entries: {
            checklist: { value: "done" },
          },
        },
      },
    })

    expect(await deleteTrackedDocument(root, created.id, parseDocumentSelector("/"))).toEqual({
      deleted: true,
      kind: "root",
    })
    expect(await getTrackedDocumentTree(root, created.id, parseDocumentSelector("/"))).toEqual({ entries: {} })
  })
})
