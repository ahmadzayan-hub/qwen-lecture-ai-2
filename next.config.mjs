/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  // Hader needs mic + display capture on its own origin, everything else is denied.
  {
    key: "Permissions-Policy",
    value: "microphone=(self), display-capture=(self), camera=(), geolocation=(), payment=()",
  },
  {
    // Report-only first so a tight rule can never break a live lecture.
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "worker-src 'self' blob:",
      "connect-src 'self' https://dashscope-intl.aliyuncs.com https://dashscope.aliyuncs.com wss:",
      "frame-ancestors 'self'",
    ].join("; "),
  },
]

const nextConfig = {
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ]
  },
}

export default nextConfig
