import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Baseline response headers for the dashboard and its proxies.
 *
 * The CSP is production-only on purpose: Turbopack's dev client needs
 * `unsafe-eval` and hot-reload sockets, so shipping it in dev would break the
 * editor loop. Even in production it keeps `'unsafe-inline'` for scripts,
 * because the App Router bootstraps itself with an inline `__next_f` payload
 * — what it does buy is that no remote script, no foreign `connect-src` and no
 * framing are allowed, which is what an injected key-sniffer would need.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    // The dashboard has no camera, mic or geolocation feature; deny them so a
    // injected script cannot reach them either.
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  ...(isProduction
    ? [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "object-src 'none'",
            // Vision analysis renders arbitrary user-supplied image URLs.
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            // Everything the client talks to is same-origin: the engine and the
            // model providers are only ever contacted from the server routes.
            "connect-src 'self'",
            "worker-src 'self' blob:",
          ].join("; "),
        },
        { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Type errors must fail the build (they were silently ignored before).
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // Allow the Arena preview host plus localhost in dev.
  allowedDevOrigins: ["*.e2b.app", "127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        // Every route, including /api/*: those JSON responses are what a
        // cross-site fetch would ride on, so they get the same treatment.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
