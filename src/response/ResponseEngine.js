// ResponseEngine — cooldown + max/min gating, name-detected -> auto-reply (§4).

import { bus, EV } from "../utils/bus.js"
import { SM, STATES } from "../utils/state.js"
import { Settings } from "../session/Settings.js"
import { Matcher } from "./NameMatcher.js"
import { Speaker } from "./TTS.js"

export class ResponseEngine {
  constructor() {
    this.lastFired = 0
    this.count = 0
    this.sinkId = null
    this.onFired = () => {}
  }

  reset() {
    this.lastFired = 0
    this.count = 0
  }

  configure() {
    Matcher.configure(Settings.get("name"), Settings.get("aliases"))
  }

  setSink(deviceId) {
    this.sinkId = deviceId
  }

  // Evaluate a transcript segment. Returns true if a response was fired.
  evaluate(seg) {
    if (!Matcher.test(seg.text)) return false

    // Flag the segment as a name-call regardless of whether we respond.
    seg.name = true
    bus.emit(EV.NAME_DETECTED, { text: seg.text, ts: seg.tEnd, id: seg.id })

    const now = Date.now()
    const cooldownMs = (Number(Settings.get("cooldown")) || 8) * 1000
    const maxResp = Number(Settings.get("maxResp")) || 0

    if (now - this.lastFired < cooldownMs) return false
    if (maxResp > 0 && this.count >= maxResp) return false

    this.fire()
    return true
  }

  // Manually trigger a response (dock button / F8).
  fire(customText) {
    const text = customText || Settings.get("resp")
    const vol = Number(Settings.get("vol")) ?? 0.9
    this.lastFired = Date.now()
    this.count++

    const prev = SM.state
    SM.set(STATES.DETECTED)
    setTimeout(() => SM.set(STATES.RESPONDING), 250)

    Speaker.speak(text, { volume: vol, sinkId: this.sinkId })

    bus.emit(EV.RESPONSE_FIRED, { text, count: this.count, ts: Date.now() })
    this.onFired({ text, count: this.count })

    // Return to prior listening/paused state after speaking.
    setTimeout(() => {
      if (SM.is(STATES.RESPONDING, STATES.DETECTED)) {
        SM.set(prev === STATES.PAUSED ? STATES.PAUSED : STATES.LISTENING)
      }
    }, 1600)
  }
}

export const Responder = new ResponseEngine()
