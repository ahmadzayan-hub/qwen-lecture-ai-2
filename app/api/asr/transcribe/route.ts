import { transcribeRequestSchema } from "@/lib/schemas"
import { errorResponse, handleRouteError, noStore, parseBody } from "@/lib/server/api"
import { clientKey, rateLimit } from "@/lib/server/rate-limit"
import { transcribeChunk } from "@/lib/server/qwen"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Chunked transcription proxy.
 * The browser posts short audio chunks; the API key never leaves the server.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "asr"), 90, 60_000)
  if (!limit.allowed) {
    return errorResponse(429, "RATE_LIMITED", "Too many transcription requests.", {
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }

  const parsed = await parseBody(request, transcribeRequestSchema)
  if (!parsed.ok) return parsed.response

  try {
    const started = Date.now()
    const { text, model } = await transcribeChunk({
      audioBase64: parsed.data.audio,
      mimeType: parsed.data.mimeType,
      language: parsed.data.language,
    })
    return noStore({
      text,
      model,
      engine: "qwen-chunked" as const,
      latencyMs: Date.now() - started,
    })
  } catch (error) {
    return handleRouteError(error, "asr/transcribe")
  }
}
