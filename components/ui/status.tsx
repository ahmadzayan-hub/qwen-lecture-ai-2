import { cn } from "@/lib/utils"

export type Tone = "neutral" | "good" | "warn" | "critical"

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  good: "text-good",
  warn: "text-warn",
  critical: "text-destructive",
}

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  good: "bg-good",
  warn: "bg-warn",
  critical: "bg-destructive",
}

export function Dot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  return (
    <span className="relative grid size-2 place-items-center" aria-hidden>
      <span className={cn("size-2 rounded-full", TONE_DOT[tone])} />
      {pulse && <span className={cn("absolute size-2 rounded-full animate-ping-slow", TONE_DOT[tone])} />}
    </span>
  )
}

export function Card({
  children,
  className,
  ...rest
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-card p-4 sm:p-5", className)}
      {...rest}
    >
      {children}
    </section>
  )
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground", className)}>
      {children}
    </p>
  )
}

/**
 * A single status readout. `detail` is required because a status light with no
 * explanation is exactly the kind of thing that lies to the user.
 */
export function StatusCard({
  label,
  value,
  detail,
  tone,
  pulse,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  tone: Tone
  pulse?: boolean
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        <Kicker>{label}</Kicker>
        <span className="ml-auto">
          <Dot tone={tone} pulse={pulse} />
        </span>
      </div>
      <p className={cn("text-sm font-bold", TONE_TEXT[tone])}>{value}</p>
      <p className="text-[11px] leading-snug text-muted-foreground">{detail}</p>
    </Card>
  )
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warn",
        className,
      )}
    >
      Demo
    </span>
  )
}

export function Button({
  variant = "secondary",
  className,
  ...rest
}: React.ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "border border-border bg-secondary/60 hover:bg-secondary",
    danger: "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
    ghost: "hover:bg-secondary/60",
  }[variant]

  return (
    <button
      className={cn(
        "flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        styles,
        className,
      )}
      {...rest}
    />
  )
}
