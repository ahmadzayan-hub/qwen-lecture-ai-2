"use client"

/**
 * Rolling transcript.
 *
 * Bidirectional by line: each segment gets its own dir/lang from its dominant
 * script, so Arabic renders RTL and English LTR inside the same list without
 * ever reversing strings by hand.
 */

import { useEffect, useRef } from "react"
import { cn, dirFor, formatPercent, scriptOf } from "@/lib/utils"
import { DemoBadge, Kicker } from "@/components/ui/status"
import type { TranscriptSegment } from "@/lib/types"

export function Transcript({
  segments,
  emptyHint,
}: {
  segments: TranscriptSegment[]
  emptyHint: string
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  // Follow the tail only while the user is already at the bottom, so scrolling
  // back to re-read something isn't yanked away mid-lecture.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const onScroll = () => {
      pinned.current = list.scrollHeight - list.scrollTop - list.clientHeight < 60
    }
    list.addEventListener("scroll", onScroll, { passive: true })
    return () => list.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (pinned.current) endRef.current?.scrollIntoView({ block: "end" })
  }, [segments])

  if (segments.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
        <p className="max-w-xs text-pretty text-xs leading-relaxed text-muted-foreground">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      className="max-h-[46vh] min-h-40 overflow-y-auto lg:max-h-[52vh]"
      role="log"
      aria-live="polite"
      aria-label="Live lecture transcript"
    >
      <ul className="flex flex-col">
        {segments.map((segment) => {
          const detection = segment.detection
          const alerted = detection?.alertRequired
          const script = scriptOf(segment.text)

          return (
            <li
              key={segment.id}
              className={cn(
                "border-b border-border/60 px-2 py-2.5 last:border-0",
                alerted && "-mx-1 rounded-md border-l-2 border-l-destructive bg-destructive/10 px-3",
                !alerted && detection && "-mx-1 rounded-md border-l-2 border-l-warn/60 bg-warn/5 px-3",
                !segment.isFinal && "opacity-60",
              )}
            >
              <div className="flex items-start gap-2.5">
                <time className="nums mt-0.5 shrink-0 text-[10px] text-muted-foreground">
                  {new Date(segment.receivedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                <p
                  dir={dirFor(segment.text)}
                  lang={script === "ar" ? "ar" : undefined}
                  className="min-w-0 flex-1 text-pretty text-[13px] font-medium leading-relaxed"
                >
                  {segment.text}
                  {!segment.isFinal && <span className="ml-1 text-muted-foreground">…</span>}
                </p>
                {segment.isDemo && <DemoBadge className="mt-0.5 shrink-0" />}
              </div>

              {detection && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[3.75rem] text-[10px] font-semibold">
                  <span className={alerted ? "text-destructive" : "text-warn"}>
                    {detection.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-muted-foreground">
                    matched &ldquo;{detection.alias}&rdquo; · {formatPercent(detection.confidence)}
                  </span>
                </p>
              )}
            </li>
          )
        })}
      </ul>
      <div ref={endRef} />
    </div>
  )
}

export function TranscriptHeader({
  engineLabel,
  count,
  windowSeconds,
}: {
  engineLabel: string
  count: number
  windowSeconds: number
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <Kicker>Live transcript</Kicker>
        <p className="mt-1 text-sm font-bold">{engineLabel}</p>
      </div>
      <p className="nums text-[10px] text-muted-foreground">
        {count} lines · {windowSeconds}s rolling window
      </p>
    </div>
  )
}
