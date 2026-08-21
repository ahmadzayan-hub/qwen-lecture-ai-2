// Analyzer — orchestrates local heuristics ⇄ cloud Qwen and feeds LectureMemory.
// Local always runs (offline-safe). Cloud runs opportunistically and merges on
// top. retrieve() selects relevant transcript context for Ask.

import { analyzeLocal } from './LocalAnalyzer.js'
import { analyzeCloud } from './QwenClient.js'
import { memory } from './Memory.js'
import { Settings, apiKey } from '../session/Settings.js'
import { bus, EV } from '../utils/bus.js'
import { normalizeArabic, tokenize } from '../utils/text.js'

let cloudInFlight = null

export async function analyze (text) {
  if (!text || text.trim().length < 8) return
  // 1) Local — always, immediate.
  const local = analyzeLocal(text)
  memory.mergeAnalysis(local)
  bus.emit(EV.ANALYSIS_UPDATE, { source: 'local', data: local })

  // 2) Cloud — only if endpoint available and not disabled.
  const hasCloud = Settings.get('proxy') || apiKey.get()
  if (hasCloud) {
    if (cloudInFlight) cloudInFlight.abort()
    const ctrl = new AbortController()
    cloudInFlight = ctrl
    const res = await analyzeCloud(text, { signal: ctrl.signal })
    cloudInFlight = null
    if (res.ok) {
      memory.mergeAnalysis(res.data)
      bus.emit(EV.ANALYSIS_UPDATE, { source: 'cloud', data: res.data })
    } else if (res.error !== 'abort') {
      bus.emit(EV.ANALYSIS_UPDATE, { source: 'cloud-fail', error: res.error })
    }
  }
}

// retrieve() — pick the transcript segments most relevant to a query.
export function retrieve (query, segments, k = 6) {
  const q = new Set(tokenize(query).map(normalizeArabic))
  if (!q.size || !segments?.length) return segments?.slice(-k) || []
  const scored = segments.map((seg) => {
    const toks = tokenize(seg.text).map(normalizeArabic)
    let hit = 0
    for (const t of toks) if (q.has(t)) hit++
    return { seg, score: hit / Math.max(1, toks.length) + hit * 0.1 }
  })
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.seg)
}

// ask() — answer a question grounded in retrieved transcript context.
// Uses cloud if available, otherwise a local extractive answer.
export async function ask (query, segments) {
  const ctx = retrieve(query, segments, 6)
  const ctxText = ctx.map((s) => s.text).join('\n')
  const hasCloud = Settings.get('proxy') || apiKey.get()

  if (hasCloud) {
    const prompt = `السياق من المحاضرة:\n${ctxText}\n\nالسؤال: ${query}\nأجب بإيجاز اعتمادًا على السياق فقط. إن لم يوجد في السياق فقل ذلك.`
    const res = await analyzeCloud(prompt, {})
    if (res.ok && res.data.summary?.length) {
      return { source: 'cloud', answer: res.data.summary.join(' '), context: ctx }
    }
  }
  // Local fallback: return the most relevant snippets as the answer.
  const answer = ctx.length
    ? ctx.map((s) => `• ${s.text}`).join('\n')
    : 'لا يوجد في التفريغ ما يجيب عن هذا السؤال بعد.'
  return { source: 'local', answer, context: ctx }
}
