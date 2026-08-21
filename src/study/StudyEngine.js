// StudyEngine — turns LectureMemory into study material:
// auto-notes, flip-cards, quiz (cloud-enhanced), weak-spots + "علّمني" teach,
// and post-lecture stats. Local-first; never fabricates certainty.

import { memory } from '../ai/Memory.js'
import { analyzeCloud } from '../ai/QwenClient.js'
import { Settings, apiKey } from '../session/Settings.js'
import { computeRadar } from '../ai/ExamRadar.js'

// Auto-notes: structured outline from memory.
export function buildNotes () {
  const snap = memory.snapshot()
  const sections = []
  if (snap.summary?.length) sections.push({ h: 'الملخص', items: snap.summary })
  if (snap.topics?.length) {
    for (const t of snap.topics) sections.push({ h: t.title, items: t.points })
  }
  if (snap.definitions.length) sections.push({ h: 'التعريفات', items: snap.definitions })
  if (snap.important.length) sections.push({ h: 'نقاط مهمة', items: snap.important })
  if (snap.formulas.length) sections.push({ h: 'القوانين والصيغ', items: snap.formulas })
  const concepts = snap.concepts.slice(0, 12).map((c) => c.note ? `${c.term} — ${c.note}` : c.term)
  if (concepts.length) sections.push({ h: 'المفاهيم الأساسية', items: concepts })
  return sections
}

// Flip-cards from definitions + concepts (front: term/prompt, back: detail).
export function buildCards () {
  const cards = []
  const snap = memory.snapshot()
  for (const def of snap.definitions.slice(0, 20)) {
    // split "term هو ..." into front/back when possible
    const m = def.match(/^(.{2,40}?)\s+(?:هو|هي|يعني|تعريف|is|means)\s+(.+)$/i)
    if (m) cards.push({ front: m[1].trim(), back: m[2].trim() })
    else cards.push({ front: 'عرّف:', back: def })
  }
  for (const c of snap.concepts.slice(0, 12)) {
    if (c.note) cards.push({ front: c.term, back: c.note })
  }
  // dedupe by front
  const seen = new Set()
  return cards.filter((c) => {
    const k = c.front.slice(0, 40)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// Quiz — cloud generates MCQs when available; else local recall prompts.
export async function buildQuiz (n = 5) {
  const snap = memory.snapshot()
  const hasCloud = Settings.get('proxy') || apiKey.get()
  const material = [
    ...snap.definitions,
    ...snap.important,
    ...snap.concepts.slice(0, 10).map((c) => c.note ? `${c.term}: ${c.note}` : c.term),
  ].join('\n')

  if (hasCloud && material.trim().length > 20) {
    const prompt = `من المادة التالية، أنشئ ${n} أسئلة اختيار من متعدد.
أعد JSON بالشكل: {"topics":[{"title":"quiz","points":["Q|A|B|C|D|correctIndex"]}]}
كل سؤال في سطر: نص السؤال ثم 4 خيارات ثم رقم الخيار الصحيح (0-3) مفصولة بـ |.
المادة:\n${material}`
    const res = await analyzeCloud(prompt, {})
    if (res.ok && res.data.topics?.[0]?.points?.length) {
      const qs = res.data.topics[0].points.map(parseQuizLine).filter(Boolean)
      if (qs.length) return { source: 'cloud', questions: qs.slice(0, n) }
    }
  }

  // Local fallback: recall questions from definitions/cards.
  const cards = buildCards().slice(0, n)
  const questions = cards.map((c) => ({
    q: `ما تعريف/معنى: ${c.front}؟`,
    options: null, // open recall
    answer: c.back,
  }))
  return { source: 'local', questions }
}

function parseQuizLine (line) {
  const parts = String(line).split('|').map((s) => s.trim())
  if (parts.length < 6) return null
  const [q, a, b, c, d, idx] = parts
  const correct = Number(idx)
  if (Number.isNaN(correct)) return null
  return { q, options: [a, b, c, d], answer: [a, b, c, d][correct] ?? a, correctIndex: correct }
}

// Weak-spots: high exam-likelihood items the learner hasn't reviewed yet.
export function weakSpots (reviewed = new Set()) {
  return computeRadar(12).filter((r) => !reviewed.has(r.term))
}

// "علّمني" — teach one weak concept in depth (cloud if available).
export async function teach (term) {
  const snap = memory.snapshot()
  const note = snap.concepts.find((c) => c.term === term)?.note || ''
  const defs = snap.definitions.filter((d) => d.includes(term))
  const hasCloud = Settings.get('proxy') || apiKey.get()
  if (hasCloud) {
    const prompt = `اشرح المفهوم "${term}" بأسلوب مبسّط للطالب، مع مثال واحد.
اعتمد على السياق إن وُجد: ${[note, ...defs].join(' ')}
أعد JSON: {"summary": ["..."]}`
    const res = await analyzeCloud(prompt, {})
    if (res.ok && res.data.summary?.length) return { source: 'cloud', text: res.data.summary.join('\n') }
  }
  const local = [note, ...defs].filter(Boolean).join('\n') || `لا يوجد شرح كافٍ مسجّل عن "${term}" بعد.`
  return { source: 'local', text: local }
}

// Post-lecture stats.
export function stats (transcriptSegments = []) {
  const snap = memory.snapshot()
  const durMs = Date.now() - snap.startedAt
  const words = transcriptSegments.reduce((n, s) => n + (s.text?.split(/\s+/).length || 0), 0)
  return {
    durationMin: Math.round(durMs / 60000),
    segments: transcriptSegments.length,
    words,
    concepts: snap.concepts.length,
    definitions: snap.definitions.length,
    important: snap.important.length,
    formulas: snap.formulas.length,
    topics: snap.topics.length,
    wpm: durMs > 0 ? Math.round(words / (durMs / 60000)) : 0,
  }
}
