// WhisperManager — LAZY dynamic import of @huggingface/transformers (§5 rule 1).
// Runtime WebGPU check -> WASM fallback (§5 rule 6). UI never dies without network.

import { bus, EV } from "../utils/bus.js"
import { checkWebGPU } from "../utils/state.js"

const MODELS = {
  tiny: "onnx-community/whisper-tiny",
  base: "onnx-community/whisper-base",
}

export class WhisperManager {
  constructor() {
    this.pipe = null
    this.backend = null // 'webgpu' | 'wasm'
    this.modelName = null
    this.loading = false
    this.transformers = null
  }

  get ready() {
    return !!this.pipe
  }

  async _loadLib() {
    if (this.transformers) return this.transformers
    // Dynamic import: only fetched on real start, so offline UI still works.
    const t = await import("@huggingface/transformers")
    // Point cache/wasm at the CDN; allow remote model download.
    t.env.allowLocalModels = false
    t.env.allowRemoteModels = true
    if (t.env.backends?.onnx?.wasm) {
      t.env.backends.onnx.wasm.proxy = true
    }
    this.transformers = t
    return t
  }

  // Load a model. Tries WebGPU (fp16) then falls back to WASM (int8/q8).
  async load(modelKey = "tiny", { forceWasm = false } = {}) {
    if (this.loading) return
    this.loading = true
    this.modelName = MODELS[modelKey] || MODELS.tiny

    const onProgress = (data) => {
      if (data.status === "progress" && data.total) {
        bus.emit(EV.WHISPER_PROGRESS, {
          pct: Math.round((data.loaded / data.total) * 100),
          file: data.file,
        })
      } else if (data.status === "ready" || data.status === "done") {
        bus.emit(EV.WHISPER_PROGRESS, { pct: 100, file: data.file })
      }
    }

    try {
      const { pipeline } = await this._loadLib()

      const canGPU = !forceWasm && (await checkWebGPU())
      if (canGPU) {
        try {
          this.pipe = await pipeline("automatic-speech-recognition", this.modelName, {
            device: "webgpu",
            dtype: { encoder_model: "fp32", decoder_model_merged: "fp32" },
            progress_callback: onProgress,
          })
          this.backend = "webgpu"
        } catch (gpuErr) {
          console.warn("[v0] WebGPU load failed, falling back to WASM:", gpuErr)
          this.pipe = null
        }
      }

      if (!this.pipe) {
        this.pipe = await pipeline("automatic-speech-recognition", this.modelName, {
          device: "wasm",
          dtype: "q8",
          progress_callback: onProgress,
        })
        this.backend = "wasm"
      }

      this.loading = false
      bus.emit(EV.WHISPER_READY, { backend: this.backend, model: modelKey })
      return { backend: this.backend }
    } catch (err) {
      this.loading = false
      bus.emit(EV.WHISPER_ERROR, { error: err })
      throw err
    }
  }

  // Transcribe a Float32 16k mono PCM buffer.
  async transcribe(pcm, { lang = "auto" } = {}) {
    if (!this.pipe) throw new Error("Whisper not loaded")
    const opts = {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    }
    if (lang && lang !== "auto") {
      opts.language = lang
      opts.task = "transcribe"
    }
    const out = await this.pipe(pcm, opts)
    return (out?.text || "").trim()
  }

  async dispose() {
    try {
      await this.pipe?.dispose?.()
    } catch {}
    this.pipe = null
    this.backend = null
  }
}

export const WM = new WhisperManager()
