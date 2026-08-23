"use client"

/**
 * Single session instance shared across every screen.
 *
 * The realtime pipeline must not restart when the user navigates from Live to
 * Devices, so the orchestrator lives here — above the router — and each page
 * reads the same live state.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useHaderSession, type HaderSessionApi } from "@/lib/session/use-hader-session"
import { saveSession, summarize } from "@/lib/history"
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/defaults"
import type { LectureProfile, NameProfile } from "@/lib/types"
import { DEFAULT_LECTURE_PROFILE, DEFAULT_NAME_PROFILE } from "@/lib/defaults"

const PROFILE_KEY = "hader.profile.v1"
const PREFS_KEY = "hader.prefs.v1"
const LECTURE_KEY = "hader.lecture.v1"

type Ctx = {
  session: HaderSessionApi
  profile: NameProfile
  setProfile(next: NameProfile): void
  preferences: Preferences
  setPreferences(next: Preferences): void
  lecture: LectureProfile
  setLecture(next: LectureProfile): void
  /** True until localStorage has been read, so we don't flash empty state. */
  hydrated: boolean
  /** No name configured yet — nothing can be detected. */
  needsSetup: boolean
}

const HaderContext = createContext<Ctx | null>(null)

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as object) } as T
  } catch {
    return fallback
  }
}

export function HaderProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<NameProfile>(DEFAULT_NAME_PROFILE)
  const [preferences, setPreferencesState] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [lecture, setLectureState] = useState<LectureProfile>(DEFAULT_LECTURE_PROFILE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setProfileState(load(PROFILE_KEY, DEFAULT_NAME_PROFILE))
    setPreferencesState(load(PREFS_KEY, DEFAULT_PREFERENCES))
    setLectureState(load(LECTURE_KEY, DEFAULT_LECTURE_PROFILE))
    setHydrated(true)
  }, [])

  const persist = useCallback((key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* private mode — settings simply won't persist */
    }
  }, [])

  const setProfile = useCallback(
    (next: NameProfile) => {
      setProfileState(next)
      persist(PROFILE_KEY, next)
    },
    [persist],
  )

  const setPreferences = useCallback(
    (next: Preferences) => {
      setPreferencesState(next)
      persist(PREFS_KEY, next)
    },
    [persist],
  )

  const setLecture = useCallback(
    (next: LectureProfile) => {
      setLectureState(next)
      persist(LECTURE_KEY, next)
    },
    [persist],
  )

  const session = useHaderSession({
    profile,
    preferences,
    language: lecture.language,
  })

  /**
   * Archive the session when it ends.
   *
   * The orchestrator clears its live state on stop, so we mirror the pieces we
   * need into refs while the session is running and write the summary on the
   * transition into ENDED. Only counters and matched phrases are stored.
   */
  const snapshot = useRef<{
    sessionId: string | null
    startedAt: number | null
    events: HaderSessionApi["events"]
    isDemo: boolean
  }>({ sessionId: null, startedAt: null, events: [], isDemo: false })

  useEffect(() => {
    if (session.sessionId) {
      snapshot.current = {
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        events: session.events,
        isDemo: session.isDemo,
      }
    }
  }, [session.sessionId, session.startedAt, session.events, session.isDemo])

  const archived = useRef<string | null>(null)
  useEffect(() => {
    if (session.state !== "ENDED") return
    const snap = snapshot.current
    if (!snap.sessionId || !snap.startedAt) return
    if (archived.current === snap.sessionId) return
    archived.current = snap.sessionId
    saveSession(
      summarize(
        snap.sessionId,
        lecture.course,
        snap.startedAt,
        Date.now(),
        // Detection events only; transcripts stay in memory unless opted in.
        snap.events,
        snap.isDemo,
      ),
    )
  }, [session.state, lecture.course])

  const needsSetup = useMemo(() => {
    const hasName = Boolean(profile.fullName || profile.firstName || profile.aliases.length || profile.arabicAliases.length)
    return hydrated && !hasName
  }, [hydrated, profile])

  const value = useMemo<Ctx>(
    () => ({
      session,
      profile,
      setProfile,
      preferences,
      setPreferences,
      lecture,
      setLecture,
      hydrated,
      needsSetup,
    }),
    [session, profile, setProfile, preferences, setPreferences, lecture, setLecture, hydrated, needsSetup],
  )

  return <HaderContext.Provider value={value}>{children}</HaderContext.Provider>
}

export function useHader(): Ctx {
  const ctx = useContext(HaderContext)
  if (!ctx) throw new Error("useHader must be used inside HaderProvider")
  return ctx
}
