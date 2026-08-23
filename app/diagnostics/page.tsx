"use client"

/**
 * Diagnostics.
 *
 * Reports what the app can actually verify right now. Anything unverified is
 * labelled unverified rather than shown as a green tick.
 */

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { useHader } from "@/components/providers/hader-provider"
import { usePreflight } from "@/lib/session/use-preflight"
import { PreflightPanel } from "@/components/live/preflight-panel"
import { Button, Card, Dot, Kicker } from "@/components/ui/status"
import type { HealthReport } from "@/lib/types"
import { cn } from "@/lib/utils"

type QwenStatus = {
  configured: boolean
  missing: string[]
  provider: string
  region: string
  asrModel: string
  textModel: string
  workspaceConfigured: boolean
  probe: null | {
    checkedAt: string
    text?: { ok: boolean; detail: string }
    asr?: { ok: boolean; detail: string }
  }
}

export default function DiagnosticsPage() {
  const { session, profile, preferences } = useHader()
  const [health, setHealth] = useState<HealthReport | null>(null)
  const [qwen, setQwen] = useState<QwenStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const preflight = usePreflight({
    profile,
    audioLevel: session.audioLevel,
    audioActive: session.state === "LISTENING",
    peersOnline: session.peers.filter((p) => p.online).length,
    soundEnabled: preferences.soundEnabled,
    vibrationEnabled: preferences.vibrationEnabled,
  })

  const load = useCallback(async (probe: boolean) => {
    setBusy(true)
    try {
      const [h, q] = await Promise.all([
        fetch("/api/health", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/qwen/status${probe ? "?probe=1" : ""}`, { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null,
        ),
      ])
      setHealth(h)
      setQwen(q)
    } catch {
      setHealth(null)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void load(false)
  }, [load])

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>Diagnostics</Kicker>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">System status</h1>
          <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
            Live probes only. A green dot here means the check succeeded just now.
          </p>
        </div>
        <Button variant="primary" onClick={() => load(true)} disabled={busy}>
          <RefreshCw className={cn("size-3.5", busy && "animate-spin")} aria-hidden />
          {busy ? "Probing" : "Probe services"}
        </Button>
      </header>

      {/* Services */}
      <Card>
        <Kicker>Services</Kicker>
        {!health ? (
          <p className="mt-3 text-[11px] text-muted-foreground">Health endpoint unreachable.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {Object.entries(health.services).map(([name, service]) => (
              <li key={name} className="flex items-start gap-3 py-2.5">
                <span className="mt-1">
                  <Dot
                    tone={service.status === "healthy" ? "good" : service.status === "degraded" ? "warn" : "critical"}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold capitalize">{name}</p>
                  <p className="text-pretty text-[11px] leading-relaxed text-muted-foreground">
                    {service.detail}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {service.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Qwen config */}
      <Card>
        <Kicker>Qwen configuration</Kicker>
        {!qwen ? (
          <p className="mt-3 text-[11px] text-muted-foreground">Status endpoint unreachable.</p>
        ) : (
          <>
            <p
              className={cn(
                "mt-2 text-xs font-bold",
                qwen.configured ? "text-good" : "text-warn",
              )}
            >
              {qwen.configured ? "Credentials present" : `Missing: ${qwen.missing.join(", ") || "API key"}`}
            </p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ["Provider", qwen.provider],
                ["Region", qwen.region],
                ["ASR model", qwen.asrModel],
                ["Text model", qwen.textModel],
                ["Workspace", qwen.workspaceConfigured ? "configured" : "not set"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 break-all font-mono text-[11px]">{value}</dd>
                </div>
              ))}
            </dl>

            {qwen.probe ? (
              <ul className="mt-3 flex flex-col gap-1.5">
                {(["text", "asr"] as const).map((key) => {
                  const result = qwen.probe?.[key]
                  if (!result) return null
                  return (
                    <li key={key} className="flex items-start gap-2 text-[11px]">
                      <span className="mt-1">
                        <Dot tone={result.ok ? "good" : "critical"} />
                      </span>
                      <span className="text-muted-foreground">
                        <span className="font-semibold uppercase text-foreground">{key}</span> — {result.detail}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Not probed yet — press “Probe services” to make a real call.
              </p>
            )}

            {!qwen.configured && (
              <p className="mt-3 text-pretty text-[11px] leading-relaxed text-warn">
                Without credentials, Hader falls back to the browser speech engine and local detection.
                Arabic accuracy drops noticeably; detection still works.
              </p>
            )}
          </>
        )}
      </Card>

      <PreflightPanel
        checks={preflight.checks}
        overall={preflight.overall}
        running={preflight.running}
        onRerun={preflight.run}
      />

      {/* Runtime */}
      <Card>
        <Kicker>Runtime</Kicker>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ["Session state", session.state],
            ["ASR engine", session.asrEngineLabel],
            ["ASR status", session.asrStatus],
            ["Transport", `${session.transport} · ${session.transportState}`],
            ["Room", session.room],
            ["Segments in memory", String(session.segments.length)],
            ["Detections", String(session.events.length)],
            ["Demo output", session.isDemo ? "yes" : "no"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 break-all font-mono text-[11px]">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}
