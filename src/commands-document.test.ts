import { describe, expect, test } from "bun:test"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { documentDelete, documentGet, documentSet, issueCreate } from "./commands"
import { fakeStdin, useTempRoot } from "./commands-test-helpers"

const getRoot = useTempRoot("commands-document-")

function neverReadStdin(): never {
  throw new Error("stdin should not be read")
}

function researchTree(): { entries: { research: { value: string; entries: { notes: { entries: { today: { value: string } } } } } } } {
  return {
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
  }
}

function fullTree(): {
  entries: {
    qa: { entries: { checklist: { value: string } } }
    research: { value: string; entries: { notes: { entries: { today: { value: string } } } } }
  }
} {
  return {
    entries: {
      qa: {
        entries: {
          checklist: { value: "done" },
        },
      },
      research: researchTree().entries.research,
    },
  }
}

async function createSeededDocumentIssue(root: string, title: string): Promise<{ id: string }> {
  const created = await issueCreate({ "--title": title }, root)
  await documentSet({ "--id": created.id, "--key": "research" }, fakeStdin("overview"), root)
  await documentSet({ "--id": created.id, "--key": "research/notes/today" }, fakeStdin("hello"), root)
  await documentSet({ "--id": created.id, "--key": "qa/checklist" }, fakeStdin("done"), root)
  return { id: created.id }
}

describe("document set and get", () => {
  test("documentSet saves exact paths and documentGet reads exact, subtree, and root trees", async () => {
    const root = getRoot()
    const created = await createSeededDocumentIssue(root, "Document Commands")

    expect(await documentGet({ "--id": created.id, "--key": "research" }, root)).toEqual(researchTree())
    expect(await documentGet({ "--id": created.id, "--key": "research/" }, root)).toEqual(researchTree())
    expect(await documentGet({ "--id": created.id, "--key": "/" }, root)).toEqual(fullTree())
  })

  test("documentSet accepts --value and --file without reading stdin", async () => {
    const root = getRoot()
    const created = await issueCreate({ "--title": "Document Value Sources" }, root)
    const tmpFile = join(root, "document-content.md")

    await documentSet(
      { "--id": created.id, "--key": "research/summary", "--value": "flag wins" },
      neverReadStdin,
      root
    )
    expect(await documentGet({ "--id": created.id, "--key": "research/summary" }, root)).toEqual({
      entries: {
        research: {
          entries: {
            summary: { value: "flag wins" },
          },
        },
      },
    })

    writeFileSync(tmpFile, "line one\nline two")
    await documentSet(
      { "--id": created.id, "--key": "research/details", "--file": tmpFile },
      neverReadStdin,
      root
    )
    expect(await documentGet({ "--id": created.id, "--key": "research/details" }, root)).toEqual({
      entries: {
        research: {
          entries: {
            details: { value: "line one\nline two" },
          },
        },
      },
    })
  })
})

describe("document delete", () => {
  test("documentDelete removes exact paths, subtrees, and the full tree", async () => {
    const root = getRoot()
    const created = await issueCreate({ "--title": "Document Delete" }, root)

    await documentSet({ "--id": created.id, "--key": "research" }, fakeStdin("overview"), root)
    await documentSet({ "--id": created.id, "--key": "research/notes/today" }, fakeStdin("hello"), root)
    await documentSet({ "--id": created.id, "--key": "qa/checklist" }, fakeStdin("done"), root)

    expect(await documentDelete({ "--id": created.id, "--key": "research" }, root)).toEqual({
      deleted: true,
      kind: "exact",
    })
    expect(await documentDelete({ "--id": created.id, "--key": "research/" }, root)).toEqual({
      deleted: true,
      kind: "subtree",
    })
    expect(await documentDelete({ "--id": created.id, "--key": "/" }, root)).toEqual({
      deleted: true,
      kind: "root",
    })
    expect(await documentGet({ "--id": created.id, "--key": "/" }, root)).toEqual({ entries: {} })
  })
})

describe("document command validation", () => {
  test("invalid key selectors and missing flags are rejected", async () => {
    const root = getRoot()
    const created = await issueCreate({ "--title": "Document Validation" }, root)

    await expect(documentSet({ "--id": created.id, "--key": "/" }, fakeStdin("x"), root)).rejects.toThrow(
      "Root selector '/' is not allowed here"
    )
    await expect(documentSet({ "--id": created.id, "--key": "research/" }, fakeStdin("x"), root)).rejects.toThrow(
      "Subtree selector 'research/' is not allowed here"
    )
    await expect(documentGet({ "--id": created.id, "--key": "research//today" }, root)).rejects.toThrow(
      "Invalid document key 'research//today'"
    )
    await expect(documentDelete({ "--id": created.id, "--key": "/research" }, root)).rejects.toThrow(
      "Invalid document key '/research'"
    )
    await expect(documentSet({ "--key": "research/summary" }, fakeStdin("x"), root)).rejects.toThrow("--id is required")
    await expect(documentGet({ "--id": created.id }, root)).rejects.toThrow("--key is required")
    await expect(documentDelete({ "--id": created.id }, root)).rejects.toThrow("--key is required")
  })
})
