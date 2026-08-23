import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { AppFrame } from "@/components/shell/app-frame"
import { ServiceWorkerBridge } from "@/components/shell/service-worker-bridge"

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
})

export const metadata: Metadata = {
  title: "HADER AI | حاضر — Lecture Presence Copilot",
  description:
    "Realtime lecture monitoring that alerts you the moment your name is called, with cross-device escalation and an AI lecture brief.",
  applicationName: "HADER AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "HADER AI",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: "#12161f",
  width: "device-width",
  initialScale: 1,
  // Alert buttons must stay reachable; allow zoom for accessibility.
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} bg-background`}>
      <body className="min-h-dvh bg-background font-sans antialiased">
        <ServiceWorkerBridge />
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  )
}
