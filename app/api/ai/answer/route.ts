import { answerRequestSchema, answerSchema } from "@/lib/schemas"
import { errorResponse, handleRouteError, noStore, parseBody } from "@/lib/server/api"
import { clientKey, rateLimit } from "@/lib/server/rate-limit"
import { completeText, extractJson } from "@/lib/server/qwen"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SYSTEM_PROMPT = `You help a student answer a question their lecturer just asked them.
Ground every claim in the supplied lecture context. Do NOT invent lecture content,
figures or citations. If the context does not cover the question, set grounded=false
and give a short honest answer the student can safely say.
Match the question's language. Keep "short" speakable in about 15 seconds and
"extended" in about 30 seconds.
Reply with ONLY JSON: {"short":"","extended":"","keyPoints":[],"grounded":true}`

/** "Help me answer" — small, contextual request. Never sends the full lecture. */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "answer"), 20, 60_000)
  if (!limit.allowed) {
    return errorResponse(429, "RATE_LIMITED", "Too many answer requests.", {
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }

  const parsed = await parseBody(request, answerRequestSchema)
  if (!parsed.ok) return parsed.response

  try {
    const started = Date.now()
    const { text } = await completeText({
      jsonMode: true,
      maxTokens: 600,
      temperature: 0.3,
      timeoutMs: 20_000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Language: ${parsed.data.language}\nRecent lecture context:\n${
            parsed.data.context || "(no context captured)"
          }\n\nQuestion asked: ${parsed.data.question}`,
        },
      ],
    })

    const draft = answerSchema.safeParse(extractJson(text))
    if (!draft.success) {
      return errorResponse(502, "INVALID_MODEL_OUTPUT", "The model returned an unusable answer.")
    }
    return noStore({ ...draft.data, latencyMs: Date.now() - started })
  } catch (error) {
    return handleRouteError(error, "ai/answer")
  }
}
