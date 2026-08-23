"use client"

/**
 * Registers the service worker and surfaces updates.
 *
 * The SW matters for two real reasons here: PWA install on Android, and
 * notifications that survive a backgrounded tab during a lecture.
 */

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

export function ServiceWorkerBridge() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return

    let registration: ServiceWorkerRegistration | null = null

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
        registration.addEventListener("updatefound", () => {
          const installing = registration?.installing
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true)
            }
          })
        })
      } catch {
        /* SW is an enhancement — the app still works without it */
      }
    }

    void register()
  }, [])

  if (!updateReady) return null

  return (
    <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 lg:bottom-6">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex min-h-11 items-center gap-2 rounded-full border border-border glass px-4 text-xs font-semibold shadow-lg"
      >
        <RefreshCw className="size-3.5" aria-hidden />
        A new version is ready — reload
      </button>
    </div>
  )
}
