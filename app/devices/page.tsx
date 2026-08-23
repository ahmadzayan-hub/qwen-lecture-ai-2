"use client"

/**
 * Device pairing.
 *
 * The transport is stated plainly. LOCAL only reaches other tabs of the same
 * browser — implying a paired phone in that mode would be the exact kind of
 * lie that makes a safety product useless.
 */

import { useEffect, useState } from "react"
import { Check, Copy, Laptop, Radio, RefreshCw, Smartphone, WifiOff } from "lucide-react"
import { useHader } from "@/components/providers/hader-provider"
import { Button, Card, Dot, Kicker } from "@/components/ui/status"
import { cn, formatClock } from "@/lib/utils"

export default function DevicesPage() {
  const { session } = useHader()
  const [room, setRoomInput] = useState(session.room)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

  useEffect(() => setRoomInput(session.room), [session.room])
  useEffect(() => setOrigin(window.location.origin), [])

  const pairUrl = origin ? `${origin}/devices?room=${encodeURIComponent(session.room)}` : ""
  const isCloud = session.transport === "SUPABASE"

  // Honour ?room= so the link actually pairs rather than just looking like it does.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const incoming = params.get("room")
    if (incoming && incoming !== session.room) session.setRoom(incoming)
    // Intentionally runs once: later edits go through the form below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Kicker>Devices</Kicker>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Cross-device escalation</h1>
        <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
          Run Hader on your laptop to listen, and on your phone to be woken up. If the laptop alarm is
          missed for 15 seconds, the alert is pushed to every device in the room.
        </p>
      </header>

      {/* Transport truth */}
      <Card
        className={cn(
          isCloud ? "border-good/40 bg-good/5" : "border-warn/40 bg-warn/5",
        )}
      >
        <div className="flex items-start gap-3">
          {isCloud ? (
            <Radio className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
          ) : (
            <WifiOff className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          )}
          <div>
            <p className={cn("text-xs font-bold", isCloud ? "text-good" : "text-warn")}>
              {isCloud ? "Supabase Realtime — reaches other devices" : "Local channel — this browser only"}
            </p>
            <p className="mt-1 text-pretty text-[11px] leading-relaxed text-muted-foreground">
              {isCloud
                ? `Transport ${session.transportState.toLowerCase()}. Alerts travel to any device joined to this room.`
                : "No Supabase credentials are configured, so pairing works between tabs of this browser only. A real phone will not receive alerts until Supabase Realtime is connected."}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Room */}
        <Card>
          <Kicker>Room code</Kicker>
          <p className="mt-2 text-pretty text-[11px] leading-relaxed text-muted-foreground">
            Devices sharing a room code escalate to each other. Use something private.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const next = room.trim()
              if (next) session.setRoom(next)
            }}
          >
            <label className="sr-only" htmlFor="room">
              Room code
            </label>
            <input
              id="room"
              value={room}
              onChange={(event) => setRoomInput(event.target.value)}
              className="nums min-h-11 flex-1 rounded-lg border border-border bg-secondary/40 px-3 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              placeholder="lecture-room"
            />
            <Button type="submit" variant="primary">
              Join
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pairUrl)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1800)
                } catch {
                  setCopied(false)
                }
              }}
              disabled={!pairUrl}
            >
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? "Link copied" : "Copy pairing link"}
            </Button>
            <Button onClick={() => session.setRoom(session.room)}>
              <RefreshCw className="size-3.5" aria-hidden />
              Rejoin
            </Button>
          </div>
          {pairUrl && (
            <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{pairUrl}</p>
          )}
        </Card>

        {/* Peers */}
        <Card>
          <div className="flex items-center justify-between gap-2">
            <Kicker>Joined devices</Kicker>
            <span className="nums text-[11px] text-muted-foreground">{session.peers.length}</span>
          </div>

          {session.peers.length === 0 ? (
            <p className="mt-3 text-pretty text-[11px] leading-relaxed text-muted-foreground">
              No other device has joined <span className="font-mono">{session.room}</span> yet. Open the
              pairing link on your phone and keep the tab open.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {session.peers.map((peer) => (
                <li key={peer.deviceId} className="flex items-center gap-3 py-2.5">
                  {peer.platform.toLowerCase().includes("mobile") ||
                  peer.platform.toLowerCase().includes("android") ||
                  peer.platform.toLowerCase().includes("iphone") ? (
                    <Smartphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <Laptop className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{peer.deviceName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {peer.role} · {peer.platform} · seen {formatClock(peer.lastSeen)}
                      {peer.batteryLevel !== undefined ? ` · ${Math.round(peer.batteryLevel * 100)}%` : ""}
                    </p>
                  </div>
                  <Dot tone={peer.online ? "good" : "neutral"} pulse={peer.online} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <Kicker>How escalation behaves</Kicker>
        <ol className="mt-3 flex flex-col gap-1.5 text-pretty text-[11px] leading-relaxed text-muted-foreground">
          <li>0s — full-screen alarm, sound, vibration and a notification on the listening device.</li>
          <li>3s and 6s — the alarm repeats louder.</li>
          <li>10s — a persistent notification that survives a backgrounded tab.</li>
          <li>15s — the alert is broadcast to every joined device.</li>
          <li>It only stops when you press “I’m here”, “False alarm” or snooze.</li>
        </ol>
      </Card>
    </div>
  )
}
