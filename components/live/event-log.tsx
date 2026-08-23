"use client"

import { BellRing, Check, HelpCircle, MessageSquare, X } from "lucide-react"
import type { DetectionEvent } from "@/lib/types"
import { Card, Kicker } from "@/components/ui/status"
import { cn, formatClock, formatPercent } from "@/lib/utils"

const META: Record<
  DetectionEvent["type"],
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  ATTENDANCE_CALL: { label: "Attendance call", icon: BellRing, tone: "text-destructive" },
  DIRECT_QUESTION: { label: "Direct question", icon: HelpCircle, tone: "text-warn" },
  DIRECT_MENTION: { label: "Mention", icon: MessageSquare, tone: "text-primary" },
  POSSIBLE_MENTION: { label: "Possible mention", icon: MessageSquare, tone: "text-muted-foreground" },
  GENERAL_SPEECH: { label: "Speech", icon: MessageSquare, tone: "text-muted-foreground" },
  FALSE_POSITIVE: { label: "Filtered", icon: X, tone: "text-muted-foreground" },
}

export function EventLog({ events }: { events: DetectionEvent[] }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <Kicker>Session timeline</Kicker>
        <span className="nums text-[11px] text-muted-foreground">{events.length} events</span>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 text-pretty text-[11px] leading-relaxed text-muted-foreground">
          Detections appear here with confidence and your response time. Mentions are logged without
          raising the alarm.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {events
            .slice()
            .reverse()
            .map((event) => {
              const meta = META[event.type]
              return (
                <li key={event.id} className="flex items-start gap-3 py-2.5">
                  <meta.icon className={cn("mt-0.5 size-4 shrink-0", meta.tone)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-[11px]">
                      <span className="font-semibold">{meta.label}</span>
                      <span className="nums text-muted-foreground">{formatPercent(event.confidence)}</span>
                      <span className="nums text-muted-foreground">{formatClock(event.timestamp)}</span>
                      {event.confirmed && (
                        <span className="flex items-center gap-1 font-semibold text-good">
                          <Check className="size-3" aria-hidden />
                          {event.confirmationLatencyMs !== undefined
                            ? `${(event.confirmationLatencyMs / 1000).toFixed(1)}s`
                            : "confirmed"}
                        </span>
                      )}
                      {event.falseAlarm && <span className="font-semibold text-warn">false alarm</span>}
                    </p>
                    <p dir="auto" className="mt-0.5 truncate text-xs">
                      {event.phrase}
                    </p>
                  </div>
                </li>
              )
            })}
        </ul>
      )}
    </Card>
  )
}
