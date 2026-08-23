import { describe, expect, it } from "vitest"
import {
  arabicKey,
  detectLanguage,
  editDistance,
  normalizeArabic,
  normalizeForMatch,
  normalizeLatin,
  phoneticKey,
  similarity,
} from "@/lib/detection/normalize"
import { buildAliasIndex, hasNameProximity, matchAliases } from "@/lib/detection/aliases"
import { detect, SENSITIVITY_THRESHOLDS } from "@/lib/detection/engine"
import { extractContext } from "@/lib/detection/context"
import type { NameProfile } from "@/lib/types"

// Example profile only — the engine has no hardcoded identity.
const profile: NameProfile = {
  fullName: "Ahmed Zaian",
  firstName: "Ahmed",
  surname: "Zaian",
  aliases: ["Ahmad", "Zayan", "Zian"],
  arabicAliases: ["أحمد", "زيان"],
}

const index = buildAliasIndex(profile)
const high = { sensitivity: "high" as const }

describe("english normalization", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normalizeLatin("  Ahmed,   ARE you   there?! ")).toBe("ahmed are you there")
  })

  it("computes edit distance and similarity", () => {
    expect(editDistance("ahmed", "ahmad")).toBe(1)
    expect(similarity("ahmed", "ahmed")).toBe(1)
    expect(similarity("zaian", "zayan")).toBeGreaterThan(0.75)
  })

  it("matches transliteration spread phonetically", () => {
    expect(phoneticKey("Ahmed")).toBe(phoneticKey("Ahmad"))
    expect(phoneticKey("Zaian")).toBe(phoneticKey("Zayan"))
    expect(phoneticKey("Zaian")).toBe(phoneticKey("Zian"))
  })
})

describe("arabic normalization", () => {
  it("removes tashkeel and tatweel", () => {
    expect(normalizeArabic("أَحْمَــــد")).toBe("احمد")
  })

  it("normalizes alef variants", () => {
    expect(normalizeArabic("آحمد")).toBe("احمد")
    expect(normalizeArabic("إحمد")).toBe("احمد")
    expect(normalizeArabic("أحمد")).toBe("احمد")
  })

  it("keeps arabic and latin tokens in mixed text", () => {
    const out = normalizeForMatch("أحمد Zaian?")
    expect(out).toContain("احمد")
    expect(out).toContain("zaian")
  })

  it("builds a consonant skeleton", () => {
    expect(arabicKey("زيان")).toBe(arabicKey("زيّان"))
  })

  it("detects language", () => {
    expect(detectLanguage("Ahmed, are you with us?")).toBe("en")
    expect(detectLanguage("أحمد موجود؟")).toBe("ar")
    expect(detectLanguage("أحمد Zaian?")).toBe("mixed")
  })
})

describe("alias matching", () => {
  it("matches exact first name", () => {
    const matches = matchAliases("Ahmed, are you with us?", index)
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].entry.raw.toLowerCase()).toContain("ahmed")
  })

  it("matches full-name phrase", () => {
    const matches = matchAliases("Ahmed Zaian, are you with us?", index)
    expect(hasNameProximity(matches)).toBe(true)
  })

  it("matches ASR misspellings fuzzily", () => {
    expect(matchAliases("Ahmet are you there", index).length).toBeGreaterThan(0)
    expect(matchAliases("Zeyan can you answer", index).length).toBeGreaterThan(0)
  })

  it("matches arabic aliases", () => {
    expect(matchAliases("أحمد موجود؟", index).length).toBeGreaterThan(0)
    expect(matchAliases("أَحْمَد زيان معانا؟", index).length).toBeGreaterThan(0)
  })

  it("does not match unrelated names", () => {
    expect(matchAliases("Mohamed, are you with us?", index)).toHaveLength(0)
    expect(matchAliases("The lecture covers linear algebra", index)).toHaveLength(0)
  })
})

