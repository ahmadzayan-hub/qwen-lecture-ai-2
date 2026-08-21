// TTS — speechSynthesis with Arabic voice preference + unlock, plus file-reply routing.
// Honest limitation: speechSynthesis output CANNOT be routed to a specific sink;
// only an <audio> file reply can (via AudioContext.setSinkId). (§9 Limitations)

import { caps } from "../utils/state.js"

export class TTS {
  constructor() {
    this.unlocked = false
    this.voice = null
    this.fileEl = null
    this.fileBuffer = null // uploaded/recorded reply blob URL
    this._loadVoices()
    if (caps.speechSynthesis) {
      window.speechSynthesis.addEventListener?.("voiceschanged", () => this._loadVoices())
    }
  }

  _loadVoices() {
    if (!caps.speechSynthesis) return
    const voices = window.speechSynthesis.getVoices()
    this.voice =
      voices.find((v) => /ar/i.test(v.lang)) ||
      voices.find((v) => /Arabic/i.test(v.name)) ||
      voices[0] ||
      null
  }

  // Must be called from a user gesture once to satisfy autoplay policies.
  unlock() {
    if (this.unlocked || !caps.speechSynthesis) return
    try {
      const u = new SpeechSynthesisUtterance("")
      window.speechSynthesis.speak(u)
      window.speechSynthesis.cancel()
      this.unlocked = true
    } catch {}
  }

  setFileReply(blobUrl) {
    this.fileBuffer = blobUrl
  }

  // Try to route a file reply to a specific output device (best-effort).
  async _playFile(volume, sinkId) {
    if (!this.fileEl) this.fileEl = new Audio()
    this.fileEl.src = this.fileBuffer
    this.fileEl.volume = volume
    if (sinkId && caps.setSinkId && this.fileEl.setSinkId) {
      try {
        await this.fileEl.setSinkId(sinkId)
      } catch {}
    }
    await this.fileEl.play()
  }

  async speak(text, { volume = 0.9, sinkId = null } = {}) {
    // Prefer an uploaded/recorded file reply if present (routable).
    if (this.fileBuffer) {
      await this._playFile(volume, sinkId)
      return
    }
    if (!caps.speechSynthesis) return
    this.unlock()
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    if (this.voice) u.voice = this.voice
    u.lang = this.voice?.lang || "ar-SA"
    u.volume = volume
    u.rate = 1
    u.pitch = 1
    window.speechSynthesis.speak(u)
  }

  stop() {
    try {
      window.speechSynthesis?.cancel()
    } catch {}
    try {
      this.fileEl?.pause()
    } catch {}
  }
}

export const Speaker = new TTS()
