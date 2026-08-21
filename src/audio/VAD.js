// Voice Activity Detection — emits speech *segments*, never blind fixed chunks (§5 rule 5).
//
// Params (§ spec): pre-roll 400ms, min-speech guard, 750ms trailing silence ends a segment,
// 12s hard cap. Uses an adaptive noise floor so it works across mic levels.

export class VAD {
  constructor(opts = {}) {
    this.sampleRate = opts.sampleRate || 16000
    this.preRollMs = opts.preRollMs ?? 400
    this.minSpeechMs = opts.minSpeechMs ?? 250
    this.silenceMs = opts.silenceMs ?? 750
    this.maxSegMs = opts.maxSegMs ?? 12000
    this.onSegment = opts.onSegment || (() => {})

    this.reset()
  }

  reset() {
    this.noiseFloor = 0.005
    this.speaking = false
    this.speechSamples = 0
    this.silenceSamples = 0
    this.segBuf = [] // Float32Array chunks for the active segment
    this.preRoll = [] // rolling pre-roll buffer of chunks
    this.preRollSamples = 0
    this.tStartMs = 0
    this.elapsedMs = 0
    this._segStartElapsed = 0
  }

  msToSamples(ms) {
    return Math.floor((ms / 1000) * this.sampleRate)
  }

  rmsOf(frame) {
    let sum = 0
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
    return Math.sqrt(sum / frame.length)
  }

  // Feed a mono 16k Float32 frame. Returns nothing; fires onSegment on completion.
  push(frame) {
    const dur = (frame.length / this.sampleRate) * 1000
    const rms = this.rmsOf(frame)

    // Adaptive noise floor (only adapts while not speaking, slow attack).
    if (!this.speaking) {
      this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05
    }
    const threshold = Math.max(0.012, this.noiseFloor * 2.5)
    const isVoice = rms > threshold

    // Maintain pre-roll ring buffer while idle.
    if (!this.speaking) {
      this.preRoll.push(frame)
      this.preRollSamples += frame.length
      const maxPre = this.msToSamples(this.preRollMs)
      while (this.preRollSamples > maxPre && this.preRoll.length > 1) {
        this.preRollSamples -= this.preRoll.shift().length
      }
    }

    if (isVoice) {
      if (!this.speaking) {
        // Speech onset — start segment with pre-roll included.
        this.speaking = true
        this.segBuf = [...this.preRoll]
        this._segStartElapsed = this.elapsedMs - this.preRollMs
        this.tStartMs = Math.max(0, this._segStartElapsed)
        this.preRoll = []
        this.preRollSamples = 0
        this.speechSamples = 0
        this.silenceSamples = 0
      }
      this.segBuf.push(frame)
      this.speechSamples += frame.length
      this.silenceSamples = 0
    } else if (this.speaking) {
      this.segBuf.push(frame)
      this.silenceSamples += frame.length
      // Trailing silence long enough -> finalize.
      if (this.silenceSamples >= this.msToSamples(this.silenceMs)) {
        this._finalize()
      }
    }

    this.elapsedMs += dur

    // Hard cap: emit a segment even mid-speech so latency stays bounded.
    if (this.speaking) {
      const segMs = this.elapsedMs - this._segStartElapsed
      if (segMs >= this.maxSegMs) this._finalize(true)
    }
  }

  _finalize(capped = false) {
    const speechMs = (this.speechSamples / this.sampleRate) * 1000
    const chunks = this.segBuf
    this.speaking = false
    this.segBuf = []
    this.silenceSamples = 0
    this.speechSamples = 0

    // Discard segments that are essentially just noise blips.
    if (speechMs < this.minSpeechMs) return

    let total = 0
    for (const c of chunks) total += c.length
    const pcm = new Float32Array(total)
    let off = 0
    for (const c of chunks) {
      pcm.set(c, off)
      off += c.length
    }
    const tEnd = this.elapsedMs
    this.onSegment({ pcm, tStart: this.tStartMs, tEnd, capped })
    if (capped) {
      // Continue capturing seamlessly for a long utterance.
      this.speaking = true
      this.segBuf = []
      this._segStartElapsed = this.elapsedMs
      this.tStartMs = this.elapsedMs
    }
  }

  // Force-close any pending segment (e.g. on stop).
  flush() {
    if (this.speaking) this._finalize()
  }
}
