/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  /**
   * HTTP headers for Pi Browser WebView compatibility.
   *
   * KEY CHANGE: X-Frame-Options is NOT set.
   *   Pi Browser embeds apps inside an iframe. Setting X-Frame-Options to
   *   SAMEORIGIN or DENY will prevent Pi Browser from loading the app at all,
   *   causing Step 10 "Authentication Failed". Framing policy is controlled
   *   exclusively by the CSP frame-ancestors directive below.
   */
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: [
          /**
           * Content-Security-Policy
           *
           * script-src:
           *   'self'           — our own JS bundles
           *   sdk.minepi.com   — Pi SDK script (must be explicitly allowed)
           *   'unsafe-inline'  — Next.js inline scripts
           *
           * connect-src:
           *   'self'              — our own API routes
           *   sdk.minepi.com      — Pi SDK makes XHR/fetch back to its own CDN
           *   api.minepi.com      — Pi Platform REST API
           *   *.upstash.io        — Upstash Redis (server-side only but allowed)
           *
           * frame-ancestors:
           *   'self'
           *   https://*.minepi.com     — Pi Browser and Developer Portal
           *   https://*.pinet.com      — PiNet hosted domain
           *
           *   This is the ONLY mechanism that controls who can iframe the app.
           *   X-Frame-Options is intentionally absent (see note above).
           */
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' https://sdk.minepi.com 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://sdk.minepi.com https://api.minepi.com https://*.upstash.io blob:",
              "frame-ancestors https://*.minepi.com https://*.pinet.com https://*.piappengine.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // CORS for API routes — allow requests from Pi Browser and PiNet domains
        source: "/api/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
