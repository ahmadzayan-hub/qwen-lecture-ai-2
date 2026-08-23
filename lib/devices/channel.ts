/**
 * Cross-device alert transport.
 *
 * Two implementations, chosen at runtime and always reported honestly:
 *
 *   SUPABASE — real Supabase Realtime broadcast. Works phone <-> laptop across
 *              networks. Requires NEXT_PUBLIC_SUPABASE_URL + ANON_KEY.
 *   LOCAL    — BroadcastChannel. Only reaches other tabs of the SAME browser
 *              on the SAME machine. Useful for testing the full alert path
 *              without a backend, and the UI labels it as local-only so nobody
 *              believes their phone is paired when it isn't.
 *
 * The transport never claims a peer is online. Peers are tracked by heartbeat.
 */

import type { DevicePeer, DeviceRole, PairingTransport, RealtimeMessage } from "@/lib/types"

const HEARTBEAT_MS = 5000
const PEER_TIMEOUT_MS = 14000

export interface ChannelCallbacks {
  onMessage(message: RealtimeMessage): void
  onPeersChanged(peers: DevicePeer[]): void
  onTransportState(state: "CONNECTED" | "CONNECTING" | "OFFLINE"): void
}

export interface AlertChannel {
  transport: PairingTransport
  connect(): Promise<void>
  publish(message: RealtimeMessage): void
  disconnect(): void
}

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

interface PeerTracker {
  peers: Map<string, DevicePeer>
  touch(peer: DevicePeer): void
  prune(): void
}

function createPeerTracker(onChange: (peers: DevicePeer[]) => void): PeerTracker {
  const peers = new Map<string, DevicePeer>()
  return {
    peers,
    touch(peer) {
      peers.set(peer.deviceId, { ...peer, lastSeen: Date.now(), online: true })
      onChange([...peers.values()])
    },
    prune() {
      const now = Date.now()
      let changed = false
      for (const [id, peer] of peers) {
        const online = now - peer.lastSeen < PEER_TIMEOUT_MS
        if (peer.online !== online) {
          peers.set(id, { ...peer, online })
          changed = true
        }
      }
      if (changed) onChange([...peers.values()])
    },
  }
}

/* ------------------------------------------------------------------ *
 * Local transport — same browser only
 * ------------------------------------------------------------------ */

export class LocalAlertChannel implements AlertChannel {
  transport: PairingTransport = "LOCAL"

  private channel: BroadcastChannel | null = null
  private beat: ReturnType<typeof setInterval> | null = null
  private tracker: PeerTracker
  private callbacks: ChannelCallbacks
  private identity: { deviceId: string; deviceName: string; role: DeviceRole }
  private room: string

  constructor(
    room: string,
    identity: { deviceId: string; deviceName: string; role: DeviceRole },
    callbacks: ChannelCallbacks,
  ) {
    this.room = room
    this.identity = identity
    this.callbacks = callbacks
    this.tracker = createPeerTracker(callbacks.onPeersChanged)
  }

  async connect(): Promise<void> {
    if (typeof BroadcastChannel === "undefined") {
      this.callbacks.onTransportState("OFFLINE")
      return
    }
    this.channel = new BroadcastChannel(`hader:${this.room}`)
    this.channel.onmessage = (event: MessageEvent<RealtimeMessage>) => {
      const message = event.data
      if (!message || message.deviceId === this.identity.deviceId) return
      if (message.type === "HEARTBEAT") {
        this.tracker.touch({
          deviceId: message.deviceId,
          deviceName: message.deviceName ?? "Unknown device",
          role: message.role ?? "ALERT",
          platform: message.platform ?? "unknown",
          online: true,
          lastSeen: Date.now(),
          batteryLevel: message.batteryLevel,
        })
        return
      }
      this.callbacks.onMessage(message)
    }

    this.callbacks.onTransportState("CONNECTED")
    this.heartbeat()
    this.beat = setInterval(() => {
      this.heartbeat()
      this.tracker.prune()
    }, HEARTBEAT_MS)
  }

  private heartbeat() {
    this.publish({
      type: "HEARTBEAT",
      deviceId: this.identity.deviceId,
      deviceName: this.identity.deviceName,
      role: this.identity.role,
      platform: detectPlatform(),
      sentAt: Date.now(),
    })
  }

  publish(message: RealtimeMessage): void {
    try {
      this.channel?.postMessage(message)
    } catch {
      /* channel closed */
    }
  }

