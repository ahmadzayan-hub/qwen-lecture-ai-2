import type { LectureProfile, NameProfile, Sensitivity } from "./types"

/**
 * Architecture never assumes a specific person.
 * These are empty defaults; the user configures their own identity.
 */
export const EMPTY_NAME_PROFILE: NameProfile = {
  fullName: "",
  firstName: "",
  surname: "",
  aliases: [],
  arabicAliases: [],
}

/** Alias kept so call sites can read either name. */
export const DEFAULT_NAME_PROFILE = EMPTY_NAME_PROFILE

export const DEFAULT_LECTURE_PROFILE: LectureProfile = {
  id: "default",
  course: "",
  lecturer: "",
  language: "both",
  sensitivity: "high",
  preferredSource: "SYSTEM_AUDIO",
  responsePhrase: "Present",
  alertSound: "siren",
  keywords: [],
}

export type Preferences = {
  sensitivity: Sensitivity
  transcriptWindowSeconds: number
  storeTranscripts: boolean
  privacyMode: boolean
  soundEnabled: boolean
  vibrationEnabled: boolean
  autoEscalate: boolean
  language: "ar" | "en"
  /** Learned alias weights from user feedback. Local only. */
  aliasWeights: Record<string, number>
}

export const DEFAULT_PREFERENCES: Preferences = {
  sensitivity: "high",
  transcriptWindowSeconds: 120,
  storeTranscripts: false,
  privacyMode: false,
  soundEnabled: true,
  vibrationEnabled: true,
  autoEscalate: true,
  language: "en",
  aliasWeights: {},
}

/**
 * Escalation ladder. Runs until the user acts — never auto-confirms.
 */
export const ESCALATION_STEPS = [
  { atMs: 0, action: "overlay+sound+notify+vibrate", label: "Alert raised" },
  { atMs: 3_000, action: "sound", label: "Repeat sound" },
  { atMs: 6_000, action: "sound-strong", label: "Stronger alert" },
  { atMs: 10_000, action: "persistent", label: "Persistent alert" },
  { atMs: 15_000, action: "cross-device", label: "Cross-device escalation" },
] as const

export const QUICK_RESPONSES = [
  { id: "present-en", text: "Present", language: "en" as const },
  { id: "here-doctor-ar", text: "حاضر دكتور", language: "ar" as const },
  { id: "yes-doctor-en", text: "Yes Doctor, I'm here.", language: "en" as const },
  { id: "with-you-en", text: "Yes, I'm with you.", language: "en" as const },
  { id: "present-ar", text: "حاضر", language: "ar" as const },
  { id: "with-you-ar", text: "أنا معك يا دكتور", language: "ar" as const },
]

/** Simulation phrases for testing without a live lecture. */
export const SIMULATION_PHRASES = [
  { text: "{first}?", expect: "ATTENDANCE_CALL" },
  { text: "{full}, are you with us?", expect: "ATTENDANCE_CALL" },
  { text: "{first}, are you with us?", expect: "ATTENDANCE_CALL" },
  { text: "Mr {first}, can you answer?", expect: "DIRECT_QUESTION" },
  { text: "{first}, what do you think?", expect: "DIRECT_QUESTION" },
  { text: "{first} discussed this issue yesterday.", expect: "POSSIBLE_MENTION" },
  { text: "{firstAr}؟", expect: "ATTENDANCE_CALL" },
  { text: "{firstAr} موجود؟", expect: "ATTENDANCE_CALL" },
  { text: "{fullAr} معانا؟", expect: "ATTENDANCE_CALL" },
  { text: "أستاذ {firstAr} سامعنا؟", expect: "ATTENDANCE_CALL" },
  { text: "{firstAr}، جاوب على السؤال.", expect: "DIRECT_QUESTION" },
  { text: "The next chapter covers gradient descent and loss functions.", expect: "GENERAL_SPEECH" },
] as const
