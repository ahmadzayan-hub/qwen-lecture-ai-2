// LectureMemory — accumulates concepts/topics/definitions/important/formulas
// across the session. score() = repetition + duration + emphasis.
// Merges results from both LocalAnalyzer and QwenClient without fabricating.

import { bus, EV } from '../utils/bus.js'
import { normalizeArabic } from '../utils/text.js'

const EMPHASIS = ['مهم','ركزوا','ركز','انتبهوا','احفظوا','امتحان','سؤال','أساسي','اساسي','important','remember','exam','key']

function keyOf (term) {
  return normalizeArabic(term).slice(0, 60)
}

export class LectureMemory {
  constructor () {
    this.concepts = new Map() // key -> { term, count, firstT, lastT, emphasis }
    this.topics = []          // { title, points[], t }
    this.definitions = []
    this.important = []
    this.formulas = []
    this.startedAt = Date.now()
  }

  reset () {
    this.concepts.clear()
    this.topics = []
    this.definitions = []
    this.important = []
    this.formulas = []
    this.startedAt = Date.now()
    bus.emit(EV.MEMORY_UPDATE, this.snapshot())
  }

  // Feed raw transcript text with a timestamp to grow concept stats.
  ingestText (text, t = Date.now()) {
    const norm = normalizeArabic(text)
    const emphasized = EMPHASIS.some((m) => norm.includes(normalizeArabic(m)))
    // concept growth handled via analysis merge; here we only bump emphasis timing
    for (const c of this.concepts.values()) {
      if (norm.includes(c.norm)) {
        c.count += 1
        c.lastT = t
        if (emphasized) c.emphasis += 1
      }
    }
  }

  // Merge an analysis result ({concepts, definitions, important, formulas, topics}).
  mergeAnalysis (a, t = Date.now()) {
    if (!a) return
    for (const c of a.concepts || []) {
      const term = typeof c === 'string' ? c : c.term
      if (!term) continue
      const k = keyOf(term)
      const existing = this.concepts.get(k)
      const bump = typeof c === 'object' && c.count ? c.count : 1
      if (existing) {
        existing.count += bump
        existing.lastT = t
        if (c.note && !existing.note) existing.note = c.note
      } else {
        this.concepts.set(k, {
          term, norm: k, note: (typeof c === 'object' && c.note) || '',
          count: bump, firstT: t, lastT: t, emphasis: 0,
        })
      }
    }
    this._mergeList(this.definitions, a.definitions)
    this._mergeList(this.important, a.important)
    this._mergeList(this.formulas, a.formulas)
    for (const tp of a.topics || []) {
      if (!tp?.title) continue
      const found = this.topics.find((x) => keyOf(x.title) === keyOf(tp.title))
      if (found) {
        this._mergeList(found.points, tp.points)
      } else {
        this.topics.push({ title: tp.title, points: [...(tp.points || [])], t })
      }
    }
    bus.emit(EV.MEMORY_UPDATE, this.snapshot())
  }

  _mergeList (target, incoming) {
    for (const item of incoming || []) {
      const s = String(item || '').trim()
      if (s && !target.some((x) => keyOf(x) === keyOf(s))) target.push(s)
    }
  }

  // Ranking: repetition (count) + emphasis weight + duration span present.
  score (c) {
    const durationMin = Math.max(0, (c.lastT - c.firstT) / 60000)
    return c.count * 1.0 + c.emphasis * 2.5 + Math.min(durationMin, 10) * 0.4
  }

  rankedConcepts (limit = 12) {
    return [...this.concepts.values()]
      .map((c) => ({ ...c, _score: this.score(c) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
  }

  snapshot () {
    return {
      concepts: this.rankedConcepts(30),
      topics: this.topics,
      definitions: this.definitions,
      important: this.important,
      formulas: this.formulas,
      startedAt: this.startedAt,
    }
  }
}

export const memory = new LectureMemory()
