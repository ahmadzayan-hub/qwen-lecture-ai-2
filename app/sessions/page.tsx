"use client"

import { useState } from "react"
import { Download, Trash2 } from "lucide-react"
import { useHistory } from "@/lib/history"
import { EventLog } from "@/components/live/event-log"
import { Button, Card, DemoBadge, Kicker } from "@/components/ui/status"
import { formatClock, formatElapsed } from "@/lib/utils"

export default function SessionsPage() {
  const history = useHistory()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>Sessions</Kicker>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Lecture history</h1>
          <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
            Stored on this device only. Detection events and counters are kept; audio never is.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={history.exportAll} disabled={!history.sessions.length}>
            <Download className="size-3.5" aria-hidden />
            Export JSON
          </Button>
          <Button variant="danger" onClick={history.clearAll} disabled={!history.sessions.length}>
            <Trash2 className="size-3.5" aria-hidden />
            Clear all
          </Button>
        </div>
      </header>

      {history.sessions.length === 0 ? (
        <Card>
          <p className="text-pretty text-[11px] leading-relaxed text-muted-foreground">
            No sessions recorded yet. Start monitoring from the Live screen — even a simulated run is
            archived here so you can review how fast you responded.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Sessions", value: String(history.stats.sessions) },
              { label: "Confirmed calls", value: String(history.stats.confirmed) },
              { label: "False alarms", value: String(history.stats.falseAlarms) },
              {
                label: "Avg response",
                value:
                  history.stats.avgConfirmationMs !== null
                    ? `${(history.stats.avgConfirmationMs / 1000).toFixed(1)}s`
                    : "—",
              },
            ].map((stat) => (
              <Card key={stat.label} className="flex flex-col gap-1">
                <Kicker>{stat.label}</Kicker>
                <p className="nums text-xl font-bold">{stat.value}</p>
              </Card>
            ))}
          </div>

          <ul className="flex flex-col gap-3">
            {history.sessions.map((item) => {
              const expanded = open === item.sessionId
              return (
                <li key={item.sessionId}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-bold">
                          {item.course}
                          {item.isDemo && <DemoBadge />}
                        </p>
                        <p className="nums text-[11px] text-muted-foreground">
                          {new Date(item.startedAt).toLocaleDateString()} · {formatClock(item.startedAt)} ·{" "}
                          {formatElapsed(item.durationMs)}
                        </p>
                      </div>
                      <dl className="flex gap-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <div>
                          <dt>Events</dt>
                          <dd className="nums text-sm font-bold text-foreground">{item.totalDetections}</dd>
                        </div>
                        <div>
                          <dt>Confirmed</dt>
                          <dd className="nums text-sm font-bold text-good">{item.confirmedCalls}</dd>
                        </div>
                        <div>
                          <dt>False</dt>
                          <dd className="nums text-sm font-bold text-warn">{item.falseAlarms}</dd>
                        </div>
                      </dl>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setOpen(expanded ? null : item.sessionId)}
                          aria-expanded={expanded}
                        >
                          {expanded ? "Hide" : "Details"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => history.removeSession(item.sessionId)}
                          aria-label={`Delete session ${item.course}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3">
                        <EventLog events={item.events} />
                      </div>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