  disconnect(): void {
    if (this.beat) clearInterval(this.beat)
    this.beat = null
    this.channel?.close()
    this.channel = null
    this.callbacks.onTransportState("OFFLINE")
  }
}

/* ------------------------------------------------------------------ *
 * Supabase transport — real cross-network
 * ------------------------------------------------------------------ */

export class SupabaseAlertChannel implements AlertChannel {
  transport: PairingTransport = "SUPABASE"

  private client: unknown = null
  private channel: { send: (args: unknown) => void; unsubscribe: () => void } | null = null
  private beat: ReturnType<typeof setInterval> | null = null
  private tracker: PeerTracker
  private callbacks: ChannelCallbacks
  private identity: { deviceId: string; deviceName: string; role: DeviceRole }
  private room: string

  constructor(
    room: string,
    identity: { deviceId: string; deviceName: string; role: DeviceRole },
    callbacks: ChannelCallbacks,
  ) {
    this.room = room
    this.identity = identity
    this.callbacks = callbacks
    this.tracker = createPeerTracker(callbacks.onPeersChanged)
  }

  async connect(): Promise<void> {
    this.callbacks.onTransportState("CONNECTING")
    try {
      const { createClient } = await import("@supabase/supabase-js")
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        { realtime: { params: { eventsPerSecond: 20 } } },
      )
      this.client = client

      const channel = client.channel(`hader:${this.room}`, {
        config: { broadcast: { self: false } },
      })

      channel.on("broadcast", { event: "hader" }, (payload: { payload: RealtimeMessage }) => {
        const message = payload.payload
        if (!message || message.deviceId === this.identity.deviceId) return
        if (message.type === "HEARTBEAT") {
          this.tracker.touch({
            deviceId: message.deviceId,
            deviceName: message.deviceName ?? "Unknown device",
            role: message.role ?? "ALERT",
            platform: message.platform ?? "unknown",
            online: true,
            lastSeen: Date.now(),
            batteryLevel: message.batteryLevel,
          })
          return
        }
        this.callbacks.onMessage(message)
      })

      await new Promise<void>((resolve) => {
        channel.subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            this.callbacks.onTransportState("CONNECTED")
            resolve()
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this.callbacks.onTransportState("OFFLINE")
            resolve()
          }
        })
      })

      this.channel = channel as unknown as { send: (args: unknown) => void; unsubscribe: () => void }
      this.heartbeat()
      this.beat = setInterval(() => {
        this.heartbeat()
        this.tracker.prune()
      }, HEARTBEAT_MS)
    } catch {
      this.callbacks.onTransportState("OFFLINE")
    }
  }

  private heartbeat() {
    this.publish({
      type: "HEARTBEAT",
      deviceId: this.identity.deviceId,
      deviceName: this.identity.deviceName,
      role: this.identity.role,
      platform: detectPlatform(),
      sentAt: Date.now(),
    })
  }

  publish(message: RealtimeMessage): void {
    try {
      this.channel?.send({ type: "broadcast", event: "hader", payload: message })
    } catch {
      /* not subscribed */
    }
  }

  disconnect(): void {
    if (this.beat) clearInterval(this.beat)
    this.beat = null
    try {
      this.channel?.unsubscribe()
    } catch {
      /* ignore */
    }
    this.channel = null
    this.client = null
    this.callbacks.onTransportState("OFFLINE")
  }
}

export function createAlertChannel(
  room: string,
  identity: { deviceId: string; deviceName: string; role: DeviceRole },
  callbacks: ChannelCallbacks,
): AlertChannel {
  if (supabaseConfigured()) return new SupabaseAlertChannel(room, identity, callbacks)
  return new LocalAlertChannel(room, identity, callbacks)
}

export function detectPlatform(): string {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return "Android"
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS"
  if (/Windows/i.test(ua)) return "Windows"
  if (/Mac OS X/i.test(ua)) return "macOS"
  if (/Linux/i.test(ua)) return "Linux"
  return "unknown"
}

/** 6-digit, short-lived, single-use pairing code. */
export function generatePairingCode(): string {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return String(bytes[0] % 1_000_000).padStart(6, "0")
}

export function deviceIdentity(): { deviceId: string; deviceName: string } {
  const KEY = "hader.device.identity"
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) return JSON.parse(stored) as { deviceId: string; deviceName: string }
  } catch {
    /* fall through */
  }
  const identity = {
    deviceId: crypto.randomUUID(),
    deviceName: `${detectPlatform()} device`,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(identity))
  } catch {
    /* private mode */
  }
  return identity
}
