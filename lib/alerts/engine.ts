/**
 * Alert engine — the part that actually saves the user.
 *
 * Escalation ladder (from the moment a call is detected):
 *   T+0   overlay + tone + notification + vibration
 *   T+3   repeat tone
 *   T+6   louder, longer tone
 *   T+10  persistent/renotifying alert
 *   T+15  cross-device escalation broadcast
 *   then  keeps repeating until the user answers
 *
 * It stops ONLY on explicit user action (I'M HERE / FALSE ALARM / stop).
 * There is no auto-confirm and no auto-dismiss anywhere in this file.
 */

export type EscalationStage = 0 | 1 | 2 | 3 | 4

export interface AlertHooks {
  /** Escalation crossed into a new stage; UI can intensify. */
  onStage(stage: EscalationStage): void
  /** T+15 — ask paired devices to shout too. */
  onCrossDevice(): void
}

const STAGE_SCHEDULE: Array<{ atMs: number; stage: EscalationStage }> = [
  { atMs: 0, stage: 0 },
  { atMs: 3000, stage: 1 },
  { atMs: 6000, stage: 2 },
  { atMs: 10000, stage: 3 },
  { atMs: 15000, stage: 4 },
]

/** Repeat cadence once the ladder is exhausted — never goes silent. */
const SUSTAIN_INTERVAL_MS = 4000

export class AlertEngine {
  private context: AudioContext | null = null
  private timers: Array<ReturnType<typeof setTimeout>> = []
  private sustain: ReturnType<typeof setInterval> | null = null
  private active = false
  private stage: EscalationStage = 0
  private hooks: AlertHooks
  private notification: Notification | null = null
  private soundEnabled = true
  private vibrationEnabled = true

  constructor(hooks: AlertHooks) {
    this.hooks = hooks
  }

  configure(options: { sound?: boolean; vibration?: boolean }) {
    if (typeof options.sound === "boolean") this.soundEnabled = options.sound
    if (typeof options.vibration === "boolean") this.vibrationEnabled = options.vibration
  }

  get isActive(): boolean {
    return this.active
  }

  get currentStage(): EscalationStage {
    return this.stage
  }

  /**
   * Unlocks the AudioContext. Browsers block audio until a user gesture, so
   * this must be called from a click — otherwise the alarm would be silent
   * at the exact moment it matters.
   */
  async prime(): Promise<boolean> {
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!this.context) this.context = new Ctor()
      if (this.context.state === "suspended") await this.context.resume()
      return this.context.state === "running"
    } catch {
      return false
    }
  }

  start(payload: { title: string; body: string }) {
    if (this.active) return
    this.active = true
    this.stage = 0

    for (const step of STAGE_SCHEDULE) {
      this.timers.push(
        setTimeout(() => {
          if (!this.active) return
          this.stage = step.stage
          this.hooks.onStage(step.stage)
          this.fire(step.stage)
          if (step.stage === 4) this.hooks.onCrossDevice()
        }, step.atMs),
      )
    }

    // After the ladder, keep repeating forever until answered.
    this.timers.push(
      setTimeout(() => {
        if (!this.active) return
        this.sustain = setInterval(() => {
          if (!this.active) return
          this.fire(4)
        }, SUSTAIN_INTERVAL_MS)
      }, 15000 + SUSTAIN_INTERVAL_MS),
    )

    void this.notify(payload)
  }

  private fire(stage: EscalationStage) {
    this.tone(stage)
    this.vibrate(stage)
  }

  /** Synthesised tone — no audio asset needed, and it cannot fail to load. */
  private tone(stage: EscalationStage) {
    if (!this.soundEnabled || !this.context || this.context.state !== "running") return

    const ctx = this.context
    const now = ctx.currentTime
    // Later stages: more beeps, higher pitch, louder.
    const beeps = stage === 0 ? 2 : stage === 1 ? 3 : stage === 2 ? 4 : 5
    const base = 660 + stage * 90
    const gainPeak = Math.min(0.28, 0.12 + stage * 0.04)

    for (let i = 0; i < beeps; i += 1) {
      const at = now + i * 0.22
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(base, at)
      osc.frequency.linearRampToValueAtTime(base * 1.25, at + 0.16)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(gainPeak, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.2)
    }
  }

  private vibrate(stage: EscalationStage) {
    if (!this.vibrationEnabled) return
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return
    const pattern =
      stage >= 3 ? [400, 120, 400, 120, 400] : stage >= 1 ? [300, 120, 300] : [220, 100, 220]
    try {
      navigator.vibrate(pattern)
    } catch {
      /* vibration unsupported — the overlay and tone still fire */
    }
  }

  private async notify(payload: { title: string; body: string }) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return
    try {
      // Prefer the service worker so the notification survives a backgrounded tab.
      const registration = await navigator.serviceWorker?.getRegistration()
      if (registration) {
        await registration.showNotification(payload.title, {
          body: payload.body,
          tag: "hader-attendance",
          renotify: true,
          requireInteraction: true,
          silent: false,
          vibrate: [400, 120, 400],
        } as NotificationOptions)
        return
      }
      this.notification = new Notification(payload.title, {
        body: payload.body,
        tag: "hader-attendance",
        requireInteraction: true,
      } as NotificationOptions)
    } catch {
      /* notification failure must not break the in-page alarm */
    }
  }

  /** Explicit user resolution. Nothing else clears an alert. */
  stop() {
    this.active = false
    this.stage = 0
    this.timers.forEach(clearTimeout)
    this.timers = []
    if (this.sustain) clearInterval(this.sustain)
    this.sustain = null

    try {
      navigator.vibrate?.(0)
    } catch {
      /* ignore */
    }
    this.notification?.close()
    this.notification = null

    void navigator.serviceWorker
      ?.getRegistration()
      .then((r) => r?.getNotifications({ tag: "hader-attendance" }))
      .then((list) => list?.forEach((n) => n.close()))
      .catch(() => {})
  }

  dispose() {
    this.stop()
    void this.context?.close().catch(() => {})
    this.context = null
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied"
  if (Notification.permission !== "default") return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return "denied"
  }
}
