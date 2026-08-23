"use client"

import { AlertTriangle, Check, CircleDashed, RefreshCw, X } from "lucide-react"
import type { PreflightCheck, PreflightStatus } from "@/lib/types"
import { Button, Card, Kicker } from "@/components/ui/status"
import { cn } from "@/lib/utils"

const ICON: Record<PreflightStatus, React.ComponentType<{ className?: string }>> = {
  pass: Check,
  warn: AlertTriangle,
  fail: X,
  pending: CircleDashed,
}

const COLOR: Record<PreflightStatus, string> = {
  pass: "text-good",
  warn: "text-warn",
  fail: "text-destructive",
  pending: "text-muted-foreground",
}

export function PreflightPanel({
  checks,
  overall,
  running,
  onRerun,
}: {
  checks: PreflightCheck[]
  overall: "READY" | "DEGRADED" | "BLOCKED"
  running: boolean
  onRerun(): void
}) {
  const headline =
    overall === "READY"
      ? { text: "Ready", tone: "text-good", detail: "All critical checks passed." }
      : overall === "DEGRADED"
        ? { text: "Degraded", tone: "text-warn", detail: "Monitoring works, with limitations below." }
        : { text: "Blocked", tone: "text-destructive", detail: "A critical check failed — fix it before relying on Hader." }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <Kicker>Preflight</Kicker>
          <p className={cn("mt-1 text-lg font-bold", headline.tone)}>{headline.text}</p>
          <p className="text-[11px] text-muted-foreground">{headline.detail}</p>
        </div>
        <Button onClick={onRerun} disabled={running} aria-label="Re-run preflight checks">
          <RefreshCw className={cn("size-3.5", running && "animate-spin")} aria-hidden />
          {running ? "Checking" : "Re-run"}
        </Button>
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-border">
        {checks.map((item) => {
          const Icon = ICON[item.status]
          return (
            <li key={item.id} className="flex items-start gap-3 py-2.5">
              <Icon className={cn("mt-0.5 size-4 shrink-0", COLOR[item.status])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs font-semibold">
                  {item.label}
                  {item.critical && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                      Critical
                    </span>
                  )}
                </p>
                <p className="text-pretty text-[11px] leading-relaxed text-muted-foreground">{item.detail}</p>
                {item.fix && (
                  <p className="mt-1 text-pretty text-[11px] leading-relaxed text-warn">Fix: {item.fix}</p>
                )}
              </div>
              <span className="sr-only">{item.status}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
