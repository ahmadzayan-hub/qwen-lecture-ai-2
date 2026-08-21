// Arabic-aware text normalization + tokenization (§ NameMatcher / Memory).

// Remove Arabic diacritics (tashkeel) and tatweel.
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g

export function normalizeArabic(input) {
  return String(input ?? "")
    .replace(DIACRITICS, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

// Tokenize into normalized word sequence (drops punctuation, keeps ar/en/digits).
export function tokens(input) {
  const norm = normalizeArabic(input)
  return norm
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter(Boolean)
}

// Does the token sequence `needle` appear as a contiguous run inside `hay`?
export function tokenSeqIncludes(hayTokens, needleTokens) {
  if (!needleTokens.length) return false
  outer: for (let i = 0; i + needleTokens.length <= hayTokens.length; i++) {
    for (let j = 0; j < needleTokens.length; j++) {
      if (hayTokens[i + j] !== needleTokens[j]) continue outer
    }
    return true
  }
  return false
}

// Simple Arabic/English stopword set for keyword extraction.
export const STOPWORDS = new Set([
  "في","من","على","الى","إلى","عن","مع","هذا","هذه","ذلك","التي","الذي","الذين","ان","أن","إن",
  "كان","كانت","قد","لا","ما","هو","هي","هم","نحن","انا","أنا","و","او","أو","ثم","كل","بعض","اي","أي",
  "the","a","an","of","to","in","on","and","or","is","are","was","were","that","this","it","for","with","as","be","by",
])

// Very lightweight sentence splitter for Arabic + latin punctuation.
export function splitSentences(text) {
  return String(text ?? "")
    .split(/(?<=[.!؟?…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
}

// Extract candidate keywords (frequency of non-stopword tokens ≥ 3 chars).
export function keywordCounts(text) {
  const counts = new Map()
  for (const t of tokens(text)) {
    if (t.length < 3 || STOPWORDS.has(t)) continue
    counts.set(t, (counts.get(t) || 0) + 1)
  }
  return counts
}
