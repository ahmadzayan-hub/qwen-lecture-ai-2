// ExamRadar — ranks likely exam material from LectureMemory with an honest
// "why" for each item. NEVER claims certainty; surfaces relative likelihood
// derived from observable signals (repetition, emphasis, being defined).

import { memory } from './Memory.js'
import { normalizeArabic } from '../utils/text.js'

const EXAM_WORDS = ['امتحان','إمتحان','سؤال','اختبار','يأتي','مهم','احفظوا','ركزوا','exam','test','question','quiz']

function isEmphasizedInImportant (term) {
  const nk = normalizeArabic(term)
  return memory.important.some((s) => normalizeArabic(s).includes(nk))
}

function isDefined (term) {
  const nk = normalizeArabic(term)
  return memory.definitions.some((s) => normalizeArabic(s).includes(nk))
}

// Returns [{ term, likelihood: 0..1 (relative), reasons: string[] }]
export function computeRadar (limit = 8) {
  const concepts = memory.rankedConcepts(40)
  if (!concepts.length) return []

  const scored = concepts.map((c) => {
    const reasons = []
    let raw = 0

    if (c.count >= 3) { raw += c.count; reasons.push(`تكرّر ${c.count} مرات`) }
    else if (c.count === 2) { raw += 2; reasons.push('ذُكر مرتين') }

    if (c.emphasis > 0) { raw += c.emphasis * 3; reasons.push('أكّد عليه المحاضر') }

    if (isEmphasizedInImportant(c.term)) { raw += 3; reasons.push('ورد ضمن نقاط مهمة') }
    if (isDefined(c.term)) { raw += 2; reasons.push('له تعريف صريح') }

    // explicit exam-language nearby (in important list)
    const nearExam = memory.important.some(
      (s) => normalizeArabic(s).includes(normalizeArabic(c.term)) &&
             EXAM_WORDS.some((w) => normalizeArabic(s).includes(normalizeArabic(w))),
    )
    if (nearExam) { raw += 4; reasons.push('قُرن بكلمات الامتحان') }

    if (!reasons.length) reasons.push('مفهوم متكرر نسبيًا')
    return { term: c.term, note: c.note || '', raw, reasons }
  })

  const max = Math.max(1, ...scored.map((s) => s.raw))
  return scored
    .sort((a, b) => b.raw - a.raw)
    .slice(0, limit)
    .map((s) => ({
      term: s.term,
      note: s.note,
      likelihood: Math.round((s.raw / max) * 100) / 100,
      reasons: s.reasons,
    }))
}
