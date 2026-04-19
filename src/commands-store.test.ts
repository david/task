import { describe, expect, test } from "bun:test"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { issueCreate, issueShow, storeDelete, storeGet, storeKeys, storeSet } from "./commands"
import { fakeStdin, useTempRoot } from "./commands-test-helpers"

const getRoot = useTempRoot("commands-store-")

function neverReadStdin(): never {
  throw new Error("stdin should not be read")
}

describe("store set and get", () => {
  test("storeSet creates store directory and writes files", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Store Set Test" }, root))
    expect(
      await storeSet({ "--id": created.id, "--store": "research", "--key": "summary" }, fakeStdin("hello world"), root)
    ).toEqual({ stored: true })
    expect(await storeGet({ "--id": created.id, "--store": "research", "--key": "summary" }, root)).toEqual({
      value: "hello world",
    })
  })

  test("storeGet returns values or null", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Store Get Test" }, root))
    await storeSet({ "--id": created.id, "--store": "data", "--key": "notes" }, fakeStdin("some notes"), root)
    await storeSet({ "--id": created.id, "--store": "mystore", "--key": "exists" }, fakeStdin("x"), root)
    expect(await storeGet({ "--id": created.id, "--store": "data", "--key": "notes" }, root)).toEqual({
      value: "some notes",
    })
    expect(await storeGet({ "--id": created.id, "--store": "mystore", "--key": "nope" }, root)).toEqual({ value: null })
    expect(await storeGet({ "--id": created.id, "--store": "nonexistent", "--key": "nope" }, root)).toEqual({ value: null })
  })

  test("store values round-trip unchanged", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Store Roundtrip" }, root))
    const content = "line1\nline2\n\ttabbed\n🎉 emoji\nnull bytes: \x00"
    await storeSet({ "--id": created.id, "--store": "raw", "--key": "blob" }, fakeStdin(content), root)
    expect((await storeGet({ "--id": created.id, "--store": "raw", "--key": "blob" }, root)).value).toBe(content)
  })
})

describe("store value sources", () => {
  test("value flag stores the value without reading stdin", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Store Value Flag" }, root))
    await storeSet(
      { "--id": created.id, "--store": "notes", "--key": "quick", "--value": "simple string" },
      neverReadStdin,
      root
    )
    expect((await storeGet({ "--id": created.id, "--store": "notes", "--key": "quick" }, root)).value).toBe(
      "simple string"
    )
  })

  test("file flag reads from file", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Store File Flag" }, root))
    const tmpFile = join(root, "tmp-content.md")
    writeFileSync(tmpFile, "line one\nline two\nline three")
    await storeSet(
      { "--id": created.id, "--store": "docs", "--key": "readme", "--file": tmpFile },
      neverReadStdin,
      root
    )
    expect((await storeGet({ "--id": created.id, "--store": "docs", "--key": "readme" }, root)).value).toBe(
      "line one\nline two\nline three"
    )
  })

  test("value flag takes precedence over file", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Store Precedence" }, root))
    const tmpFile = join(root, "tmp-ignored.md")
    writeFileSync(tmpFile, "file content")
    await storeSet(
      { "--id": created.id, "--store": "prec", "--key": "test", "--value": "flag wins", "--file": tmpFile },
      neverReadStdin,
      root
    )
    expect((await storeGet({ "--id": created.id, "--store": "prec", "--key": "test" }, root)).value).toBe(
      "flag wins"
    )
  })
})

describe("store keys", () => {
  test("storeKeys lists keys and returns empty arrays for missing stores", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Store Keys Test" }, root))
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "alpha" }, fakeStdin("a"), root)
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "beta" }, fakeStdin("b"), root)
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "gamma" }, fakeStdin("c"), root)
    expect((await storeKeys({ "--id": created.id, "--store": "docs" }, root)).keys.sort()).toEqual([
      "alpha",
      "beta",
      "gamma",
    ])
    expect(await storeKeys({ "--id": created.id, "--store": "nope" }, root)).toEqual({ keys: [] })
  })
})

