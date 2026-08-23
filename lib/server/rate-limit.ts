import "server-only"

/**
 * In-memory sliding-window limiter.
 * Sufficient for single-user/per-instance protection of the Qwen proxy.
 * For multi-instance production, back this with Upstash Redis.
 */

type Bucket = { hits: number[] }

const buckets = new Map<string, Bucket>()
const MAX_KEYS = 5_000

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const cutoff = now - windowMs

  if (buckets.size > MAX_KEYS) buckets.clear()

  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => t > cutoff)

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket)
    const oldest = bucket.hits[0] ?? now
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    }
  }

  bucket.hits.push(now)
  buckets.set(key, bucket)
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 }
}

/** Best-effort client identity for limiting. Not used for authorization. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = forwarded || request.headers.get("x-real-ip") || "local"
  return `${scope}:${ip}`
}
