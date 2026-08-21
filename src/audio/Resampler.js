// Linear resampler: arbitrary input rate -> 16000 Hz mono Float32 (Whisper wants 16k).
// Guarded: no-op when already at target.

export class Resampler {
  constructor(inputRate, targetRate = 16000) {
    this.inputRate = inputRate
    this.targetRate = targetRate
    this.ratio = inputRate / targetRate
  }

  // Resample a Float32Array (mono, [-1,1]) to target rate.
  process(input) {
    if (this.inputRate === this.targetRate) return input.slice()
    const outLen = Math.floor(input.length / this.ratio)
    const out = new Float32Array(outLen)
    for (let i = 0; i < outLen; i++) {
      const srcPos = i * this.ratio
      const i0 = Math.floor(srcPos)
      const i1 = Math.min(i0 + 1, input.length - 1)
      const frac = srcPos - i0
      out[i] = input[i0] * (1 - frac) + input[i1] * frac
    }
    return out
  }
}

// Concatenate an array of Float32Array chunks into one.
export function concatFloat32(chunks) {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Float32Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}
