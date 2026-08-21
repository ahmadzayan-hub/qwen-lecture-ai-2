// LocalAnalyzer — offline heuristics. Always available, never fabricates
// confidence/speaker/exam certainty. Extracts concepts, definitions,
// formulas, important points, and a lightweight summary from raw text.

import { normalizeArabic, tokenize } from '../utils/text.js'

// Arabic + English stopwords (compact, high-frequency only)
const STOP = new Set([
  'في','من','على','الى','إلى','عن','مع','هذا','هذه','ذلك','التي','الذي','الذين',
  'ان','أن','إن','كان','كانت','قد','ثم','او','أو','و','ف','ب','ل','ك','هو','هي',
  'هم','نحن','انت','أنت','ما','لا','لم','لن','كل','بعض','هنا','هناك','بين','حتى',
  'the','a','an','of','to','in','on','and','or','is','are','was','were','be','this',
  'that','these','those','it','for','with','as','by','at','from','we','you','they',
])

// Emphasis markers a lecturer uses to flag exam-worthy material.
const EMPHASIS = [
  'مهم','مهمة','ركزوا','ركز','انتبهوا','انتبه','احفظوا','احفظ','يأتي في الامتحان',
  'يأتي في الإمتحان','سؤال','بالامتحان','بالإمتحان','ملاحظة','تذكروا','اساسي','أساسي',
  'important','remember','note that','key','exam','will be tested','focus',
]

const DEF_MARKERS = ['هو','هي','يعرف','تعرف','يعني','تعريف','عبارة عن','is defined as','means','refers to','is a','are a']
const FORMULA_RE = /([A-Za-z\u0621-\u064A]{1,12}\s*=\s*[^.،؛\n]{1,60})|(\$\$[^$]+\$\$)/g

function sentences (text) {
  return String(text || '')
    .split(/(?<=[.!؟?])\s+|[\n،؛]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
}

function keywordFreq (text) {
  const freq = new Map()
  for (const raw of tokenize(text)) {
    const t = normalizeArabic(raw)
    if (t.length < 3 || STOP.has(t) || STOP.has(raw)) continue
    if (/^\d+$/.test(t)) continue
    freq.set(t, (freq.get(t) || 0) + 1)
  }
  return freq
}

export function analyzeLocal (text) {
  const sents = sentences(text)
  const freq = keywordFreq(text)

  const concepts = [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count }))

  const definitions = []
  const important = []
  for (const s of sents) {
    const norm = normalizeArabic(s)
    if (DEF_MARKERS.some((m) => norm.includes(normalizeArabic(m))) && s.length < 220) {
      definitions.push(s)
    }
    if (EMPHASIS.some((m) => norm.includes(normalizeArabic(m)))) {
      important.push(s)
    }
  }

  const formulas = []
  let m
  const src = String(text || '')
  while ((m = FORMULA_RE.exec(src)) !== null) {
    const f = (m[0] || '').trim()
    if (f && !formulas.includes(f)) formulas.push(f)
    if (formulas.length > 20) break
  }

  // Extractive summary: rank sentences by summed keyword weight.
  const ranked = sents
    .map((s) => {
      let score = 0
      for (const raw of tokenize(s)) {
        const t = normalizeArabic(raw)
        score += freq.get(t) || 0
      }
      return { s, score: score / Math.max(1, tokenize(s).length) }
    })
    .sort((a, b) => b.score - a.score)
  const summary = ranked.slice(0, Math.min(5, ranked.length)).map((r) => r.s)

  return {
    source: 'local',
    concepts,
    definitions: definitions.slice(0, 12),
    important: [...new Set(important)].slice(0, 12),
    formulas,
    summary,
  }
}
