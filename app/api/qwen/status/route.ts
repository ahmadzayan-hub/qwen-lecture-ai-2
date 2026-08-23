import { noStore } from "@/lib/server/api"
import { pingQwen, readQwenConfig } from "@/lib/server/qwen"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Non-secret Qwen configuration summary + live credential check.
 * Powers the Settings screen. Reports only what actually succeeded.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const probe = url.searchParams.get("probe") === "1"

  const cfg = readQwenConfig()
  if (!cfg.ok) {
    return noStore({
      configured: false,
      missing: cfg.missing,
      provider: "Qwen",
      region: process.env.QWEN_REGION ?? "unset",
      asrModel: process.env.QWEN_ASR_MODEL ?? "unset",
      textModel: process.env.QWEN_TEXT_MODEL ?? "unset",
      workspaceConfigured: Boolean(process.env.QWEN_WORKSPACE_ID),
      probe: null,
    })
  }

  const summary = {
    configured: true,
    missing: [] as string[],
    provider: "Qwen",
    region: cfg.config.region,
    asrModel: cfg.config.asrModel,
    textModel: cfg.config.textModel,
    workspaceConfigured: Boolean(cfg.config.workspaceId),
  }

  if (!probe) return noStore({ ...summary, probe: null })

  const [text, asr] = await Promise.all([pingQwen("text"), pingQwen("asr")])
  return noStore({
    ...summary,
    probe: {
      checkedAt: new Date().toISOString(),
      text: { ok: text.ok, latencyMs: text.latencyMs, detail: text.detail, model: text.model },
      asr: { ok: asr.ok, latencyMs: asr.latencyMs, detail: asr.detail, model: asr.model },
    },
  })
}
