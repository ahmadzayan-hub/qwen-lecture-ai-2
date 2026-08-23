import type { SessionState } from "@/lib/types"

export type SessionEvent =
  | { type: "PREPARE" }
  | { type: "REQUEST_AUDIO" }
  | { type: "AUDIO_GRANTED" }
  | { type: "AUDIO_DENIED"; reason: string }
  | { type: "ASR_CONNECTED" }
  | { type: "ASR_DEGRADED"; reason: string }
  | { type: "ASR_LOST" }
  | { type: "ASR_RECOVERED" }
  | { type: "START_LISTENING" }
  | { type: "CANDIDATE" }
  | { type: "CANDIDATE_CLEARED" }
  | { type: "ALERT" }
  | { type: "AWAIT_CONFIRMATION" }
  | { type: "CONFIRM" }
  | { type: "DISMISS" }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "ENDED" }
  | { type: "FAIL"; reason: string }
  | { type: "RESET" }

/**
 * Explicit transition table. Any event not listed for a state is ignored,
 * which prevents impossible UI combinations during a live lecture.
 */
const TRANSITIONS: Record<SessionState, Partial<Record<SessionEvent["type"], SessionState>>> = {
  IDLE: { PREPARE: "PREPARING", REQUEST_AUDIO: "REQUESTING_AUDIO", FAIL: "ERROR" },
  PREPARING: {
    REQUEST_AUDIO: "REQUESTING_AUDIO",
    STOP: "IDLE",
    FAIL: "ERROR",
  },
  REQUESTING_AUDIO: {
    AUDIO_GRANTED: "CONNECTING_ASR",
    AUDIO_DENIED: "ERROR",
    STOP: "IDLE",
    FAIL: "ERROR",
  },
  CONNECTING_ASR: {
    ASR_CONNECTED: "READY",
    ASR_DEGRADED: "DEGRADED",
    STOP: "STOPPING",
    FAIL: "ERROR",
  },
  READY: {
    START_LISTENING: "LISTENING",
    ASR_LOST: "RECONNECTING",
    ASR_DEGRADED: "DEGRADED",
    STOP: "STOPPING",
    FAIL: "ERROR",
  },
  LISTENING: {
    CANDIDATE: "MENTION_CANDIDATE",
    ALERT: "ALERTING",
    ASR_LOST: "RECONNECTING",
    ASR_DEGRADED: "DEGRADED",
    STOP: "STOPPING",
    FAIL: "ERROR",
  },
  MENTION_CANDIDATE: {
    ALERT: "ALERTING",
    CANDIDATE_CLEARED: "LISTENING",
    ASR_LOST: "RECONNECTING",
    STOP: "STOPPING",
    FAIL: "ERROR",
  },
  ALERTING: {
    AWAIT_CONFIRMATION: "WAITING_CONFIRMATION",
    CONFIRM: "CONFIRMED",
    DISMISS: "LISTENING",
    STOP: "STOPPING",
    FAIL: "ERROR",
  },
  WAITING_CONFIRMATION: {
    CONFIRM: "CONFIRMED",
    DISMISS: "LISTENING",
    ALERT: "ALERTING",
    STOP: "STOPPING",
    FAIL: "ERROR",
  },
  CONFIRMED: { RESUME: "LISTENING", STOP: "STOPPING", FAIL: "ERROR" },
  RECONNECTING: {
    ASR_RECOVERED: "LISTENING",
    ASR_DEGRADED: "DEGRADED",
    STOP: "STOPPING",
    FAIL: "ERROR",
  },
  DEGRADED: {
    // Degraded still listens — on a fallback engine — and says so.
    ASR_RECOVERED: "LISTENING",
    ALERT: "ALERTING",
    CANDIDATE: "MENTION_CANDIDATE",
    STOP: "STOPPING",
    FAIL: "ERROR",
  },
  STOPPING: { ENDED: "ENDED", FAIL: "ERROR", RESET: "IDLE" },
  ENDED: { RESET: "IDLE", PREPARE: "PREPARING" },
  ERROR: { RESET: "IDLE", PREPARE: "PREPARING", REQUEST_AUDIO: "REQUESTING_AUDIO" },
}

export function transition(state: SessionState, event: SessionEvent): SessionState {
  return TRANSITIONS[state]?.[event.type] ?? state
}

export function canTransition(state: SessionState, event: SessionEvent["type"]): boolean {
  return Boolean(TRANSITIONS[state]?.[event])
}

/** True only when audio AND recognition are genuinely active. */
export function isMonitoring(state: SessionState): boolean {
  return (
    state === "LISTENING" ||
    state === "MENTION_CANDIDATE" ||
    state === "ALERTING" ||
    state === "WAITING_CONFIRMATION" ||
    state === "CONFIRMED" ||
    state === "DEGRADED"
  )
}

/** True when a session occupies the audio device and must be stopped cleanly. */
export function isActive(state: SessionState): boolean {
  return (
    isMonitoring(state) ||
    state === "READY" ||
    state === "CONNECTING_ASR" ||
    state === "REQUESTING_AUDIO" ||
    state === "RECONNECTING"
  )
}

export const STATE_LABELS: Record<SessionState, { en: string; ar: string; tone: Tone }> = {
  IDLE: { en: "Idle", ar: "غير نشط", tone: "neutral" },
  PREPARING: { en: "Preparing", ar: "جارٍ التحضير", tone: "neutral" },
  REQUESTING_AUDIO: { en: "Requesting audio", ar: "طلب الصوت", tone: "warn" },
  CONNECTING_ASR: { en: "Connecting recognition", ar: "توصيل التعرف", tone: "warn" },
  READY: { en: "Ready", ar: "جاهز", tone: "good" },
  LISTENING: { en: "Listening for your name", ar: "يستمع لاسمك", tone: "good" },
  MENTION_CANDIDATE: { en: "Checking a mention", ar: "يتحقق من ذكر اسمك", tone: "warn" },
  ALERTING: { en: "Name called", ar: "تم نداء اسمك", tone: "critical" },
  WAITING_CONFIRMATION: { en: "Waiting for you", ar: "بانتظار تأكيدك", tone: "critical" },
  CONFIRMED: { en: "Presence confirmed", ar: "تم تأكيد الحضور", tone: "good" },
  RECONNECTING: { en: "Reconnecting", ar: "إعادة الاتصال", tone: "warn" },
  DEGRADED: { en: "Degraded monitoring", ar: "مراقبة محدودة", tone: "warn" },
  STOPPING: { en: "Stopping", ar: "جارٍ الإيقاف", tone: "neutral" },
  ENDED: { en: "Session ended", ar: "انتهت الجلسة", tone: "neutral" },
  ERROR: { en: "Error", ar: "خطأ", tone: "critical" },
}

export type Tone = "neutral" | "good" | "warn" | "critical"
