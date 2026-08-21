// NameMatcher — normalized token-sequence matching for Arabic name calls.
// Matches "أحمد", "احمد", "يا أحمد", "أحمد؟", aliases, etc. (§4 Response).

import { normalizeArabic, tokens, tokenSeqIncludes } from "../utils/text.js"

const VOCATIVES = ["يا", "ya", "استاذ", "أستاذ", "دكتور", "د"]

export class NameMatcher {
  constructor() {
    this.targets = [] // array of token arrays
    this.raw = []
  }

  // Configure from primary name + comma-separated aliases.
  configure(name, aliasesStr = "") {
    const list = [name, ...String(aliasesStr || "").split(",")]
      .map((s) => s.trim())
      .filter(Boolean)
    this.raw = list
    this.targets = list.map((n) => tokens(n)).filter((t) => t.length)
    // Also register the vocative-stripped core of each (so "يا أحمد" -> "أحمد").
    for (const t of [...this.targets]) {
      const stripped = t.filter((tok) => !VOCATIVES.includes(tok))
      if (stripped.length && stripped.length !== t.length) {
        this.targets.push(stripped)
      }
    }
  }

  // Return true if the utterance contains a call to the target.
  test(text) {
    if (!this.targets.length) return false
    const hay = tokens(text)
    if (!hay.length) return false
    for (const needle of this.targets) {
      if (tokenSeqIncludes(hay, needle)) return true
    }
    return false
  }

  // Which raw target matched (for UI display), or null.
  match(text) {
    const hay = tokens(text)
    for (let i = 0; i < this.targets.length; i++) {
      if (tokenSeqIncludes(hay, this.targets[i])) {
        return this.raw[i] || this.raw[0] || normalizeArabic(text)
      }
    }
    return null
  }
}

export const Matcher = new NameMatcher()
