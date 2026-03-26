/**
 * PayProof PIS — Payment Configuration
 *
 * Single canonical origin: https://payproof-pis.vercel.app
 * 
 * This is the ONLY URL used for:
 *   - Pi Developer Portal registration
 *   - Pi.authenticate() origin verification
 *   - CORS and CSP framing rules
 *   - All app URLs and redirects
 *
 * Network: Testnet → sandbox MUST be true
 * API key: PI_API_KEY (server-side only — never exposed to the client)
 */

// ---------------------------------------------------------------------------
// App identity
// ---------------------------------------------------------------------------

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "PayProof PIS";

/**
 * The canonical origin used for CORS and Pi Platform registration.
 * Must match the URL entered in the Pi Developer Portal EXACTLY.
 * 
 * Canonical: https://payproof-pis.vercel.app
 * 
 * Set via NEXT_PUBLIC_APP_ORIGIN env var in Vercel to override.
 * When opening the app in Developer Portal Step 10, use exactly this URL.
 */
export const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://payproof-pis.vercel.app";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://payproof-pis.vercel.app";

// ---------------------------------------------------------------------------
// Pi Network — Testnet
// ---------------------------------------------------------------------------

/**
 * sandbox = true  → Testnet (NEXT_PUBLIC_PI_NETWORK === "testnet")
 * sandbox = false → Mainnet
 *
 * The locked system-config.ts hardcodes SANDBOX: false which is WRONG for
 * testnet. We derive the correct value from the environment variable here.
 */
export const PI_SANDBOX =
  (process.env.NEXT_PUBLIC_PI_NETWORK ?? "testnet") === "testnet";

/** Pi SDK version required by the Platform */
export const PI_SDK_VERSION = "2.0";

/** Pi SDK script URL — always loaded from the official CDN */
export const PI_SDK_URL = "https://sdk.minepi.com/pi-sdk.js";

// ---------------------------------------------------------------------------
// Pi Platform API (server-side only — called from Next.js API routes)
// ---------------------------------------------------------------------------

/**
 * Base URL for the Pi Platform REST API.
 * Testnet and Mainnet use the same host; the sandbox flag on the SDK side
 * determines which ledger is used.
 */
export const PI_PLATFORM_API_BASE = "https://api.minepi.com";

/** Build approve URL for a payment */
export const piApproveUrl = (paymentId: string) =>
  `${PI_PLATFORM_API_BASE}/v2/payments/${paymentId}/approve`;

/** Build complete URL for a payment */
export const piCompleteUrl = (paymentId: string) =>
  `${PI_PLATFORM_API_BASE}/v2/payments/${paymentId}/complete`;

/** Build get-payment URL */
export const piGetPaymentUrl = (paymentId: string) =>
  `${PI_PLATFORM_API_BASE}/v2/payments/${paymentId}`;

/** Verify an access token (me endpoint) */
export const PI_ME_URL = `${PI_PLATFORM_API_BASE}/v2/me`;

// ---------------------------------------------------------------------------
// App-internal API routes (relative — work on both Vercel and local dev)
// ---------------------------------------------------------------------------

/** Our own approve route that calls Pi Platform + records to Redis */
export const APP_APPROVE_URL = `/api/payments/approve`;

/** Our own complete route that calls Pi Platform + updates Redis */
export const APP_COMPLETE_URL = `/api/payments/complete`;

/** Our own auth/login route */
export const APP_LOGIN_URL = `/api/auth/login`;

// ---------------------------------------------------------------------------
// Pi Blockchain explorer (testnet)
// ---------------------------------------------------------------------------

export const PI_BLOCKCHAIN_BASE = "https://api.testnet.minepi.com";

export const piTxEffectsUrl = (txid: string) =>
  `${PI_BLOCKCHAIN_BASE}/transactions/${txid}/effects`;
