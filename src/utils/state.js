// State machine (§3 STATES) + capability detection (§5 rule 2).

import { bus, EV } from "./bus.js"

export const STATES = {
  IDLE: "IDLE",
  READY: "READY",
  REQUESTING: "REQUESTING",
  LOADING: "LOADING",
  LISTENING: "LISTENING",
  PROCESSING: "PROCESSING",
  ANALYZING: "ANALYZING",
  DETECTED: "DETECTED",
  RESPONDING: "RESPONDING",
  PAUSED: "PAUSED",
  RECONNECTING: "RECONNECTING",
  ERROR: "ERROR",
}

// Arabic labels for HUD/orb.
export const STATE_LABEL = {
  IDLE: "خامل",
  READY: "جاهز",
  REQUESTING: "طلب الإذن…",
  LOADING: "تحميل النموذج…",
  LISTENING: "يستمع",
  PROCESSING: "تفريغ…",
  ANALYZING: "تحليل…",
  DETECTED: "تم النداء",
  RESPONDING: "يرد…",
  PAUSED: "متوقف مؤقتًا",
  RECONNECTING: "إعادة الاتصال…",
  ERROR: "خطأ",
}

class StateMachine {
  constructor() {
    this.state = STATES.IDLE
    this.prev = STATES.IDLE
    this.meta = {}
  }
  set(next, meta = {}) {
    if (!STATES[next]) {
      console.warn("[v0] unknown state:", next)
      return
    }
    this.prev = this.state
    this.state = next
    this.meta = meta
    bus.emit(EV.STATE, { state: next, prev: this.prev, meta })
  }
  is(...s) {
    return s.includes(this.state)
  }
}

export const SM = new StateMachine()

// ---- Capability detection (honest ✓/✗) -----------------------------------

export const caps = {
  mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  displayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
  audioContext: !!(window.AudioContext || window.webkitAudioContext),
  audioWorklet: !!(window.AudioContext && AudioContext.prototype.audioWorklet),
  webgpu: "gpu" in navigator, // presence only — real check is async below
  wasm: typeof WebAssembly === "object",
  setSinkId: typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype,
  speechSynthesis: "speechSynthesis" in window,
  serviceWorker: "serviceWorker" in navigator,
  storage: (() => {
    try {
      localStorage.setItem("__t", "1")
      localStorage.removeItem("__t")
      return true
    } catch {
      return false
    }
  })(),
  crossOriginIsolated: !!window.crossOriginIsolated,
  ios: /iP(hone|ad|od)/.test(navigator.platform) || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1),
}

// Presence ≠ working. Verify an actual adapter can be acquired.
export async function checkWebGPU() {
  if (!("gpu" in navigator)) return false
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return !!adapter
  } catch {
    return false
  }
}
