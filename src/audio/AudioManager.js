// AudioManager — single AudioContext/stream/node with strict guards (§5 rule 4).
// Handles mic + system/tab capture, device enumeration, disconnect recovery,
// and drives Resampler -> VAD + Health + level/spectrum events.

import { bus, EV } from "../utils/bus.js"
import { Resampler } from "./Resampler.js"
import { VAD } from "./VAD.js"
import { Health } from "./Health.js"

const TARGET_RATE = 16000
const FRAME = 4096 // ScriptProcessor buffer size

export class AudioManager {
  constructor() {
    this.ctx = null
    this.stream = null
    this.sourceNode = null
    this.procNode = null
    this.analyser = null
    this.resampler = null
    this.vad = null
    this.health = new Health()
    this.mode = null // 'mic' | 'sys'
    this.running = false
    this.deviceId = null
    this.spectrum = null
    this._disconnectBound = null
  }

  async listDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return []
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      return all.filter((d) => d.kind === "audioinput")
    } catch {
      return []
    }
  }

  _makeContext() {
    if (this.ctx && this.ctx.state !== "closed") return this.ctx
    const AC = window.AudioContext || window.webkitAudioContext
    this.ctx = new AC()
    return this.ctx
  }

  _preferCable(devices) {
    // Auto-prefer a virtual cable device if present.
    const cable = devices.find((d) => /cable|vb-audio|blackhole|loopback/i.test(d.label))
    return cable?.deviceId || null
  }

  async startMic(deviceId = null) {
    await this.stop()
    this.mode = "mic"
    const ctx = this._makeContext()
    if (ctx.state === "suspended") await ctx.resume()

    if (!deviceId) {
      const devs = await this.listDevices()
      deviceId = this._preferCable(devs) || null
    }
    this.deviceId = deviceId

    // Raw constraints with graceful fallback (some devices reject exact:false toggles).
    const raw = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId }, ...raw } : raw,
      })
    } catch (e) {
      // Fallback to defaults if raw constraints fail.
      stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true })
    }
    this.stream = stream
    this._wire(ctx, stream)
  }

  async startSystem() {
    await this.stop()
    this.mode = "sys"
    const ctx = this._makeContext()
    if (ctx.state === "suspended") await ctx.resume()

    let stream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // required by most browsers to expose the audio-share toggle
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
    } catch (e) {
      throw new Error("تعذّر بدء مشاركة الشاشة")
    }
    // The user must have checked "share tab/system audio".
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((t) => t.stop())
      throw new Error("لم تتم مشاركة صوت النظام — فعّل خيار مشاركة الصوت")
    }
    // We only need audio; stop the video track to save resources.
    stream.getVideoTracks().forEach((t) => t.stop())
    this.stream = stream
    this._wire(ctx, stream)
  }

  _wire(ctx, stream) {
    this.sourceNode = ctx.createMediaStreamSource(stream)
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.8
    this.spectrum = new Uint8Array(this.analyser.frequencyBinCount)

    this.resampler = new Resampler(ctx.sampleRate, TARGET_RATE)
    this.vad = new VAD({
      sampleRate: TARGET_RATE,
      onSegment: (seg) => bus.emit(EV.VAD_SPEECH_END, seg),
    })

    // ScriptProcessor for raw PCM access (widest support incl. file://).
    this.procNode = ctx.createScriptProcessor(FRAME, 1, 1)
    this.procNode.onaudioprocess = (e) => {
      if (!this.running) return
      const input = e.inputBuffer.getChannelData(0)
      const frame = this.resampler.process(input)
      const h = this.health.analyze(frame)
      this.vad.push(frame)

      this.analyser.getByteFrequencyData(this.spectrum)
      bus.emit(EV.AUDIO_LEVEL, {
        rms: h.rms,
        peak: h.peak,
        clip: h.clip,
        spectrum: this.spectrum,
      })
      bus.emit(EV.AUDIO_HEALTH, h)
    }

    this.sourceNode.connect(this.analyser)
    this.analyser.connect(this.procNode)
    // Route to a muted gain so the graph pulls without echoing to speakers.
    const sink = ctx.createGain()
    sink.gain.value = 0
    this.procNode.connect(sink)
    sink.connect(ctx.destination)
    this._sink = sink

    this.running = true

    // Disconnect detection.
    const track = stream.getAudioTracks()[0]
    this._disconnectBound = () => {
      if (!this.running) return
      bus.emit(EV.AUDIO_DISCONNECT, { mode: this.mode })
    }
    track.addEventListener("ended", this._disconnectBound)
  }

  // Reconnect after a device drop without losing pipeline state.
  async reconnect() {
    const prevMode = this.mode
    const prevDevice = this.deviceId
    await this.stop({ keepContext: true })
    if (prevMode === "sys") await this.startSystem()
    else await this.startMic(prevDevice)
  }

  async changeDevice(deviceId) {
    if (this.mode !== "mic") return
    await this.startMic(deviceId)
  }

  async stop({ keepContext = false } = {}) {
    this.running = false
    if (this.vad) this.vad.flush()
    try {
      if (this._disconnectBound && this.stream) {
        const track = this.stream.getAudioTracks()[0]
        track?.removeEventListener("ended", this._disconnectBound)
      }
    } catch {}
    try {
      this.procNode && (this.procNode.onaudioprocess = null)
      this.procNode && this.procNode.disconnect()
      this.analyser && this.analyser.disconnect()
      this.sourceNode && this.sourceNode.disconnect()
      this._sink && this._sink.disconnect()
    } catch {}
    try {
      this.stream && this.stream.getTracks().forEach((t) => t.stop())
    } catch {}
    this.procNode = null
    this.analyser = null
    this.sourceNode = null
    this._sink = null
    this.stream = null
    this.health.reset()
    if (!keepContext && this.ctx && this.ctx.state !== "closed") {
      try {
        await this.ctx.close()
      } catch {}
      this.ctx = null
    }
  }

  get sampleRate() {
    return this.ctx?.sampleRate || 0
  }
}

export const AM = new AudioManager()
