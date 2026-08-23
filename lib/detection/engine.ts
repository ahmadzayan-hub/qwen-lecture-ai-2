import type { DetectionType, Sensitivity } from "@/lib/types"
import { detectLanguage } from "./normalize"
import { buildAliasIndex, hasNameProximity, matchAliases, type AliasIndex, type AliasMatch } from "./aliases"
import { extractContext, type ContextSignals } from "./context"

export type Thresholds = {
  /** At or above this, alert immediately without waiting for the LLM. */
  critical: number
  /** Between semantic and critical, ask the LLM to verify. */
  semantic: number
  /** Below this, log only. */
  floor: number
}

export const SENSITIVITY_THRESHOLDS: Record<Sensitivity, Thresholds> = {
  low: { critical: 0.9, semantic: 0.75, floor: 0.6 },
  balanced: { critical: 0.85, semantic: 0.68, floor: 0.55 },
  high: { critical: 0.78, semantic: 0.6, floor: 0.45 },
}

export type DetectionResult = {
  type: DetectionType
  confidence: number
  deterministicScore: number
  aliasMatched: string
  phrase: string
  language: "ar" | "en" | "mixed"
  alertRequired: boolean
  /** True when the score sits in the ambiguous band and Stage 2 should run. */
  needsSemanticCheck: boolean
  /** Human-readable scoring breakdown for the diagnostics screen. */
  reasons: string[]
}

export const NO_DETECTION: DetectionResult = {
  type: "GENERAL_SPEECH",
  confidence: 0,
  deterministicScore: 0,
  aliasMatched: "",
  phrase: "",
  language: "en",
  alertRequired: false,
  needsSemanticCheck: false,
  reasons: [],
}

type ScoreContribution = { label: string; value: number }

/**
 * Stage 1 deterministic detector.
 * Runs locally on every final transcript segment. No network, no LLM.
 */
export function detect(
  text: string,
  index: AliasIndex,
  options: {
    sensitivity: Sensitivity
    /** Recent transcript lines, oldest first, used for context. */
    history?: string[]
  },
): DetectionResult {
  const phrase = text.trim()
  if (!phrase) return NO_DETECTION

  const matches = matchAliases(phrase, index)
  if (!matches.length) return NO_DETECTION

  const best = matches.reduce((a, b) => (b.score * b.tokenLength > a.score * a.tokenLength ? b : a))
  const context = extractContext(
    phrase,
    matches.map((m) => m.entry.raw),
  )
  const language = detectLanguage(phrase)

  const contributions: ScoreContribution[] = []

  // --- Base: alias match quality, weighted by learned reliability. -----------
  const methodBase =
    best.method === "exact" || best.method === "phrase"
      ? 0.5
      : best.method === "fuzzy"
        ? 0.4
        : 0.34
  const base = methodBase * best.score * clamp(best.entry.weight, 0.5, 1.2)
  contributions.push({ label: `alias:${best.method}`, value: base })

  // --- First + surname together is a very strong direct signal. -------------
  if (hasNameProximity(matches)) {
    contributions.push({ label: "name-proximity", value: 0.16 })
  }

  // --- Direct address structure. --------------------------------------------
  if (context.directAddressPunctuation) {
    contributions.push({ label: "direct-address-punctuation", value: 0.14 })
  }
  if (context.isInterrogative) {
    contributions.push({ label: "interrogative", value: 0.08 })
  }
  if (context.isTerseCall) {
    // "Ahmed?" on its own is almost always a roll call.
    contributions.push({ label: "terse-call", value: 0.12 })
  }
  if (context.honorific.length) {
    contributions.push({ label: "honorific", value: 0.07 })
  }

  // --- Attendance / question vocabulary. ------------------------------------
  const attendanceHits = context.attendance.length
  if (attendanceHits) {
    contributions.push({ label: "attendance-vocab", value: Math.min(0.22, 0.12 * attendanceHits) })
  }
  const questionHits = context.question.length
  if (questionHits) {
    contributions.push({ label: "question-vocab", value: Math.min(0.18, 0.1 * questionHits) })
  }

  // --- Repetition across the recent window raises urgency. ------------------
  const history = options.history ?? []
  if (history.length) {
    const repeats = history.filter((line) => matchAliases(line, index).length > 0).length
    if (repeats > 0) {
      contributions.push({ label: "repeated-name", value: Math.min(0.1, 0.05 * repeats) })
    }
  }

  // --- Narrative context pulls the score DOWN. ------------------------------
  if (context.narrative.length) {
    contributions.push({
      label: "narrative-context",
      value: -Math.min(0.3, 0.15 * context.narrative.length),
    })
  }
  // Long sentences without any direct-address cue read as discussion.
  if (
    context.wordCount > 12 &&
    !context.directAddressPunctuation &&
    !attendanceHits &&
    !questionHits
  ) {
    contributions.push({ label: "long-narrative", value: -0.12 })
  }

  const deterministicScore = clamp(
    contributions.reduce((sum, c) => sum + c.value, 0),
    0,
    1,
  )

  const thresholds = SENSITIVITY_THRESHOLDS[options.sensitivity]
  const type = classify(deterministicScore, context, thresholds, best)
  const alertRequired =
    (type === "ATTENDANCE_CALL" || type === "DIRECT_QUESTION") &&
    deterministicScore >= thresholds.critical

  return {
    type,
    confidence: round2(deterministicScore),
    deterministicScore: round2(deterministicScore),
    aliasMatched: best.entry.raw,
    phrase,
    language,
    alertRequired,
    needsSemanticCheck:
      !alertRequired &&
      deterministicScore >= thresholds.semantic &&
      deterministicScore < thresholds.critical,
    reasons: contributions
      .filter((c) => c.value !== 0)
      .map((c) => `${c.label} ${c.value > 0 ? "+" : ""}${round2(c.value)}`),
  }
}

function classify(
  score: number,
  context: ContextSignals,
  thresholds: Thresholds,
  best: AliasMatch,
): DetectionType {
  if (score < thresholds.floor) {
    return context.narrative.length ? "POSSIBLE_MENTION" : "FALSE_POSITIVE"
  }

  const attendanceSignal =
    context.attendance.length > 0 ||
    context.isTerseCall ||
    (context.directAddressPunctuation && context.isInterrogative)

  const questionSignal = context.question.length > 0

  // A question addressed to the user outranks a plain roll call read.
  if (questionSignal && score >= thresholds.semantic) {
    return "DIRECT_QUESTION"
  }
  if (attendanceSignal && score >= thresholds.semantic) {
    return "ATTENDANCE_CALL"
  }
  if (context.directAddressPunctuation || context.honorific.length) {
    return score >= thresholds.critical ? "ATTENDANCE_CALL" : "DIRECT_MENTION"
  }
  if (best.entry.kind === "surname" || context.narrative.length) {
    return "POSSIBLE_MENTION"
  }
  return "DIRECT_MENTION"
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export { buildAliasIndex, matchAliases }
export type { AliasIndex, AliasMatch }
