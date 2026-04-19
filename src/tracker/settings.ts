import { existsSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { readJsonFile } from "../infrastructure/json"
import { jsonObjectSchema } from "../json-schema"
import type { JsonValue, StringMap } from "../types"
import { getTrackerRoot } from "./root"

export type TaskSettings = {
  defaultPhase: string
  phases: string[]
  transitions: StringMap<string[]>
}

const DEFAULT_SETTINGS: TaskSettings = {
  defaultPhase: "research",
  phases: ["research"],
  transitions: {},
}

const nonEmptyStringSchema = z.string().trim().min(1)
const stringArraySchema = z.array(nonEmptyStringSchema)

function ensurePhaseName(value: JsonValue | undefined, path: string): string {
  const parsed = nonEmptyStringSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`${path} must be a non-empty string`)
  }
  return parsed.data
}

function ensurePhaseList(value: JsonValue | undefined, path: string, allowEmpty = false): string[] {
  const parsed = stringArraySchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`${path} must be an array of phase names`)
  }

  const phases = parsed.data
  const unique = new Set(phases)
  if (unique.size !== phases.length) {
    throw new Error(`${path} must not contain duplicate phase names`)
  }

  if (!allowEmpty && phases.length === 0) {
    throw new Error(`${path} must contain at least one phase`)
  }

  return [...phases]
}

function ensureTransitions(value: JsonValue | undefined, phases: ReadonlyArray<string>): StringMap<string[]> {
  const parsed = jsonObjectSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(".task/settings.json transitions must be an object")
  }

  const phaseSet = new Set(phases)
  const transitions: StringMap<string[]> = {}

  for (const [from, rawTargets] of Object.entries(parsed.data)) {
    if (!phaseSet.has(from)) {
      throw new Error(`.task/settings.json transitions references unknown phase '${from}'`)
    }

    const targets = ensurePhaseList(rawTargets, `.task/settings.json transitions.${from}`, true)
    for (const target of targets) {
      if (!phaseSet.has(target)) {
        throw new Error(`.task/settings.json transitions.${from} references unknown phase '${target}'`)
      }
    }
    transitions[from] = targets
  }

  return transitions
}

export function loadTaskSettings(root: string): TaskSettings {
  const settingsPath = join(getTrackerRoot(root), "settings.json")
  if (!existsSync(settingsPath)) {
    return { ...DEFAULT_SETTINGS, phases: [...DEFAULT_SETTINGS.phases] }
  }

  const parsed = readJsonFile(
    settingsPath,
    jsonObjectSchema,
    ".task/settings.json is not valid JSON",
    ".task/settings.json must be a JSON object"
  )

  const phases = ensurePhaseList(parsed["phases"], ".task/settings.json phases")
  const defaultPhase = ensurePhaseName(parsed["defaultPhase"], ".task/settings.json defaultPhase")
  if (!phases.includes(defaultPhase)) {
    throw new Error(".task/settings.json defaultPhase must appear in phases")
  }

  const transitions = ensureTransitions(parsed["transitions"] ?? {}, phases)
  return {
    defaultPhase,
    phases,
    transitions,
  }
}

export function assertKnownPhase(settings: TaskSettings, phase: string): void {
  if (!settings.phases.includes(phase)) {
    throw new Error(`Unknown phase '${phase}' in .task/settings.json`)
  }
}

export function assertAllowedPhaseTransition(
  settings: TaskSettings,
  from: string,
  to: string
): void {
  assertKnownPhase(settings, from)
  assertKnownPhase(settings, to)

  if (from === to) {
    throw new Error(`Issue is already in phase '${to}'`)
  }

  const allowed = settings.transitions[from] ?? []
  if (!allowed.includes(to)) {
    throw new Error(`Invalid phase transition '${from}' -> '${to}'`)
  }
}

export function getNextPhase(settings: TaskSettings, currentPhase: string): string {
  assertKnownPhase(settings, currentPhase)
  const next = settings.transitions[currentPhase] ?? []

  if (next.length === 0) {
    throw new Error(`No next phase configured for '${currentPhase}'`)
  }

  if (next.length > 1) {
    throw new Error(`Phase '${currentPhase}' has multiple next phases configured`)
  }

  const onlyNextPhase = next[0]
  if (onlyNextPhase === undefined) {
    throw new Error(`No next phase configured for '${currentPhase}'`)
  }
  return onlyNextPhase
}
