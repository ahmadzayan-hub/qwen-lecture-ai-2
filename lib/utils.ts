import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** mm:ss from a millisecond duration. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** HH:MM:SS wall clock. Accepts an ISO string or epoch ms. */
export function formatClock(input: string | number): string {
  const date = typeof input === "number" ? new Date(input) : new Date(input)
  if (Number.isNaN(date.getTime())) return "--:--"
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

/** Detects the dominant script so we can set dir/lang per line. */
export function scriptOf(text: string): "ar" | "en" | "mixed" {
  const arabic = (text.match(/[\u0621-\u064A]/g) ?? []).length
  const latin = (text.match(/[A-Za-z]/g) ?? []).length
  if (arabic && latin) return "mixed"
  if (arabic) return "ar"
  return "en"
}

export function dirFor(text: string): "rtl" | "ltr" {
  return scriptOf(text) === "ar" ? "rtl" : "ltr"
}
