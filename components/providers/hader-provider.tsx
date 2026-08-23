"use client"

/**
 * Single session instance shared across every screen.
 *
 * The realtime pipeline must not restart when the user navigates from Live to
 * Devices, so the orchestrator lives here — above the router — and each page
 * reads the same live state.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useHaderSession, type HaderSessionApi } from "@/lib/session/use-hader-session"
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
