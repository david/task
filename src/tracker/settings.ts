import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { getTrackerRoot } from "./root"

export type TaskSettings = {
  defaultPhase: string
  phases: string[]
  transitions: Record<string, string[]>
}

const DEFAULT_SETTINGS: TaskSettings = {
  defaultPhase: "research",
  phases: ["research"],
  transitions: {},
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function ensurePhaseName(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`)
  }
  return value
}

function ensurePhaseList(value: unknown, path: string, allowEmpty = false): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array of phase names`)
  }

  const phases = value.map((entry, index) => ensurePhaseName(entry, `${path}[${index}]`))
  const unique = new Set(phases)
  if (unique.size !== phases.length) {
    throw new Error(`${path} must not contain duplicate phase names`)
  }

  if (!allowEmpty && phases.length === 0) {
    throw new Error(`${path} must contain at least one phase`)
  }

  return phases
}

function ensureTransitions(
  value: unknown,
  phases: ReadonlyArray<string>
): Record<string, string[]> {
  if (!isRecord(value)) {
    throw new Error(".task/settings.json transitions must be an object")
  }

  const phaseSet = new Set(phases)
  const transitions: Record<string, string[]> = {}

  for (const [from, rawTargets] of Object.entries(value)) {
    if (!phaseSet.has(from)) {
      throw new Error(`.task/settings.json transitions references unknown phase '${from}'`)
    }

    const targets = ensurePhaseList(rawTargets, `.task/settings.json transitions.${from}`, true)
    for (const target of targets) {
      if (!phaseSet.has(target)) {
        throw new Error(
          `.task/settings.json transitions.${from} references unknown phase '${target}'`
        )
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

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(settingsPath, "utf-8"))
  } catch {
    throw new Error(".task/settings.json is not valid JSON")
  }

  if (!isRecord(parsed)) {
    throw new Error(".task/settings.json must be a JSON object")
  }

  const phases = ensurePhaseList(parsed.phases, ".task/settings.json phases")
  const defaultPhase = ensurePhaseName(parsed.defaultPhase, ".task/settings.json defaultPhase")
  if (!phases.includes(defaultPhase)) {
    throw new Error(".task/settings.json defaultPhase must appear in phases")
  }

  const transitions = ensureTransitions(parsed.transitions ?? {}, phases)

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

  return next[0]
}
