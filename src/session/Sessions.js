// Sessions — current-session persistence + restore, and a library archive
// (max 12) written on stop. Keys: qlaV32_session, qlaV32_lib.

import { bus, EV } from '../utils/bus.js'

const K_SESSION = 'qlaV32_session'
const K_LIB = 'qlaV32_lib'
const LIB_MAX = 12

function safeGet (k) {
  try {
    const raw = localStorage.getItem(k)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function safeSet (k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
    return true
  } catch (e) {
    console.error('[v0] storage set failed', e)
    return false
  }
}

export const Sessions = {
  // Persist the live session (called throttled from app).
  save (data) {
    safeSet(K_SESSION, { ...data, savedAt: Date.now() })
  },
  restore () {
    return safeGet(K_SESSION)
  },
  clearCurrent () {
    try {
      localStorage.removeItem(K_SESSION)
    } catch {}
  },

  // Library archive.
  list () {
    return safeGet(K_LIB) || []
  },
  archive (session) {
    if (!session || !(session.segments?.length)) return
    const lib = this.list()
    const entry = {
      id: session.id || `s_${Date.now()}`,
      title: session.title || deriveTitle(session),
      at: Date.now(),
      duration: session.duration || 0,
      segCount: session.segments.length,
      data: session,
    }
    lib.unshift(entry)
    while (lib.length > LIB_MAX) lib.pop()
    safeSet(K_LIB, lib)
    bus.emit(EV.TOAST, { msg: 'تم حفظ الجلسة في المكتبة', kind: 'ok' })
    return entry
  },
  open (id) {
    return this.list().find((e) => e.id === id) || null
  },
  remove (id) {
    const lib = this.list().filter((e) => e.id !== id)
    safeSet(K_LIB, lib)
  },
  search (q) {
    const s = (q || '').trim().toLowerCase()
    if (!s) return this.list()
    return this.list().filter((e) => (e.title || '').toLowerCase().includes(s))
  },

  wipeAll () {
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('qlaV32_')) localStorage.removeItem(k)
      }
    } catch {}
    bus.emit(EV.TOAST, { msg: 'تم مسح جميع البيانات', kind: 'ok' })
  },
}

function deriveTitle (session) {
  const first = session.segments?.find((s) => s.text?.trim())?.text || ''
  const d = new Date()
  const stamp = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  return first ? `${first.slice(0, 40)}… — ${stamp}` : `محاضرة ${stamp}`
}