describe("store delete", () => {
  test("storeDelete removes individual keys and empty stores", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Store Delete Key" }, root))
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "alpha" }, fakeStdin("a"), root)
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "beta" }, fakeStdin("b"), root)
    expect(await storeDelete({ "--id": created.id, "--store": "docs", "--key": "alpha" }, root)).toEqual({
      deleted: true,
      kind: "key",
    })
    expect(await storeGet({ "--id": created.id, "--store": "docs", "--key": "alpha" }, root)).toEqual({ value: null })
    expect(await storeKeys({ "--id": created.id, "--store": "docs" }, root)).toEqual({ keys: ["beta"] })

    const last = (await issueCreate({ "--title": "Store Delete Last Key" }, root))
    await storeSet({ "--id": last.id, "--store": "docs", "--key": "only" }, fakeStdin("a"), root)
    expect(await storeDelete({ "--id": last.id, "--store": "docs", "--key": "only" }, root)).toEqual({
      deleted: true,
      kind: "key",
      removedEmptyStore: true,
    })
    expect(await storeKeys({ "--id": last.id, "--store": "docs" }, root)).toEqual({ keys: [] })
    const shown = await issueShow({ "--id": last.id }, root)
    expect("stores" in shown ? shown.stores : undefined).toEqual({})
  })

  test("storeDelete removes whole stores and is idempotent for missing targets", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Store Delete Store" }, root))
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "alpha" }, fakeStdin("a"), root)
    await storeSet({ "--id": created.id, "--store": "docs", "--key": "beta" }, fakeStdin("b"), root)
    expect(await storeDelete({ "--id": created.id, "--store": "docs" }, root)).toEqual({ deleted: true, kind: "store" })
    expect(await storeKeys({ "--id": created.id, "--store": "docs" }, root)).toEqual({ keys: [] })

    const missing = (await issueCreate({ "--title": "Store Delete Missing" }, root))
    expect(await storeDelete({ "--id": missing.id, "--store": "docs", "--key": "nope" }, root)).toEqual({
      deleted: false,
      kind: "key",
    })
    expect(await storeDelete({ "--id": missing.id, "--store": "docs" }, root)).toEqual({
      deleted: false,
      kind: "store",
    })
  })
})

describe("store validation", () => {
  test("invalid store names and keys are rejected", async () => {
    const root = getRoot()
    const created = (await issueCreate({ "--title": "Store Bad Name" }, root))
    await expect(storeSet({ "--id": created.id, "--store": "../bad", "--key": "k" }, fakeStdin("x"), root)).rejects.toThrow(
      "Invalid store name '../bad'"
    )
    await expect(storeSet({ "--id": created.id, "--store": "foo/bar", "--key": "k" }, fakeStdin("x"), root)).rejects.toThrow(
      "Invalid store name 'foo/bar'"
    )
    await expect(storeSet({ "--id": created.id, "--store": "valid", "--key": "foo/bar" }, fakeStdin("x"), root)).rejects.toThrow(
      "Invalid key 'foo/bar'"
    )
    await expect(storeSet({ "--id": created.id, "--store": "valid", "--key": ".." }, fakeStdin("x"), root)).rejects.toThrow(
      "Invalid key '..'"
    )
  })

  test("missing required flags throw", async () => {
    const root = getRoot()
    await expect(storeSet({ "--store": "s", "--key": "k" }, fakeStdin("x"), root)).rejects.toThrow("--id is required")
    await expect(storeSet({ "--id": "xxxx", "--key": "k" }, fakeStdin("x"), root)).rejects.toThrow("--store is required")
    await expect(storeSet({ "--id": "xxxx", "--store": "s" }, fakeStdin("x"), root)).rejects.toThrow("--key is required")
    await expect(storeGet({ "--store": "s", "--key": "k" }, root)).rejects.toThrow("--id is required")
    await expect(storeKeys({ "--id": "xxxx" }, root)).rejects.toThrow("--store is required")
    await expect(storeDelete({ "--id": "xxxx" }, root)).rejects.toThrow("--store is required")
  })
})
