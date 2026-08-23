/**
 * Deterministic, offline lecture brief.
 *
 * Used when the Qwen text model is unavailable. It only extracts and ranks
 * sentences that were actually spoken — it never invents content. The result
 * is labelled `source: "local"` so the UI can say plainly that this is an
 * extraction, not an AI-written summary.
 */

import type { LectureBrief } from "@/lib/types"
import { normalizeForMatch } from "@/lib/detection/normalize"

const ASSIGNMENT_CUES = [
  "assignment",
  "homework",
  "due",
  "submit",
  "deadline",
  "hand in",
  "portal",
  "تسليم",
  "واجب",
  "الموعد",
  "ترفع",
]

const EXAM_CUES = [
  "exam",
  "midterm",
  "final",
  "quiz",
  "test",
  "will be asked",
  "important",
  "remember this",
  "focus on",
  "امتحان",
  "اختبار",
  "مهم",
  "يجي في",
  "ركزوا",
]

const DEFINITION_CUES = [" is defined as ", " means ", " refers to ", " is called ", " يعني ", " تعريف "]

const QUESTION_CUES = ["?", "؟"]

function sentences(transcript: string): string[] {
  return transcript
    .split(/(?<=[.!?؟])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
}

function unique(list: string[], limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const key = normalizeForMatch(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length >= limit) break
  }
  return out
}

function matches(sentence: string, cues: string[]): boolean {
  const normalized = normalizeForMatch(sentence)
  return cues.some((cue) => normalized.includes(normalizeForMatch(cue)))
}

/** Crude but honest keyword ranking: repeated multi-word noun-ish phrases. */
function keyConcepts(list: string[]): string[] {
  const counts = new Map<string, { display: string; n: number }>()
  const stop = new Set([
    "the","and","that","this","with","from","have","will","your","about","there","which","would","could","should",
    "here","when","what","were","been","they","them","than","into","also","very","just","like","some","more",
    "على","في","من","الى","هذا","هذه","التي","الذي","عن","مع","كان","كانت","هو","هي","ان","ما","لا","كل",
  ])

  for (const sentence of list) {
    const tokens = normalizeForMatch(sentence).split(" ").filter((t) => t.length > 3 && !stop.has(t))
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`
      const entry = counts.get(bigram)
      if (entry) entry.n += 1
      else counts.set(bigram, { display: bigram, n: 1 })
    }
  }

  return [...counts.values()]
    .filter((c) => c.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8)
    .map((c) => c.display)
}

export function buildLocalBrief(transcript: string): LectureBrief {
  const list = sentences(transcript)

  const assignments = unique(list.filter((s) => matches(s, ASSIGNMENT_CUES)), 6)
  const examPoints = unique(list.filter((s) => matches(s, EXAM_CUES)), 6)
  const questions = unique(list.filter((s) => QUESTION_CUES.some((c) => s.includes(c))), 8)

  const definitions = unique(list.filter((s) => matches(s, DEFINITION_CUES)), 6).map((sentence) => {
    const cue = DEFINITION_CUES.find((c) => normalizeForMatch(sentence).includes(normalizeForMatch(c)))
    const idx = cue ? sentence.toLowerCase().indexOf(cue.trim().toLowerCase()) : -1
    if (idx <= 0) return { term: sentence.slice(0, 48), meaning: sentence }
    return {
      term: sentence.slice(0, idx).trim(),
      meaning: sentence.slice(idx).replace(/^\W+/, "").trim(),
    }
  })

  const concepts = keyConcepts(list)

  // Summary = the longest early sentences, which usually carry the framing.
  const summary =
    unique(list.slice(0, Math.max(6, Math.ceil(list.length * 0.25))), 3).join(" ") ||
    "Not enough transcript was captured to summarise this session."

  return {
    summary,
    keyConcepts: concepts,
    definitions,
    assignments,
    examPoints,
    questionsToReview: questions,
    // Quiz/flashcards are only generated from real definitions, never invented.
    quiz: definitions.slice(0, 5).map((d) => ({
      question: `What does "${d.term}" refer to in this lecture?`,
      answer: d.meaning,
    })),
    flashcards: definitions.slice(0, 8).map((d) => ({ front: d.term, back: d.meaning })),
    source: "local",
  }
}
