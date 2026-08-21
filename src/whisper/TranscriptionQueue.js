// TranscriptionQueue — sequential, bounded (≤8), latency-tracked (§3, §4).

import { bus, EV } from "../utils/bus.js"
import { SM, STATES } from "../utils/state.js"

export class TranscriptionQueue {
  constructor(whisper, { max = 8 } = {}) {
    this.whisper = whisper
    this.max = max
    this.queue = []
    this.busy = false
    this.onText = () => {}
    this.lang = "auto"
    this.dropped = 0
  }

  setLang(lang) {
    this.lang = lang
  }

  enqueue(segment) {
    // Bounded: drop oldest if full so we never blow up memory under load.
    if (this.queue.length >= this.max) {
      this.queue.shift()
      this.dropped++
    }
    this.queue.push(segment)
    this._drain()
  }

  async _drain() {
    if (this.busy) return
    const seg = this.queue.shift()
    if (!seg) return
    this.busy = true
    const wasListening = SM.is(STATES.LISTENING, STATES.DETECTED, STATES.RESPONDING)
    if (SM.is(STATES.LISTENING)) SM.set(STATES.PROCESSING)

    const t0 = performance.now()
    try {
      const text = await this.whisper.transcribe(seg.pcm, { lang: this.lang })
      const latency = Math.round(performance.now() - t0)
      bus.emit(EV.LATENCY, { ms: latency, queued: this.queue.length })
      if (text) {
        this.onText({
          text,
          tStart: seg.tStart,
          tEnd: seg.tEnd,
          latency,
          source: seg.source || null,
        })
      }
    } catch (err) {
      console.error("[v0] transcription error:", err)
    } finally {
      this.busy = false
      if (this.queue.length) {
        this._drain()
      } else if (wasListening && SM.is(STATES.PROCESSING)) {
        SM.set(STATES.LISTENING)
      }
    }
  }

  clear() {
    this.queue = []
    this.dropped = 0
  }

  get depth() {
    return this.queue.length
  }
}