describe("context extraction", () => {
  it("finds attendance vocabulary in both languages", () => {
    expect(extractContext("Ahmed, are you with us?", ["Ahmed"]).attendance.length).toBeGreaterThan(0)
    expect(extractContext("أحمد موجود؟", ["أحمد"]).attendance.length).toBeGreaterThan(0)
  })

  it("finds question vocabulary", () => {
    expect(extractContext("Ahmed, what do you think?", ["Ahmed"]).question.length).toBeGreaterThan(0)
    expect(extractContext("أحمد، جاوب على السؤال.", ["أحمد"]).question.length).toBeGreaterThan(0)
  })

  it("detects direct-address punctuation", () => {
    expect(extractContext("Ahmed?", ["Ahmed"]).directAddressPunctuation).toBe(true)
    expect(extractContext("Ahmed, can you explain?", ["Ahmed"]).directAddressPunctuation).toBe(true)
    expect(extractContext("أحمد؟", ["أحمد"]).directAddressPunctuation).toBe(true)
  })

  it("detects narrative context", () => {
    const ctx = extractContext("Ahmed discussed this issue yesterday.", ["Ahmed"])
    expect(ctx.narrative.length).toBeGreaterThan(0)
  })

  it("flags honorifics", () => {
    expect(extractContext("Mr Ahmed, can you answer?", ["Ahmed"]).honorific.length).toBeGreaterThan(0)
    expect(extractContext("أستاذ أحمد سامعنا؟", ["أحمد"]).honorific.length).toBeGreaterThan(0)
  })
})

describe("core acceptance: attendance calls", () => {
  it("classifies 'Ahmed Zaian, are you with us?' as a high-confidence attendance call", () => {
    const result = detect("Ahmed Zaian, are you with us?", index, high)
    expect(result.type).toBe("ATTENDANCE_CALL")
    expect(result.confidence).toBeGreaterThanOrEqual(SENSITIVITY_THRESHOLDS.high.critical)
    expect(result.alertRequired).toBe(true)
  })

  it("classifies a terse roll call", () => {
    const result = detect("Ahmed?", index, high)
    expect(result.type).toBe("ATTENDANCE_CALL")
    expect(result.alertRequired).toBe(true)
  })

  it("classifies the arabic attendance call", () => {
    const result = detect("أحمد زيان موجود؟", index, high)
    expect(result.type).toBe("ATTENDANCE_CALL")
    expect(result.alertRequired).toBe(true)
    expect(result.language).toBe("ar")
  })

  it("classifies arabic terse call", () => {
    expect(detect("أحمد؟", index, high).type).toBe("ATTENDANCE_CALL")
  })

  it("classifies honorific attendance check", () => {
    const result = detect("أستاذ أحمد سامعنا؟", index, high)
    expect(result.type).toBe("ATTENDANCE_CALL")
    expect(result.alertRequired).toBe(true)
  })
})

describe("core acceptance: direct questions", () => {
  it("detects an english direct question", () => {
    const result = detect("Ahmed, what do you think?", index, high)
    expect(result.type).toBe("DIRECT_QUESTION")
    expect(result.alertRequired).toBe(true)
  })

  it("detects an arabic direct question", () => {
    const result = detect("أحمد، جاوب على السؤال.", index, high)
    expect(result.type).toBe("DIRECT_QUESTION")
  })

  it("detects 'can you explain'", () => {
    expect(detect("Ahmed, can you explain?", index, high).type).toBe("DIRECT_QUESTION")
  })
})

describe("core acceptance: no false alarm on narrative mention", () => {
  it("does not raise a critical alarm for a past-tense mention", () => {
    const result = detect("Ahmed discussed this issue yesterday.", index, high)
    expect(["DIRECT_MENTION", "POSSIBLE_MENTION"]).toContain(result.type)
    expect(result.alertRequired).toBe(false)
  })

  it("does not alert on a long narrative sentence", () => {
    const result = detect(
      "Last week Ahmed presented his project about distributed systems and the class discussed it at length.",
      index,
      high,
    )
    expect(result.alertRequired).toBe(false)
  })

  it("returns no detection for general speech", () => {
    const result = detect("The next chapter covers gradient descent.", index, high)
    expect(result.type).toBe("GENERAL_SPEECH")
    expect(result.confidence).toBe(0)
  })
})

describe("sensitivity thresholds", () => {
  it("low sensitivity requires a stronger signal than high", () => {
    expect(SENSITIVITY_THRESHOLDS.low.critical).toBeGreaterThan(
      SENSITIVITY_THRESHOLDS.high.critical,
    )
  })

  it("routes ambiguous scores to semantic verification", () => {
    const result = detect("I think Ahmad had a point there", index, { sensitivity: "low" })
    expect(result.alertRequired).toBe(false)
  })
})

describe("learned weights", () => {
  it("lowers confidence for an alias marked unreliable", () => {
    const weighted = buildAliasIndex(profile, { ahmed: 0.5 })
    const strong = detect("Ahmed?", index, high)
    const weak = detect("Ahmed?", weighted, high)
    expect(weak.confidence).toBeLessThan(strong.confidence)
  })
})
