import type { NameProfile } from "@/lib/types"
import {
  arabicKey,
  hasArabic,
  normalizeForMatch,
  phoneticKey,
  similarity,
  tokenize,
} from "./normalize"

export type AliasEntry = {
  /** Original alias as configured by the user. */
  raw: string
  normalized: string
  tokens: string[]
  phonetic: string
  arabic: string
  isArabic: boolean
  /** Which part of the name this alias represents. */
  kind: "full" | "first" | "surname" | "alias"
  /** Learned weight, adjusted by user feedback. 0.5..1.2 */
  weight: number
}

export type AliasIndex = {
  entries: AliasEntry[]
  /** Fast lookup of single-token aliases. */
  tokenMap: Map<string, AliasEntry[]>
  firstNames: AliasEntry[]
  surnames: AliasEntry[]
}

function makeEntry(raw: string, kind: AliasEntry["kind"], weight: number): AliasEntry | null {
  const trimmed = raw.trim()
  if (trimmed.length < 2) return null
  const normalized = normalizeForMatch(trimmed)
  if (!normalized) return null
  const isArabic = hasArabic(trimmed)
  return {
    raw: trimmed,
    normalized,
    tokens: normalized.split(" "),
    phonetic: isArabic ? "" : phoneticKey(trimmed),
    arabic: isArabic ? arabicKey(trimmed) : "",
    isArabic,
    kind,
    weight,
  }
}

export function buildAliasIndex(
  profile: NameProfile,
  learnedWeights: Record<string, number> = {},
): AliasIndex {
  const seeds: { raw: string; kind: AliasEntry["kind"] }[] = []

  if (profile.fullName) seeds.push({ raw: profile.fullName, kind: "full" })
  if (profile.firstName) seeds.push({ raw: profile.firstName, kind: "first" })
  if (profile.surname) seeds.push({ raw: profile.surname, kind: "surname" })
  for (const alias of profile.aliases) seeds.push({ raw: alias, kind: "alias" })
  for (const alias of profile.arabicAliases) seeds.push({ raw: alias, kind: "alias" })

  const entries: AliasEntry[] = []
  const seen = new Set<string>()

  for (const seed of seeds) {
    const weight = learnedWeights[seed.raw.trim().toLowerCase()] ?? 1
    const entry = makeEntry(seed.raw, seed.kind, weight)
    if (!entry) continue
    const dedupeKey = `${entry.normalized}|${entry.kind}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    entries.push(entry)
  }

  const tokenMap = new Map<string, AliasEntry[]>()
  for (const entry of entries) {
    if (entry.tokens.length !== 1) continue
    const list = tokenMap.get(entry.tokens[0]) ?? []
    list.push(entry)
    tokenMap.set(entry.tokens[0], list)
  }

  return {
    entries,
    tokenMap,
    firstNames: entries.filter((e) => e.kind === "first" || e.kind === "alias"),
    surnames: entries.filter((e) => e.kind === "surname"),
  }
}

export type AliasMatch = {
  entry: AliasEntry
  /** 0..1 quality of this specific match. */
  score: number
  method: "exact" | "phrase" | "fuzzy" | "phonetic"
  tokenIndex: number
  tokenLength: number
}

const FUZZY_MIN = 0.82
const PHONETIC_MIN = 0.86

/**
 * Finds every alias occurrence in a transcript line.
 * Deterministic and allocation-light so it can run on every partial result.
 */
export function matchAliases(text: string, index: AliasIndex): AliasMatch[] {
  const tokens = tokenize(text)
  if (!tokens.length || !index.entries.length) return []

  const matches: AliasMatch[] = []

  // Multi-token aliases (e.g. "ahmed zaian") are checked as phrases first.
  for (const entry of index.entries) {
    if (entry.tokens.length < 2) continue
    for (let i = 0; i + entry.tokens.length <= tokens.length; i++) {
      const window = tokens.slice(i, i + entry.tokens.length)
      const joined = window.join(" ")
      const target = entry.tokens.join(" ")
      if (joined === target) {
        matches.push({
          entry,
          score: 1,
          method: "phrase",
          tokenIndex: i,
          tokenLength: entry.tokens.length,
        })
        continue
      }
      const sim = similarity(joined, target)
      if (sim >= FUZZY_MIN) {
        matches.push({
          entry,
          score: sim,
          method: "fuzzy",
          tokenIndex: i,
          tokenLength: entry.tokens.length,
        })
      }
    }
  }

  // Single-token aliases.
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    const exact = index.tokenMap.get(token)
    if (exact) {
      for (const entry of exact) {
        matches.push({ entry, score: 1, method: "exact", tokenIndex: i, tokenLength: 1 })
      }
      continue
    }

    if (token.length < 3) continue
    const tokenIsArabic = hasArabic(token)
    const tokenPhonetic = tokenIsArabic ? "" : phoneticKey(token)
    const tokenArabic = tokenIsArabic ? arabicKey(token) : ""

    for (const entry of index.entries) {
      if (entry.tokens.length !== 1) continue
      if (entry.isArabic !== tokenIsArabic) continue

      const sim = similarity(token, entry.normalized)
      if (sim >= FUZZY_MIN) {
        matches.push({ entry, score: sim, method: "fuzzy", tokenIndex: i, tokenLength: 1 })
        continue
      }

      // Phonetic pass catches Ahmed/Ahmad/Ahmet and Zaian/Zayan/Zian.
      const key = tokenIsArabic ? entry.arabic : entry.phonetic
      const probe = tokenIsArabic ? tokenArabic : tokenPhonetic
      if (key && probe && key.length > 1) {
        const phoneticSim = similarity(probe, key)
        if (phoneticSim >= PHONETIC_MIN) {
          matches.push({
            entry,
            score: phoneticSim * 0.95,
            method: "phonetic",
            tokenIndex: i,
            tokenLength: 1,
          })
        }
      }
    }
  }

  // Keep the strongest match per position.
  const best = new Map<number, AliasMatch>()
  for (const match of matches) {
    const current = best.get(match.tokenIndex)
    const strength = match.score * match.tokenLength
    if (!current || strength > current.score * current.tokenLength) {
      best.set(match.tokenIndex, match)
    }
  }

  return [...best.values()].sort((a, b) => a.tokenIndex - b.tokenIndex)
}

/**
 * True when a first name and a surname appear close together —
 * a much stronger signal than a bare first name.
 */
export function hasNameProximity(matches: AliasMatch[]): boolean {
  const firsts = matches.filter((m) => m.entry.kind === "first" || m.entry.kind === "alias")
  const lasts = matches.filter((m) => m.entry.kind === "surname")
  if (matches.some((m) => m.entry.kind === "full" && m.tokenLength > 1)) return true
  for (const f of firsts) {
    for (const l of lasts) {
      if (Math.abs(f.tokenIndex - l.tokenIndex) <= 2) return true
    }
  }
  return false
}
