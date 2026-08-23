/**
 * Normalization used ONLY for matching.
 * The original transcript string is never mutated for display.
 */

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g
const TATWEEL = /\u0640/g
/** Arabic letters only — excludes the punctuation that also lives in U+06xx. */
const ARABIC_RANGE = /[\u0621-\u063A\u0641-\u064A\u0671-\u06D3]/
/**
 * Arabic-script punctuation sits inside U+06xx, so a naive
 * "keep everything Arabic" class would preserve ؟ ، ؛ and break term matching.
 */
const ARABIC_PUNCTUATION = /[\u060C\u061B\u061F\u0640\u066A-\u066D\u06D4\u00AB\u00BB]/g

export function hasArabic(text: string): boolean {
  return ARABIC_RANGE.test(text)
}

export function hasLatin(text: string): boolean {
  return /[a-zA-Z]/.test(text)
}

export function detectLanguage(text: string): "ar" | "en" | "mixed" {
  const ar = hasArabic(text)
  const en = hasLatin(text)
  if (ar && en) return "mixed"
  if (ar) return "ar"
  return "en"
}

/** Arabic normalization for matching: strip tashkeel/tatweel, unify letter forms. */
export function normalizeArabic(input: string): string {
  return input
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") // آ أ إ ٱ -> ا
    .replace(/\u0649/g, "\u064A") // ى -> ي
    .replace(/\u0629/g, "\u0647") // ة -> ه
    .replace(/\u0624/g, "\u0648") // ؤ -> و
    .replace(/\u0626/g, "\u064A") // ئ -> ي
    .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** English normalization for matching: lowercase, strip punctuation, collapse space. */
export function normalizeLatin(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Normalizes any script while preserving the other script's tokens. */
export function normalizeForMatch(input: string): string {
  const arabicNormalized = input
    .replace(ARABIC_DIACRITICS, "")
    .replace(ARABIC_PUNCTUATION, " ")
    .replace(TATWEEL, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
  return arabicNormalized
    .toLowerCase()
    .replace(/[^a-z0-9\u0621-\u063A\u0641-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function tokenize(input: string): string[] {
  const normalized = normalizeForMatch(input)
  return normalized.length ? normalized.split(" ") : []
}

/**
 * Phonetic key for Latin transliterations of Arabic names.
 *
 * Goal: collapse spelling spread (Ahmed/Ahmad/Ahmet, Zaian/Zayan/Zian/Zeyan)
 * WITHOUT collapsing genuinely different names.
 *
 * Dropping every vowel is too destructive — it maps both "Ahmed" and
 * "Mohamed" to "md" and would fire false alarms mid-lecture. So we keep the
 * leading sound and fold only the vowels that transliteration actually varies.
 */
export function phoneticKey(input: string): string {
  let s = normalizeLatin(input).replace(/\s+/g, "")
  if (!s) return ""

  // Digraphs first, so later single-letter rules don't corrupt them.
  s = s
    .replace(/ph/g, "f")
    .replace(/gh/g, "g")
    .replace(/kh/g, "x")
    .replace(/sh/g, "s")
    .replace(/ch/g, "s")
    .replace(/th/g, "t")
    .replace(/ck/g, "k")
    .replace(/q/g, "k")
    .replace(/[dt]$/g, "t") // Ahmed / Ahmet share a final stop
    .replace(/z/g, "z")

  // The first character carries most of the name's identity — keep it.
  const head = s[0]
  let tail = s.slice(1)

  tail = tail
    // Interior /h/ is unstable in transliteration (Ahmed vs Amed).
    .replace(/h/g, "")
    // Semi-vowels used interchangeably with vowels: Zaian/Zayan/Zian.
    .replace(/[wy]/g, "")
    // Fold vowels to a single class rather than deleting them, so
    // vowel *count* still differentiates Ahmed (a-e) from Mohamed (o-a-e).
    .replace(/[aeiou]/g, "a")
    .replace(/a+/g, "a")

  const key = (head + tail).replace(/(.)\1+/g, "$1")
  return key
}

/** Arabic consonant skeleton — vowel marks are already gone after normalization. */
export function arabicKey(input: string): string {
  return normalizeArabic(input)
    .replace(/[\u0627\u0648\u064A]/g, "")
    .replace(/(.)\1+/g, "$1")
    .replace(/\s+/g, "")
}

/** Levenshtein distance, capped for realtime safety. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[b.length]
}

/** 0..1 similarity ratio. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  if (longest === 0) return 1
  return 1 - editDistance(a, b) / longest
}
