// Settings persistence (§3 STORAGE keys qlaV32_*). API key is NEVER stored.

import { bus, EV } from "../utils/bus.js"

const PREFIX = "qlaV32_"

const DEFAULTS = {
  name: "أحمد", // target name
  aliases: "احمد, يا أحمد, يا احمد", // extra spellings/forms, comma-separated
  resp: "نعم دكتور، أنا حاضر.", // canned response text
  cooldown: 8, // seconds between auto-responses
  maxResp: 0, // 0 = unlimited responses per session
  vol: 0.9, // TTS/reply volume
  model: "tiny", // tiny | base
  lang: "auto", // auto | ar | en
  proxy: "", // optional Qwen proxy URL
  local: true, // prefer local heuristics
  light: false, // light theme
  perf: false, // performance mode
  ob: false, // onboarding seen
  notes: true, // auto-notes
}

let cache = null

function loadAll() {
  if (cache) return cache
  cache = { ...DEFAULTS }
  if (typeof localStorage === "undefined") return cache
  for (const key of Object.keys(DEFAULTS)) {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) continue
    try {
      cache[key] = JSON.parse(raw)
    } catch {
      cache[key] = raw
    }
  }
  return cache
}

export const Settings = {
  get(key) {
    const all = loadAll()
    return key ? all[key] : { ...all }
  },
  set(key, val) {
    const all = loadAll()
    all[key] = val
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(val))
    } catch {}
    bus.emit(EV.SETTINGS, { key, val, all: { ...all } })
    return val
  },
  setMany(obj) {
    for (const [k, v] of Object.entries(obj)) this.set(k, v)
  },
  reset() {
    cache = { ...DEFAULTS }
    for (const key of Object.keys(DEFAULTS)) {
      try {
        localStorage.removeItem(PREFIX + key)
      } catch {}
    }
    bus.emit(EV.SETTINGS, { key: null, val: null, all: { ...cache } })
  },
}

// The API key is held in-memory only for the session (never persisted).
let sessionApiKey = ""
export const apiKey = {
  get: () => sessionApiKey,
  set: (v) => {
    sessionApiKey = v || ""
  },
}
