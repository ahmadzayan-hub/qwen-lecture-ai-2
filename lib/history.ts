"use client"

/**
 * Local session history.
 *
 * Stored in localStorage rather than a database because this build ships
 * without cloud credentials — and storing lecture transcripts server-side
 * without the user opting in would violate the privacy rules. When Supabase
 * credentials are present, `lib/devices/channel.ts` upgrades the realtime path
 * and this store is where persistence would be swapped in.
 *
 * Only derived counters and (optionally) matched phrases are kept. Never audio.
 */

import { useCallback, useEffect, useState } from "react"
import type { DetectionEvent, LectureBrief, SessionSummary } from "@/lib/types"

const KEY = "hader.history.v1"
const BRIEF_KEY = "hader.briefs.v1"
const MAX_SESSIONS = 50

export type StoredSession = SessionSummary & {
  events: DetectionEvent[]
  isDemo: boolean
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota or private mode — history is best-effort */
  }
}

export function summarize(
  sessionId: string,
  course: string,
  startedAt: number,
  endedAt: number,
  events: DetectionEvent[],
  isDemo: boolean,
): StoredSession {
  const confirmed = events.filter((e) => e.confirmed)
  const latencies = confirmed
    .map((e) => e.confirmationLatencyMs)
    .filter((v): v is number => typeof v === "number")

  return {
    sessionId,
    course: course || "Untitled lecture",
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationMs: Math.max(0, endedAt - startedAt),
    totalDetections: events.length,
    confirmedCalls: confirmed.length,
    falseAlarms: events.filter((e) => e.falseAlarm).length,
    avgConfirmationMs: latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null,
    events,
    isDemo,
  }
}

export function saveSession(session: StoredSession) {
  const all = read<StoredSession[]>(KEY, [])
  const next = [session, ...all.filter((s) => s.sessionId !== session.sessionId)].slice(0, MAX_SESSIONS)
  write(KEY, next)
  window.dispatchEvent(new Event("hader:history"))
}

export function saveBrief(sessionId: string, brief: LectureBrief) {
  const all = read<Record<string, LectureBrief>>(BRIEF_KEY, {})
  all[sessionId] = brief
  write(BRIEF_KEY, all)
  window.dispatchEvent(new Event("hader:history"))
}

export function useHistory() {
  const [sessions, setSessions] = useState<StoredSession[]>([])
  const [briefs, setBriefs] = useState<Record<string, LectureBrief>>({})
  const [hydrated, setHydrated] = useState(false)

  const refresh = useCallback(() => {
    setSessions(read<StoredSession[]>(KEY, []))
    setBriefs(read<Record<string, LectureBrief>>(BRIEF_KEY, {}))
    setHydrated(true)
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener("hader:history", refresh)
    return () => window.removeEventListener("hader:history", refresh)
  }, [refresh])

  const removeSession = useCallback((sessionId: string) => {
    const all = read<StoredSession[]>(KEY, []).filter((s) => s.sessionId !== sessionId)
    write(KEY, all)
    const allBriefs = read<Record<string, LectureBrief>>(BRIEF_KEY, {})
    delete allBriefs[sessionId]
    write(BRIEF_KEY, allBriefs)
    window.dispatchEvent(new Event("hader:history"))
  }, [])

  const clearAll = useCallback(() => {
    write(KEY, [])
    write(BRIEF_KEY, {})
    window.dispatchEvent(new Event("hader:history"))
  }, [])

  const exportAll = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      sessions: read<StoredSession[]>(KEY, []),
      briefs: read<Record<string, LectureBrief>>(BRIEF_KEY, {}),
      settings: {
        profile: read("hader.profile.v1", null),
        preferences: read("hader.prefs.v1", null),
        lecture: read("hader.lecture.v1", null),
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `hader-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const stats = {
    sessions: sessions.length,
    confirmed: sessions.reduce((sum, s) => sum + s.confirmedCalls, 0),
    falseAlarms: sessions.reduce((sum, s) => sum + s.falseAlarms, 0),
    avgConfirmationMs: (() => {
      const values = sessions
        .map((s) => s.avgConfirmationMs)
        .filter((v): v is number => typeof v === "number")
      if (!values.length) return null
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    })(),
  }

  return { sessions, briefs, hydrated, refresh, removeSession, clearAll, exportAll, stats }
}
