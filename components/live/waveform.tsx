"use client"

/**
 * Audio level meter.
 *
 * This is a real signal indicator, not decoration: if the bars are flat while
 * the session claims to be listening, the user is looking at a dead audio
 * track and needs to know immediately.
 */

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

const BARS = 40

export function Waveform({ level, active }: { level: number; active: boolean }) {
  const history = useRef<number[]>(new Array(BARS).fill(0))
  const frame = useRef<number>(0)
  const rootRef = useRef<HTMLDivElement>(null)

  // Push samples into a scrolling buffer and write heights directly to the DOM.
  // Doing this via React state would re-render the whole tree ~20x/second and
  // steal time from the detection pipeline, which is the priority.
  useEffect(() => {
    let mounted = true
    const render = () => {
      if (!mounted) return
      history.current.push(active ? level : 0)
      if (history.current.length > BARS) history.current.shift()
      const root = rootRef.current
      if (root) {
        const bars = root.children
        for (let i = 0; i < bars.length; i += 1) {
          const value = history.current[i] ?? 0
          const height = Math.max(3, Math.min(100, value * 140))
          ;(bars[i] as HTMLElement).style.height = `${height}%`
        }
      }
      frame.current = window.setTimeout(render, 55)
    }
    render()
    return () => {
      mounted = false
      window.clearTimeout(frame.current)
    }
  }, [level, active])

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="flex h-16 items-end justify-between gap-[2px] overflow-hidden rounded-lg border border-border bg-secondary/30 px-2 py-1.5"
    >
      {Array.from({ length: BARS }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-full min-w-[2px] rounded-full transition-[height] duration-100 ease-out",
            active ? "bg-primary" : "bg-muted-foreground/30",
          )}
          style={{ height: "3%" }}
        />
      ))}
    </div>
  )
}

export function LevelReadout({ level, active }: { level: number; active: boolean }) {
  if (!active) return <span className="nums text-muted-foreground">—</span>
  const pct = Math.round(Math.min(1, level * 2) * 100)
  return (
    <span className={cn("nums font-semibold", pct < 4 ? "text-warn" : "text-good")}>
      {pct}%{pct < 4 ? " · no signal" : ""}
    </span>
  )
}
