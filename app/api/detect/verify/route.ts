import { semanticVerdictSchema, verifyRequestSchema } from "@/lib/schemas"
import { errorResponse, handleRouteError, noStore, parseBody } from "@/lib/server/api"
import { clientKey, rateLimit } from "@/lib/server/rate-limit"
import { completeText, extractJson } from "@/lib/server/qwen"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SYSTEM_PROMPT = `You are the verification stage of a lecture attendance monitor.
A local detector found a possible mention of the student's name in a lecture transcript.
Decide whether the LECTURER IS DIRECTLY ADDRESSING THE STUDENT RIGHT NOW.

Rules:
- ATTENDANCE_CALL: the lecturer is checking presence or calling the student to respond now.
- DIRECT_QUESTION: the lecturer is asking this student a question now.
- DIRECT_MENTION: the student is addressed but no response is required.
- POSSIBLE_MENTION: the name appears but the student is discussed, not addressed.
- FALSE_POSITIVE: the match is not this student's name at all.
Set requiresAlert true ONLY for ATTENDANCE_CALL or DIRECT_QUESTION.
Handle Arabic and English equally. Past-tense or third-person references are NOT direct calls.
Reply with ONLY a JSON object, no prose, using exactly these keys:
{"eventType":"...","calledUser":true,"confidence":0.0,"requiresAlert":true,"reason":"..."}`

/**
 * Stage 2 semantic verification.
 * Only ambiguous, mid-confidence candidates reach this route — never every line.
 * The model returns a verdict; it never executes an action.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "verify"), 40, 60_000)
  if (!limit.allowed) {
    return errorResponse(429, "RATE_LIMITED", "Too many verification requests.", {
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }

  const parsed = await parseBody(request, verifyRequestSchema)
  if (!parsed.ok) return parsed.response

  const { phrase, aliasMatched, deterministicScore, previousContext, nextContext, language } =
    parsed.data

  try {
    const started = Date.now()
    const { text } = await completeText({
      jsonMode: true,
      maxTokens: 220,
      temperature: 0,
      timeoutMs: 8_000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Language: ${language}`,
            `Configured alias matched: ${aliasMatched}`,
            `Local detector score: ${deterministicScore.toFixed(2)}`,
            previousContext ? `Previous context: ${previousContext}` : "",
            `Candidate phrase: ${phrase}`,
            nextContext ? `Following context: ${nextContext}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    })

    const verdict = semanticVerdictSchema.safeParse(extractJson(text))
    if (!verdict.success) {
      // Fail closed: an unparseable verdict must not fabricate an alert.
      return noStore({
        verified: false,
        reason: "Model returned an invalid verdict; keeping local decision.",
        latencyMs: Date.now() - started,
      })
    }

    return noStore({
      verified: true,
      verdict: verdict.data,
      latencyMs: Date.now() - started,
    })
  } catch (error) {
    return handleRouteError(error, "detect/verify")
  }
}
