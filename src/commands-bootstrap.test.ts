import { describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { workflowBootstrap } from "./commands"
import { useTempRoot } from "./commands-test-helpers"

const getRoot = useTempRoot("commands-bootstrap-")

describe("bootstrap", () => {
  test("scaffolds task-backed workflow docs with detected commands", async () => {
    const root = getRoot()
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "demo",
          packageManager: "bun@1.2.0",
          scripts: {
            test: "bun test",
            lint: "eslint .",
            typecheck: "tsc --noEmit",
          },
        },
        null,
        2
      )
    )

    const result = await workflowBootstrap({}, root)
    expect(result.root).toBe(root)
    expect(result.created).toContain(join(root, "doc", "task-workflow.md"))
    expect(result.created).toContain(join(root, ".pi", "skills", "feature", "SKILL.md"))
    expect(result.created).toContain(join(root, ".pi", "skills", "references", "scoped-discovery.md"))
    expect(result.skipped).toEqual([])
    expect(result.detectedCommands).toEqual({
      test: "bun run test",
      lint: "bun run lint",
      typecheck: "bun run typecheck",
      diffLint: "Not configured",
      checkWorkflowGate: "Not configured",
    })

    const workflowDoc = join(root, "doc", "task-workflow.md")
    const codeDoc = join(root, "doc", "coding.md")
    const featureSkill = join(root, ".pi", "skills", "feature", "SKILL.md")
    const sharedReference = join(root, ".pi", "skills", "references", "scoped-discovery.md")
    expect(existsSync(workflowDoc)).toBe(true)
    expect(existsSync(codeDoc)).toBe(false)
    expect(existsSync(featureSkill)).toBe(true)
    expect(existsSync(sharedReference)).toBe(true)
    expect(readFileSync(workflowDoc, "utf8")).toContain("Next: /skill:check --issue <id>")
    expect(readFileSync(workflowDoc, "utf8")).toContain("bun run typecheck")
    expect(readFileSync(workflowDoc, "utf8")).toContain("doc/coding.md")
    expect(readFileSync(workflowDoc, "utf8")).toContain("doc/committing.md")
    expect(readFileSync(featureSkill, "utf8")).toContain("name: feature")
  })

  test("skips existing docs by default and overwrites with --force", async () => {
    const root = getRoot()
    const docRoot = join(root, "doc")
    mkdirSync(docRoot, { recursive: true })
    const workflowDoc = join(docRoot, "task-workflow.md")
    const featureSkill = join(root, ".pi", "skills", "feature", "SKILL.md")
    mkdirSync(join(root, ".pi", "skills", "feature"), { recursive: true })
    writeFileSync(workflowDoc, "existing\n")
    writeFileSync(featureSkill, "existing skill\n")

    const first = await workflowBootstrap({}, root)
    expect(first.skipped).toContain(workflowDoc)
    expect(first.skipped).toContain(featureSkill)
    expect(readFileSync(workflowDoc, "utf8")).toBe("existing\n")
    expect(readFileSync(featureSkill, "utf8")).toBe("existing skill\n")

    const forced = await workflowBootstrap({ "--force": "true" }, root)
    expect(forced.created).toContain(workflowDoc)
    expect(forced.created).toContain(featureSkill)
    expect(readFileSync(workflowDoc, "utf8")).toContain("Task Workflow Conventions for This Repo")
    expect(readFileSync(featureSkill, "utf8")).toContain("name: feature")
  })

  test("supports --root for another target repo", async () => {
    const root = getRoot()
    const target = join(root, "nested", "repo")
    mkdirSync(target, { recursive: true })

    const result = await workflowBootstrap({ "--root": "nested/repo" }, root)
    expect(result.root).toBe(target)
    expect(existsSync(join(target, "doc", "task-workflow.md"))).toBe(true)
    expect(existsSync(join(target, ".pi", "skills", "task", "SKILL.md"))).toBe(true)
  })
})
