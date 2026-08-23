"use client"

/**
 * Preflight.
 *
 * Every check performs a real probe. Nothing here is decorative, because the
 * whole value of this screen is that "READY" can be trusted: if Hader says
 * ready and then misses the lecturer calling your name, the product has failed.
 *
 * Rule: overall status is READY only when every *critical* check passes.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import type { HealthReport, PreflightCheck, PreflightStatus } from "@/lib/types"
import type { NameProfile } from "@/lib/types"

type Input = {
  profile: NameProfile
  /** Live audio level from the session, used to prove the track carries sound. */
  audioLevel: number
  audioActive: boolean
  peersOnline: number
  soundEnabled: boolean
  vibrationEnabled: boolean
}

const CRITICAL: PreflightCheck["id"][] = ["aliases", "audioPermission", "asr", "sound"]

function check(
  id: PreflightCheck["id"],
  label: string,
  status: PreflightStatus,
  detail: string,
  fix?: string,
): PreflightCheck {
  return { id, label, critical: CRITICAL.includes(id), status, detail, fix }
}

async function probeHealth(): Promise<HealthReport | null> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as HealthReport
  } catch {
    return null
  }
}

async function probeMicPermission(): Promise<PermissionState | "unsupported"> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unsupported"
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName })
    return status.state
  } catch {
    return "unsupported"
  }
}

export function usePreflight(input: Input) {
  const [health, setHealth] = useState<HealthReport | null>(null)
  const [micPermission, setMicPermission] = useState<PermissionState | "unsupported">("unsupported")
  const [notification, setNotification] = useState<NotificationPermission>("default")
  const [online, setOnline] = useState(true)
  const [rtt, setRtt] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<number | null>(null)

  const run = useCallback(async () => {
    setRunning(true)
    const started = performance.now()
    const [report, mic] = await Promise.all([probeHealth(), probeMicPermission()])
    setRtt(Math.round(performance.now() - started))
    setHealth(report)
    setMicPermission(mic)
    if (typeof Notification !== "undefined") setNotification(Notification.permission)
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine)
    setLastRun(Date.now())
    setRunning(false)
  }, [])

  useEffect(() => {
    void run()
  }, [run])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  const checks = useMemo<PreflightCheck[]>(() => {
    const { profile, audioLevel, audioActive, peersOnline, soundEnabled, vibrationEnabled } = input

    const aliasCount =
      (profile.fullName ? 1 : 0) +
      (profile.firstName ? 1 : 0) +
      profile.aliases.length +
      profile.arabicAliases.length

    const asrService = health?.services.asr
    const llmService = health?.services.llm

    return [
      check(
        "aliases",
        "Name aliases",
        aliasCount === 0 ? "fail" : aliasCount < 3 ? "warn" : "pass",
        aliasCount === 0
          ? "No name configured — nothing can be detected."
          : `${aliasCount} name form${aliasCount === 1 ? "" : "s"} configured.`,
        aliasCount < 3 ? "Add Arabic spelling and common mishearings in Settings." : undefined,
      ),
      check(
        "audioPermission",
        "Audio permission",
        micPermission === "granted" ? "pass" : micPermission === "denied" ? "fail" : "warn",
        micPermission === "granted"
          ? "Microphone access granted."
          : micPermission === "denied"
            ? "Microphone blocked by the browser."
            : "Permission is requested when the session starts.",
        micPermission === "denied" ? "Allow the microphone in the browser site settings." : undefined,
      ),
      check(
        "audioSignal",
        "Audio signal",
        !audioActive ? "pending" : audioLevel > 0.02 ? "pass" : "warn",
        !audioActive
          ? "Measured once the session is running."
          : audioLevel > 0.02
            ? "Sound is reaching Hader."
            : "Track is open but silent.",
        audioActive && audioLevel <= 0.02
          ? "Re-share and enable “Share system audio”, or raise the lecture volume."
          : undefined,
      ),
      check(
        "asr",
        "Speech recognition",
        asrService?.status === "healthy" ? "pass" : asrService?.status === "degraded" ? "warn" : "fail",
        asrService?.detail ?? "Health endpoint unreachable.",
        asrService?.status !== "healthy" ? "Add QWEN_API_KEY, or continue on the browser engine." : undefined,
      ),
      check(
        "llm",
        "Semantic verification",
        llmService?.status === "healthy" ? "pass" : "warn",
        llmService?.detail ?? "Borderline matches will use local scoring only.",
      ),
      check(
        "notifications",
        "Notifications",
        notification === "granted" ? "pass" : notification === "denied" ? "warn" : "warn",
        notification === "granted"
          ? "Background notifications enabled."
          : notification === "denied"
            ? "Blocked — the on-screen alarm still works."
            : "Not yet requested.",
        notification !== "granted" ? "Grant notifications so alerts survive a background tab." : undefined,
      ),
      check(
        "sound",
        "Alarm sound",
        soundEnabled ? "pass" : "fail",
        soundEnabled ? "Alarm audio is enabled." : "Alarm sound is switched off.",
        soundEnabled ? undefined : "Enable alarm sound in Settings.",
      ),
      check(
        "vibration",
        "Vibration",
        typeof navigator !== "undefined" && "vibrate" in navigator
          ? vibrationEnabled
            ? "pass"
            : "warn"
          : "warn",
        typeof navigator !== "undefined" && "vibrate" in navigator
          ? vibrationEnabled
            ? "Vibration supported and enabled."
            : "Supported but disabled in Settings."
          : "Not supported on this device (normal on desktop).",
      ),
      check(
        "phone",
        "Companion device",
        peersOnline > 0 ? "pass" : "warn",
        peersOnline > 0
          ? `${peersOnline} device${peersOnline === 1 ? "" : "s"} online.`
          : "No second device paired.",
        peersOnline === 0 ? "Pair a phone for cross-device escalation." : undefined,
      ),
      check(
        "network",
        "Network",
        online ? (rtt !== null && rtt < 800 ? "pass" : "warn") : "fail",
        online ? (rtt !== null ? `Round trip ${rtt} ms.` : "Online.") : "Browser reports offline.",
        online ? undefined : "Reconnect — cloud transcription needs the network.",
      ),
      check(
        "wakeLock",
        "Screen wake lock",
        typeof navigator !== "undefined" && "wakeLock" in navigator ? "pass" : "warn",
        typeof navigator !== "undefined" && "wakeLock" in navigator
          ? "Screen can be kept awake during the lecture."
          : "Not supported — keep the screen on manually.",
      ),
    ]
  }, [health, input, micPermission, notification, online, rtt])

  const criticalFailures = checks.filter((c) => c.critical && c.status === "fail")
  const warnings = checks.filter((c) => c.status === "warn")

  const overall: "READY" | "DEGRADED" | "BLOCKED" = criticalFailures.length
    ? "BLOCKED"
    : warnings.length
      ? "DEGRADED"
      : "READY"

  return { checks, overall, criticalFailures, warnings, run, running, lastRun, health }
}
