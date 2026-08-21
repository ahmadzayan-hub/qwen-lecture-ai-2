// QwenClient — cloud analysis via Qwen. Proxy-aware, JSON-safe.
// NEVER persists API keys. Falls back to null on any failure so callers
// can degrade to LocalAnalyzer without losing the transcript.

import { Settings, apiKey } from '../session/Settings.js'

// Parse a JSON object out of a model reply that may be fenced or noisy.
function safeParseJSON (raw) {
  if (!raw) return null
  let s = String(raw).trim()
  // strip code fences
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(s)
  } catch {}
  // salvage first {...} block
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(s.slice(first, last + 1))
    } catch {}
  }
  return null
}

const SYS = `أنت مساعد تحليل محاضرات. حلّل النص وأعد JSON فقط بالمفاتيح:
{"summary": string[], "concepts": [{"term": string, "note": string}],
 "definitions": string[], "important": string[], "formulas": string[],
 "topics": [{"title": string, "points": string[]}]}
لا تختلق معلومات. إذا لم يوجد محتوى لمفتاح، أعد مصفوفة فارغة. أعد JSON صالحًا فقط دون أي نص إضافي.`

// Returns { ok, mode: 'cloud', data } or { ok:false, error } — never throws.
export async function analyzeCloud (text, { signal } = {}) {
  const proxy = Settings.get('proxy')
  const key = apiKey.get() // in-memory only, never stored
  if (!proxy && !key) return { ok: false, error: 'no-endpoint' }

  const model = Settings.get('model') === 'base' ? 'qwen-plus' : 'qwen-turbo'
  const body = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: String(text || '').slice(0, 12000) },
    ],
  }

  let url, headers
  if (proxy) {
    url = proxy
    headers = { 'content-type': 'application/json' }
  } else {
    url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'
    headers = { 'content-type': 'application/json', authorization: `Bearer ${key}` }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) return { ok: false, error: `http-${res.status}` }
    const json = await res.json()
    const content =
      json?.choices?.[0]?.message?.content ??
      json?.output?.text ??
      json?.content ??
      ''
    const parsed = safeParseJSON(content)
    if (!parsed) return { ok: false, error: 'parse' }
    return { ok: true, mode: 'cloud', data: normalize(parsed) }
  } catch (e) {
    if (e?.name === 'AbortError') return { ok: false, error: 'abort' }
    return { ok: false, error: 'network' }
  }
}

function arr (x) {
  return Array.isArray(x) ? x : []
}

function normalize (p) {
  return {
    source: 'cloud',
    summary: arr(p.summary).map(String),
    concepts: arr(p.concepts).map((c) =>
      typeof c === 'string' ? { term: c, note: '' } : { term: String(c.term || ''), note: String(c.note || '') },
    ),
    definitions: arr(p.definitions).map(String),
    important: arr(p.important).map(String),
    formulas: arr(p.formulas).map(String),
    topics: arr(p.topics).map((t) => ({ title: String(t.title || ''), points: arr(t.points).map(String) })),
  }
}
