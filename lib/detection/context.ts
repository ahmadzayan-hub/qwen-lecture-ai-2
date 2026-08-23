import { normalizeForMatch } from "./normalize"

/**
 * Context vocabulary. These are signals, never the sole basis of a decision —
 * the confidence engine also weighs structure, proximity and punctuation.
 */

export const ATTENDANCE_TERMS_EN = [
  "present",
  "attendance",
  "here",
  "with us",
  "roll call",
  "are you there",
  "are you with us",
  "can you hear me",
  "can you hear us",
  "do you hear me",
  "joining us",
  "on the call",
  "in the room",
  "checking attendance",
  "marking attendance",
]

export const ATTENDANCE_TERMS_AR = [
  "حاضر",
  "حاضرة",
  "موجود",
  "موجودة",
  "الحضور",
  "حضور",
  "معانا",
  "معنا",
  "هل انت معنا",
  "انت معنا",
  "سامعنا",
  "سامعني",
  "تسمعنا",
  "تسمعني",
  "بتسمعني",
  "بتسمعنا",
  "فين",
  "اين",
  "وين",
  "غايب",
  "غائب",
  "كشف الحضور",
]

export const QUESTION_TERMS_EN = [
  "what do you think",
  "can you explain",
  "your opinion",
  "your turn",
  "answer",
  "tell us",
  "what is your",
  "any thoughts",
  "would you like to",
  "could you share",
  "your view",
  "how would you",
]

export const QUESTION_TERMS_AR = [
  "ايه رايك",
  "ما رايك",
  "رايك",
  "جاوب",
  "اجب",
  "دورك",
  "رد",
  "تقدر تشرح",
  "اشرح",
  "قولنا",
  "وضح",
  "شو رايك",
]

export const HONORIFIC_TERMS = [
  "mr",
  "ms",
  "mrs",
  "miss",
  "doctor",
  "dr",
  "professor",
  "prof",
  "eng",
  "engineer",
  "student",
  "استاذ",
  "الاستاذ",
  "دكتور",
  "الدكتور",
  "مهندس",
  "طالب",
  "زميلنا",
  "يا",
]

/** Phrases that make a name mention narrative rather than a direct address. */
export const NARRATIVE_TERMS = [
  "said",
  "mentioned",
  "discussed",
  "wrote",
  "presented",
  "argued",
  "yesterday",
  "last week",
  "last time",
  "earlier",
  "his",
  "her",
  "their",
  "قال",
  "ذكر",
  "شرح",
  "كتب",
  "امبارح",
  "امس",
  "الاسبوع الماضي",
  "المرة السابقة",
  "سابقا",
]

const normalizeList = (list: string[]) => list.map(normalizeForMatch).filter(Boolean)

const ATTENDANCE = normalizeList([...ATTENDANCE_TERMS_EN, ...ATTENDANCE_TERMS_AR])
const QUESTION = normalizeList([...QUESTION_TERMS_EN, ...QUESTION_TERMS_AR])
const HONORIFIC = normalizeList(HONORIFIC_TERMS)
const NARRATIVE = normalizeList(NARRATIVE_TERMS)

export type ContextSignals = {
  attendance: string[]
  question: string[]
  honorific: string[]
  narrative: string[]
  /** Interrogative marker in either script. */
  isInterrogative: boolean
  /** Name is directly followed by "?" or "," — classic direct address. */
  directAddressPunctuation: boolean
  /** Very short utterance, e.g. just "Ahmed?" */
  isTerseCall: boolean
  wordCount: number
}

function findTerms(haystack: string, needles: string[]): string[] {
  const found: string[] = []
  for (const needle of needles) {
    if (!needle) continue
    if (needle.includes(" ")) {
      if (haystack.includes(needle)) found.push(needle)
      continue
    }
    // Word-boundary check without regex construction per term.
    const padded = ` ${haystack} `
    if (padded.includes(` ${needle} `)) found.push(needle)
  }
  return found
}

/**
 * Extracts context signals.
 * `original` keeps punctuation, which is a strong direct-address cue.
 */
export function extractContext(original: string, aliasRaws: string[]): ContextSignals {
  const normalized = normalizeForMatch(original)
  const words = normalized ? normalized.split(" ") : []

  const isInterrogative = /[?؟]/.test(original)

  let directAddressPunctuation = false
  for (const alias of aliasRaws) {
    const aliasNorm = normalizeForMatch(alias)
    if (!aliasNorm) continue
    const lastWord = aliasNorm.split(" ").pop() ?? aliasNorm
    // Match the alias tail followed by ? ؟ , ، or ! in the ORIGINAL text.
    const escaped = lastWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const probe = new RegExp(`${escaped}[\\s]*[?؟,،!]`, "iu")
    if (probe.test(normalizeKeepPunctuation(original))) {
      directAddressPunctuation = true
      break
    }
  }

  return {
    attendance: findTerms(normalized, ATTENDANCE),
    question: findTerms(normalized, QUESTION),
    honorific: findTerms(normalized, HONORIFIC),
    narrative: findTerms(normalized, NARRATIVE),
    isInterrogative,
    directAddressPunctuation,
    isTerseCall: words.length > 0 && words.length <= 4,
    wordCount: words.length,
  }
}

/**
 * Lowercases and unifies Arabic letters but deliberately KEEPS sentence
 * punctuation — "?" / "؟" / "," / "،" right after a name is the strongest
 * direct-address cue we have.
 */
function normalizeKeepPunctuation(input: string): string {
  return input
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .toLowerCase()
}
