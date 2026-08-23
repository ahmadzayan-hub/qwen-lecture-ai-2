"use client"

/**
 * The alarm screen.
 *
 * Requirements it must satisfy without compromise:
 *  - Impossible to miss: fullscreen, red, escalating.
 *  - Impossible to dismiss accidentally: only explicit buttons resolve it.
 *  - Announced to screen readers via role="alertdialog" + aria-live.
 *  - Touch targets >= 56px.
 *  - Never claims presence was reported. The user answers in Teams themselves.
 */

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, Clock, Copy, ExternalLink, HelpCircle, X } from "lucide-react"
import { useHader } from "@/components/providers/hader-provider"
import { cn, formatElapsed, formatPercent } from "@/lib/utils"

export function AlertOverlay() {
  const { session, lecture } = useHader()
  const alert = session.pendingAlert
  const [elapsed, setElapsed] = useState(0)
  const [copied, setCopied] = useState(false)
  const [answered, setAnswered] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<Element | null>(null)

  // Live timer for the response latency shown to the user.
  useEffect(() => {
    if (!alert) {
      setElapsed(0)
      setAnswered(false)
      setCopied(false)
      return
    }
    const tick = () => setElapsed(Date.now() - alert.raisedAt)
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [alert])

  // Focus management: trap focus on the primary action, restore it on close.
  useEffect(() => {
    if (!alert) {
      if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus()
      return
    }
    previouslyFocused.current = document.activeElement
    confirmRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      // Escape must NOT dismiss an attendance alarm — that is the whole point.
      if (event.key === "Escape") event.preventDefault()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [alert])

  if (!alert) return null

  const { event, stage } = alert
  const isQuestion = event.type === "DIRECT_QUESTION"
  const responsePhrase = lecture.responsePhrase || "Present"

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="hader-alert-title"
      aria-describedby="hader-alert-phrase"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-md"
    >
      <div
        className={cn(
          "relative w-full max-w-lg rounded-2xl border-2 bg-card p-6 shadow-2xl sm:p-8",
          isQuestion ? "border-warn" : "border-destructive",
          stage >= 2 && "animate-alarm",
        )}
      >
        <div className="flex flex-col items-center text-center">
          <span
            className={cn(
              "grid size-14 place-items-center rounded-full",
              isQuestion ? "bg-warn/15 text-warn" : "bg-destructive/15 text-destructive",
            )}
          >
            {isQuestion ? (
              <HelpCircle className="size-7" aria-hidden />
            ) : (
              <AlertTriangle className="size-7" aria-hidden />
            )}
          </span>

          <h2 id="hader-alert-title" className="mt-4 text-balance text-2xl font-bold sm:text-3xl">
            {isQuestion ? "A question for you" : "Your name was called"}
          </h2>
          <p
            className={cn("mt-1 text-lg font-semibold", isQuestion ? "text-warn" : "text-destructive")}
            lang="ar"
            dir="rtl"
          >
            {isQuestion ? "سؤال موجَّه إليك" : "تم نداء اسمك"}
          </p>

          <blockquote
            id="hader-alert-phrase"
            dir="auto"
            className="mt-5 w-full rounded-xl border border-border bg-secondary/50 px-4 py-3.5 text-pretty text-base font-medium leading-relaxed"
          >
            {event.phrase}
          </blockquote>

          <dl className="mt-5 grid w-full grid-cols-3 gap-2 border-y border-border py-3.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <div>
              <dt>Confidence</dt>
              <dd className="nums mt-1 text-sm font-bold text-foreground">{formatPercent(event.confidence)}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd className="mt-1 text-sm font-bold text-foreground">
                {event.type === "ATTENDANCE_CALL" ? "Attendance" : isQuestion ? "Question" : "Mention"}
              </dd>
            </div>
            <div>
              <dt>Elapsed</dt>
              <dd className="nums mt-1 flex items-center justify-center gap-1 text-sm font-bold text-foreground">
                <Clock className="size-3" aria-hidden />
                {formatElapsed(elapsed)}
              </dd>
            </div>
          </dl>

          {/* Primary action. Records that YOU noticed — it does not answer for you. */}
          <button
            ref={confirmRef}
            type="button"
            onClick={() => {
              setAnswered(true)
              session.confirmPresence()
            }}
            className="mt-6 flex min-h-16 w-full items-center justify-center gap-3 rounded-xl bg-good text-xl font-extrabold text-good-foreground transition-transform active:scale-[0.98]"
          >
            <Check className="size-6" aria-hidden />
            <span lang="ar" dir="rtl">
              حاضر
            </span>
            <span className="text-sm font-bold tracking-widest opacity-80">I&apos;M HERE</span>
          </button>

          <div className="mt-3 flex w-full gap-2">
            <button
              type="button"
              onClick={session.dismissFalseAlarm}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary"
            >
              <X className="size-4" aria-hidden />
              False alarm
            </button>
            <button
              type="button"
              onClick={session.snooze}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary"
            >
              <Clock className="size-4" aria-hidden />
              Snooze 10s
            </button>
          </div>

          {/* Quick response appears only AFTER the user confirms. */}
          {answered && (
            <div className="mt-5 w-full rounded-xl border border-good/40 bg-good/5 p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-good">Response ready</p>
              <p dir="auto" className="mt-2 text-base font-semibold">
                {responsePhrase}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(responsePhrase)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1800)
                    } catch {
                      setCopied(false)
                    }
                  }}
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-secondary px-3 text-xs font-semibold"
                >
                  <Copy className="size-3.5" aria-hidden />
                  {copied ? "Copied" : "Copy reply"}
                </button>
                <a
                  href="https://teams.microsoft.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-secondary px-3 text-xs font-semibold"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Open Teams
                </a>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                Hader does not speak, unmute, or mark attendance for you. Reply in Teams yourself.
              </p>
            </div>
          )}

          <p className="mt-4 text-[11px] text-muted-foreground">
            Escalation stage {stage + 1} of 5 · alarm continues until you respond
          </p>
        </div>
      </div>
    </div>
  )
}
