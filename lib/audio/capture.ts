/**
 * Audio capture for HADER AI.
 *
 * Three sources, all real:
 *   SYSTEM_AUDIO — getDisplayMedia(), for Teams on Windows. Video track is
 *                  stopped immediately; only audio is ever processed.
 *   MICROPHONE   — getUserMedia(), works on Windows + Android.
 *   SIMULATION   — no capture at all (handled by the engine, not here).
 *
 * The capture layer NEVER stores audio. It exposes a live level meter and
 * hands PCM chunks to whichever ASR engine is active.
 */

import type { AudioSource } from "@/lib/types"

export type CaptureFailureReason =
  | "PERMISSION_DENIED"
  | "NO_AUDIO_TRACK"
  | "UNSUPPORTED"
  | "ENDED_BY_USER"
  | "UNKNOWN"

export class CaptureError extends Error {
  reason: CaptureFailureReason
  /** What the user should actually do next. Shown verbatim in the UI. */
  remedy: string

  constructor(reason: CaptureFailureReason, message: string, remedy: string) {
    super(message)
    this.name = "CaptureError"
    this.reason = reason
    this.remedy = remedy
  }
}

export interface CaptureHandle {
  source: AudioSource
  stream: MediaStream
  context: AudioContext
  sampleRate: number
  /** 0..1 short-term RMS, for the level meter and "can it actually hear?" check. */
  getLevel(): number
  /** Resolves when the user stops the share from the browser chrome. */
  onEnded(cb: () => void): void
  stop(): void
}

const SUPPORTED_MIC = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia

const SUPPORTED_DISPLAY = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia

export function isSourceSupported(source: AudioSource): boolean {
  if (source === "SIMULATION") return true
  if (source === "MICROPHONE") return SUPPORTED_MIC()
  return SUPPORTED_DISPLAY()
}

/**
 * Requests system/tab audio via screen capture.
 *
 * The browser will not give us audio without also offering video, so we ask
 * for video and then immediately stop and discard every video track. No frame
 * is ever read, drawn, stored, or transmitted.
 */
export async function captureSystemAudio(): Promise<CaptureHandle> {
  if (!SUPPORTED_DISPLAY()) {
    throw new CaptureError(
      "UNSUPPORTED",
      "getDisplayMedia is unavailable in this browser.",
      "Use Chrome or Edge on Windows, or switch to Microphone mode.",
    )
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      // Chrome/Edge hint that surfaces the "Share system audio" checkbox.
      // @ts-expect-error non-standard but honoured by Chromium.
      systemAudio: "include",
      selfBrowserSurface: "exclude",
    })
  } catch (error) {
    const name = (error as Error)?.name
    if (name === "NotAllowedError") {
      throw new CaptureError(
        "PERMISSION_DENIED",
        "Screen capture was dismissed.",
        "Press Start again, pick the Teams window or Entire Screen, and tick Share system audio.",
      )
    }
    throw new CaptureError(
      "UNKNOWN",
      "Screen capture failed to start.",
      "Try again, or switch to Microphone mode to listen through your speakers.",
    )
  }

  // Discard video the moment we have the stream.
  for (const track of stream.getVideoTracks()) {
    track.stop()
    stream.removeTrack(track)
  }

  if (stream.getAudioTracks().length === 0) {
    stream.getTracks().forEach((t) => t.stop())
    throw new CaptureError(
      "NO_AUDIO_TRACK",
      "The selected surface was shared without audio.",
      'Share again and enable "Share system audio" (Chrome/Edge), or use Microphone mode with your speakers on.',
    )
  }

  return buildHandle("SYSTEM_AUDIO", stream)
}

export async function captureMicrophone(deviceId?: string): Promise<CaptureHandle> {
  if (!SUPPORTED_MIC()) {
    throw new CaptureError(
      "UNSUPPORTED",
      "getUserMedia is unavailable in this browser.",
      "Open Hader over HTTPS (or localhost) in Chrome, Edge, or Android Chrome.",
    )
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
      video: false,
    })
    return buildHandle("MICROPHONE", stream)
  } catch (error) {
    const name = (error as Error)?.name
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new CaptureError(
        "PERMISSION_DENIED",
        "Microphone permission was denied.",
        "Allow the microphone from the padlock icon in the address bar, then press Start again.",
      )
    }
    if (name === "NotFoundError") {
      throw new CaptureError(
        "NO_AUDIO_TRACK",
        "No microphone was found.",
        "Connect a microphone or headset, then press Start again.",
      )
    }
    throw new CaptureError("UNKNOWN", "Microphone capture failed.", "Try again, or use System Audio mode.")
  }
}

function buildHandle(source: AudioSource, stream: MediaStream): CaptureHandle {
  const AudioCtor: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const context = new AudioCtor()
  const sourceNode = context.createMediaStreamSource(stream)

  // Analyser is cheap and runs on the audio thread — used only for the meter.
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0.6
  sourceNode.connect(analyser)

  const buffer = new Float32Array(analyser.fftSize)
  let stopped = false

  const endedCallbacks: Array<() => void> = []
  for (const track of stream.getAudioTracks()) {
    track.addEventListener("ended", () => {
      endedCallbacks.forEach((cb) => cb())
    })
  }

  return {
    source,
    stream,
    context,
    sampleRate: context.sampleRate,
    getLevel() {
      if (stopped) return 0
      analyser.getFloatTimeDomainData(buffer)
      let sum = 0
      for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i]
      const rms = Math.sqrt(sum / buffer.length)
      // Perceptual curve so quiet speech is still visible on the meter.
      return Math.min(1, rms * 4)
    },
    onEnded(cb) {
      endedCallbacks.push(cb)
    },
    stop() {
      if (stopped) return
      stopped = true
      stream.getTracks().forEach((t) => t.stop())
      void context.close().catch(() => {})
    },
  }
}

export async function captureFor(source: AudioSource, deviceId?: string): Promise<CaptureHandle> {
  if (source === "SYSTEM_AUDIO") return captureSystemAudio()
  if (source === "MICROPHONE") return captureMicrophone(deviceId)
  throw new CaptureError("UNSUPPORTED", "Simulation mode does not capture audio.", "Pick System Audio or Microphone.")
}
