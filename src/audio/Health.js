// Audio health metrics: RMS, Peak, Clip %, noise-floor. Honest — no fabricated data (§5 rule 3).

export class Health {
  constructor() {
    this.reset()
  }
  reset() {
    this.rms = 0
    this.peak = 0
    this.clip = 0 // fraction of samples at/over ±0.98
    this.noiseFloor = 0.005
    this._floorInit = false
  }

  // Analyze a time-domain frame (Float32 [-1,1]).
  analyze(frame) {
    let sum = 0
    let peak = 0
    let clipped = 0
    for (let i = 0; i < frame.length; i++) {
      const v = frame[i]
      const a = Math.abs(v)
      sum += v * v
      if (a > peak) peak = a
      if (a >= 0.98) clipped++
    }
    this.rms = Math.sqrt(sum / frame.length)
    this.peak = peak
    this.clip = clipped / frame.length

    // Track a slow-moving noise floor from quiet frames.
    if (this.rms < this.noiseFloor * 1.5 || !this._floorInit) {
      this.noiseFloor = this._floorInit ? this.noiseFloor * 0.98 + this.rms * 0.02 : this.rms
      this._floorInit = true
    }
    return this.snapshot()
  }

  snapshot() {
    return {
      rms: this.rms,
      peak: this.peak,
      clip: this.clip,
      noiseFloor: this.noiseFloor,
      db: this.rms > 0 ? 20 * Math.log10(this.rms) : -100,
    }
  }
}
