"use client"

/**
 * Settings.
 *
 * The alias editor is the single most important control in the product: the
 * detector can only match name forms that exist here, so the UI actively
 * nudges the user towards Arabic spellings and likely ASR mishearings.
 */

import { useState } from "react"
import { Bell, Plus, ShieldCheck, Volume2, X } from "lucide-react"
import { useHader } from "@/components/providers/hader-provider"
import { useHistory } from "@/lib/history"
import { Button, Card, Kicker } from "@/components/ui/status"
import { QUICK_RESPONSES } from "@/lib/defaults"
import type { Sensitivity } from "@/lib/types"
import { cn } from "@/lib/utils"

const SENSITIVITY: { id: Sensitivity; label: string; detail: string }[] = [
  { id: "low", label: "Low", detail: "Only near-exact matches. Fewest false alarms, highest chance of a miss." },
  { id: "balanced", label: "Balanced", detail: "Requires a clear name match plus lecture context." },
  { id: "high", label: "High", detail: "Alerts on weaker matches. Recommended — a false alarm costs 2 seconds, a miss costs attendance." },
]

export default function SettingsPage() {
  const { profile, setProfile, preferences, setPreferences, lecture, setLecture } = useHader()
  const history = useHistory()
  const [alias, setAlias] = useState("")
  const [arabicAlias, setArabicAlias] = useState("")

  const aliasCount =
    (profile.fullName ? 1 : 0) + (profile.firstName ? 1 : 0) + profile.aliases.length + profile.arabicAliases.length

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Kicker>Settings</Kicker>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Identity and alerts</h1>
        <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
          Everything on this page is stored on this device only.
        </p>
      </header>

      {/* Identity */}
      <Card>
        <Kicker>Your name</Kicker>
        <p className="mt-1 text-pretty text-[11px] leading-relaxed text-muted-foreground">
          Detection matches only the forms listed here. {aliasCount < 3 && (
            <span className="font-semibold text-warn">
              Add at least three forms — one Arabic spelling and one common mishearing.
            </span>
          )}
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field
            label="Full name"
            value={profile.fullName}
            onChange={(value) => setProfile({ ...profile, fullName: value })}
            placeholder="Ahmed Zayan"
          />
          <Field
            label="First name"
            value={profile.firstName}
            onChange={(value) => setProfile({ ...profile, firstName: value })}
            placeholder="Ahmed"
          />
          <Field
            label="Surname"
            value={profile.surname}
            onChange={(value) => setProfile({ ...profile, surname: value })}
            placeholder="Zayan"
          />
        </div>

        <AliasEditor
          label="Latin aliases and mishearings"
          hint="Nicknames, transliterations, and how speech recognition mangles your name (e.g. “Ahmad”, “Amed”)."
          items={profile.aliases}
          draft={alias}
          setDraft={setAlias}
          onAdd={(value) => setProfile({ ...profile, aliases: [...profile.aliases, value] })}
          onRemove={(value) =>
            setProfile({ ...profile, aliases: profile.aliases.filter((a) => a !== value) })
          }
        />

        <AliasEditor
          label="Arabic aliases"
          hint="Arabic spellings, with and without diacritics."
          dir="rtl"
          items={profile.arabicAliases}
          draft={arabicAlias}
          setDraft={setArabicAlias}
          onAdd={(value) => setProfile({ ...profile, arabicAliases: [...profile.arabicAliases, value] })}
          onRemove={(value) =>
            setProfile({ ...profile, arabicAliases: profile.arabicAliases.filter((a) => a !== value) })
          }
        />
      </Card>

      {/* Lecture */}
      <Card>
        <Kicker>Lecture</Kicker>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field
            label="Course"
            value={lecture.course}
            onChange={(value) => setLecture({ ...lecture, course: value })}
            placeholder="Machine Learning 301"
          />
          <Field
            label="Lecturer"
            value={lecture.lecturer}
            onChange={(value) => setLecture({ ...lecture, lecturer: value })}
            placeholder="Dr. Salem"
          />
        </div>

        <div className="mt-3">
          <Kicker>Lecture language</Kicker>
          <div className="mt-2 flex gap-2">
            {(["ar", "en", "both"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLecture({ ...lecture, language: value })}
                className={cn(
                  "min-h-11 flex-1 rounded-lg border px-3 text-xs font-semibold",
                  lecture.language === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-secondary",
                )}
              >
                {value === "ar" ? "Arabic" : value === "en" ? "English" : "Both"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <Kicker>Reply you will send</Kicker>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Offered as a copyable reply after you acknowledge. Hader never sends it for you.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_RESPONSES.map((item) => (
              <button
                key={item.id}
                type="button"
                dir="auto"
                onClick={() => setLecture({ ...lecture, responsePhrase: item.text })}
                className={cn(
                  "min-h-11 rounded-lg border px-3 text-xs font-semibold",
                  lecture.responsePhrase === item.text
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-secondary",
                )}
              >
                {item.text}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Detection */}
      <Card>
        <Kicker>Detection sensitivity</Kicker>
        <div className="mt-2 flex flex-col gap-2">
          {SENSITIVITY.map((option) => (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                preferences.sensitivity === option.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-secondary/50",
              )}
            >
              <input
                type="radio"
                name="sensitivity"
                checked={preferences.sensitivity === option.id}
                onChange={() => setPreferences({ ...preferences, sensitivity: option.id })}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span>
                <span className="text-xs font-bold">{option.label}</span>
                <span className="mt-0.5 block text-pretty text-[11px] leading-relaxed text-muted-foreground">
                  {option.detail}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      {/* Alerts */}
      <Card>
        <Kicker>Alerts</Kicker>
        <div className="mt-2 flex flex-col divide-y divide-border">
          <Toggle
            icon={Volume2}
            label="Alarm sound"
            detail="Required — a silent alarm defeats the purpose."
            checked={preferences.soundEnabled}
            onChange={(checked) => setPreferences({ ...preferences, soundEnabled: checked })}
          />
          <Toggle
            icon={Bell}
            label="Vibration"
            detail="Mobile only. Ignored where unsupported."
            checked={preferences.vibrationEnabled}
            onChange={(checked) => setPreferences({ ...preferences, vibrationEnabled: checked })}
          />
          <Toggle
            icon={Bell}
            label="Escalate automatically"
            detail="Steps up the alarm and pushes to paired devices after 15 seconds."
            checked={preferences.autoEscalate}
            onChange={(checked) => setPreferences({ ...preferences, autoEscalate: checked })}
          />
          <Toggle
            icon={ShieldCheck}
            label="Keep transcripts on this device"
            detail="Off by default. When off, transcripts exist only in memory during the session."
            checked={preferences.storeTranscripts}
            onChange={(checked) => setPreferences({ ...preferences, storeTranscripts: checked })}
          />
          <Toggle
            icon={ShieldCheck}
            label="Privacy mode"
            detail="Sends only short windows around a candidate match to the cloud, never continuous audio."
            checked={preferences.privacyMode}
            onChange={(checked) => setPreferences({ ...preferences, privacyMode: checked })}
          />
        </div>

        <div className="mt-4">
          <Kicker>Notification permission</Kicker>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              onClick={async () => {
                if (typeof Notification === "undefined") return
                await Notification.requestPermission()
              }}
            >
              Request notifications
            </Button>
            <Button
              onClick={async () => {
                const ok = await session_primeAudio()
                if (!ok) return
              }}
            >
              Test alarm audio
            </Button>
          </div>
        </div>
      </Card>

      {/* Data */}
      <Card>
        <Kicker>Your data</Kicker>
        <p className="mt-1 text-pretty text-[11px] leading-relaxed text-muted-foreground">
          {history.stats.sessions} session{history.stats.sessions === 1 ? "" : "s"} stored locally. No
          audio is ever written to disk or uploaded.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={history.exportAll}>Export everything</Button>
          <Button variant="danger" onClick={history.clearAll}>
            Delete all sessions
          </Button>
        </div>
      </Card>
    </div>
  )
}

/** Primes the audio element so the first real alarm is not blocked by autoplay. */
async function session_primeAudio(): Promise<boolean> {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    await ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
    setTimeout(() => void ctx.close(), 800)
    return true
  } catch {
    return false
  }
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange(value: string): void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value}
        dir="auto"
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-border bg-secondary/40 px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      />
    </label>
  )
}

function AliasEditor({
  label,
  hint,
  items,
  draft,
  setDraft,
  onAdd,
  onRemove,
  dir,
}: {
  label: string
  hint: string
  items: string[]
  draft: string
  setDraft(value: string): void
  onAdd(value: string): void
  onRemove(value: string): void
  dir?: "rtl" | "ltr"
}) {
  return (
    <div className="mt-4">
      <Kicker>{label}</Kicker>
      <p className="mt-1 text-pretty text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const value = draft.trim()
          if (!value || items.includes(value)) return
          onAdd(value)
          setDraft("")
        }}
      >
        <input
          value={draft}
          dir={dir ?? "auto"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Don't submit mid-IME composition (Arabic/CJK keyboards).
            if (event.nativeEvent.isComposing || event.keyCode === 229) event.stopPropagation()
          }}
          placeholder={dir === "rtl" ? "أحمد" : "Ahmad"}
          aria-label={`Add to ${label}`}
          className="min-h-11 flex-1 rounded-lg border border-border bg-secondary/40 px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        />
        <Button type="submit">
          <Plus className="size-3.5" aria-hidden />
          Add
        </Button>
      </form>
      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item}>
              <button
                type="button"
                onClick={() => onRemove(item)}
                dir="auto"
                className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 text-[11px] font-medium hover:border-destructive/50 hover:text-destructive"
                aria-label={`Remove ${item}`}
              >
                {item}
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Toggle({
  icon: Icon,
  label,
  detail,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  detail: string
  checked: boolean
  onChange(checked: boolean): void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="text-xs font-semibold">{label}</span>
        <span className="mt-0.5 block text-pretty text-[11px] leading-relaxed text-muted-foreground">
          {detail}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
      />
    </label>
  )
}
