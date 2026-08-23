import { describe, expect, it } from "vitest"
import { canTransition, isActive, isMonitoring, transition } from "@/lib/session/machine"
import { semanticVerdictSchema, pairingCodeSchema, verifyRequestSchema } from "@/lib/schemas"

describe("session state machine", () => {
  it("walks the happy path to listening", () => {
    let s = transition("IDLE", { type: "PREPARE" })
    expect(s).toBe("PREPARING")
    s = transition(s, { type: "REQUEST_AUDIO" })
    expect(s).toBe("REQUESTING_AUDIO")
    s = transition(s, { type: "AUDIO_GRANTED" })
    expect(s).toBe("CONNECTING_ASR")
    s = transition(s, { type: "ASR_CONNECTED" })
    expect(s).toBe("READY")
    s = transition(s, { type: "START_LISTENING" })
    expect(s).toBe("LISTENING")
  })

  it("runs the full alert and confirmation cycle back to listening", () => {
    let s = transition("LISTENING", { type: "ALERT" })
    expect(s).toBe("ALERTING")
    s = transition(s, { type: "AWAIT_CONFIRMATION" })
    expect(s).toBe("WAITING_CONFIRMATION")
    s = transition(s, { type: "CONFIRM" })
    expect(s).toBe("CONFIRMED")
    s = transition(s, { type: "RESUME" })
    expect(s).toBe("LISTENING")
  })

  it("returns to listening on a false alarm", () => {
    expect(transition("WAITING_CONFIRMATION", { type: "DISMISS" })).toBe("LISTENING")
  })

  it("never reports LISTENING when audio is denied", () => {
    const s = transition("REQUESTING_AUDIO", { type: "AUDIO_DENIED", reason: "denied" })
    expect(s).toBe("ERROR")
    expect(isMonitoring(s)).toBe(false)
  })

  it("cannot jump from IDLE straight to LISTENING", () => {
    expect(transition("IDLE", { type: "START_LISTENING" })).toBe("IDLE")
    expect(canTransition("IDLE", "START_LISTENING")).toBe(false)
  })

  it("handles reconnect and recovery", () => {
    let s = transition("LISTENING", { type: "ASR_LOST" })
    expect(s).toBe("RECONNECTING")
    s = transition(s, { type: "ASR_RECOVERED" })
    expect(s).toBe("LISTENING")
  })

  it("keeps alerting possible while degraded", () => {
    expect(transition("DEGRADED", { type: "ALERT" })).toBe("ALERTING")
    expect(isMonitoring("DEGRADED")).toBe(true)
  })

  it("ignores unknown events instead of corrupting state", () => {
    expect(transition("CONFIRMED", { type: "AUDIO_GRANTED" })).toBe("CONFIRMED")
  })

  it("reports active states that hold the audio device", () => {
    expect(isActive("REQUESTING_AUDIO")).toBe(true)
    expect(isActive("IDLE")).toBe(false)
    expect(isActive("ENDED")).toBe(false)
  })
})

describe("schemas", () => {
  it("accepts a valid semantic verdict", () => {
    const parsed = semanticVerdictSchema.parse({
      eventType: "ATTENDANCE_CALL",
      calledUser: true,
      confidence: 0.94,
      requiresAlert: true,
      reason: "Lecturer directly called the configured student.",
    })
    expect(parsed.calledUser).toBe(true)
  })

  it("rejects an out-of-range confidence", () => {
    expect(() =>
      semanticVerdictSchema.parse({
        eventType: "ATTENDANCE_CALL",
        calledUser: true,
        confidence: 1.5,
        requiresAlert: true,
        reason: "bad",
      }),
    ).toThrow()
  })

  it("rejects an unknown event type", () => {
    expect(() =>
      semanticVerdictSchema.parse({
        eventType: "SOMETHING_ELSE",
        calledUser: true,
        confidence: 0.5,
        requiresAlert: false,
        reason: "bad",
      }),
    ).toThrow()
  })

  it("validates verify requests and applies defaults", () => {
    const parsed = verifyRequestSchema.parse({
      phrase: "Ahmed?",
      aliasMatched: "Ahmed",
      deterministicScore: 0.7,
    })
    expect(parsed.previousContext).toBe("")
    expect(parsed.language).toBe("en")
  })

  it("enforces 6-digit pairing codes", () => {
    expect(pairingCodeSchema.parse({ code: "123456" }).role).toBe("ALERT")
    expect(() => pairingCodeSchema.parse({ code: "12ab56" })).toThrow()
    expect(() => pairingCodeSchema.parse({ code: "12345" })).toThrow()
  })
})
