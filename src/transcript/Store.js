// Transcript store — windowed (300 nodes), sentence-merge, search, name-flagging.

import { bus, EV } from "../utils/bus.js"
import { uid } from "../utils/dom.js"

const WINDOW = 300
const MERGE_GAP_MS = 1200 // merge quick consecutive fragments from same source

export class TranscriptStore {
  constructor() {
    this.segments = [] // full history
    this.startTs = 0
  }

  reset(startTs = Date.now()) {
    this.segments = []
    this.startTs = startTs
  }

  get length() {
    return this.segments.length
  }

  // Add a transcript fragment; may merge with the previous one.
  add({ text, tStart, tEnd, latency, source }) {
    const prev = this.segments[this.segments.length - 1]
    const canMerge =
      prev &&
      prev.source === source &&
      !prev.response &&
      !prev.name &&
      tStart - prev.tEnd < MERGE_GAP_MS &&
      !/[.!؟?…]$/.test(prev.text)

    if (canMerge) {
      prev.text = (prev.text + " " + text).replace(/\s+/g, " ").trim()
      prev.tEnd = tEnd
      prev.latency = latency
      bus.emit(EV.TRANSCRIPT_UPDATE, prev)
      return prev
    }

    const seg = {
      id: uid(),
      text: text.trim(),
      tStart,
      tEnd,
      latency: latency || 0,
      source: source || null,
      name: false, // set by NameMatcher
      response: false, // set when this is an auto-reply
      ts: Date.now(),
    }
    this.segments.push(seg)
    bus.emit(EV.TRANSCRIPT_ADD, seg)
    return seg
  }

  // Add a synthetic "response fired" marker into the transcript.
  addResponse(text, ts) {
    const seg = {
      id: uid(),
      text: text.trim(),
      tStart: ts,
      tEnd: ts,
      latency: 0,
      source: "response",
      name: false,
      response: true,
      ts: Date.now(),
    }
    this.segments.push(seg)
    bus.emit(EV.TRANSCRIPT_ADD, seg)
    return seg
  }

  flagName(id) {
    const seg = this.segments.find((s) => s.id === id)
    if (seg) {
      seg.name = true
      bus.emit(EV.TRANSCRIPT_UPDATE, seg)
    }
  }

  // The last N segments for rendering.
  window(n = WINDOW) {
    return this.segments.slice(-n)
  }

  search(query) {
    const q = query.trim().toLowerCase()
    if (!q) return this.segments
    return this.segments.filter((s) => s.text.toLowerCase().includes(q))
  }

  get fullText() {
    return this.segments
      .filter((s) => !s.response)
      .map((s) => s.text)
      .join(" ")
  }

  get plainText() {
    return this.segments.map((s) => s.text).join("\n")
  }
}

export const Transcript = new TranscriptStore()
export { WINDOW }
