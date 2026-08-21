// Minimal typed-ish event bus (§3 EVENT/STATE BUS).

class Bus {
  constructor() {
    this.map = new Map()
  }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set())
    this.map.get(evt).add(fn)
    return () => this.off(evt, fn)
  }
  off(evt, fn) {
    this.map.get(evt)?.delete(fn)
  }
  emit(evt, payload) {
    const set = this.map.get(evt)
    if (!set) return
    for (const fn of Array.from(set)) {
      try {
        fn(payload)
      } catch (e) {
        console.error(`[v0] bus handler error on "${evt}":`, e)
      }
    }
  }
}

export const bus = new Bus()

// Canonical event names used across modules.
export const EV = {
  STATE: "state",
  AUDIO_LEVEL: "audio:level", // { rms, peak, clip, spectrum:Float32Array }
  AUDIO_HEALTH: "audio:health",
  AUDIO_DISCONNECT: "audio:disconnect",
  VAD_SPEECH_START: "vad:start",
  VAD_SPEECH_END: "vad:end", // { pcm:Float32Array, tStart, tEnd }
  WHISPER_PROGRESS: "whisper:progress", // { pct, file }
  WHISPER_READY: "whisper:ready", // { backend }
  WHISPER_ERROR: "whisper:error",
  TRANSCRIPT_ADD: "transcript:add", // segment
  TRANSCRIPT_UPDATE: "transcript:update",
  NAME_DETECTED: "name:detected", // { text, ts }
  RESPONSE_FIRED: "response:fired",
  ANALYSIS_UPDATE: "analysis:update",
  MEMORY_UPDATE: "memory:update",
  TOAST: "toast", // { msg, kind }
  SETTINGS: "settings",
  LATENCY: "latency",
}
