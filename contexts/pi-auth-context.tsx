"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { PI_SDK_URL, PI_SDK_VERSION, PI_SANDBOX } from "@/lib/pi-payment-config";
import { setApiAuthToken } from "@/lib/api";
import {
  initializeGlobalPayment,
  checkIncompletePayments,
  type PiPayment,
} from "@/lib/pi-payment";
import { logPortalDiagnostics } from "@/lib/pi-portal-check";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserData = {
  uid: string;
  username: string;
};

interface PiAuthContextType {
  isAuthenticated: boolean;
  authMessage: string;
  hasError: boolean;
  piAccessToken: string | null;
  userData: UserData | null;
  /** Pi UID — primary wallet identifier within Pi Network */
  walletAddress: string | null;
  reinitialize: () => void;
  /** Diagnostic info for troubleshooting — shows environment and errors */
  diagnostics: {
    sdkLoaded: boolean;
    sandboxMode: boolean;
    piInitialized: boolean;
    lastError: string | null;
  };
}

const PiAuthContext = createContext<PiAuthContextType | undefined>(undefined);

// ── SDK loader ────────────────────────────────────────────────────────────────

const loadPiSDK = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && typeof window.Pi !== "undefined") {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${PI_SDK_URL}"]`);
    if (existing) {
      let attempts = 0;
      const poll = setInterval(() => {
        if (typeof window.Pi !== "undefined") {
          clearInterval(poll);
          resolve();
        } else if (++attempts > 40) {
          clearInterval(poll);
          reject(new Error("sdk-timeout"));
        }
      }, 200);
      return;
    }
    const script = document.createElement("script");
    script.src = PI_SDK_URL;
    script.async = true;
    script.onload = () => {
      // Pi may not be immediately available after onload — poll briefly
      let attempts = 0;
      const poll = setInterval(() => {
        if (typeof window.Pi !== "undefined") {
          clearInterval(poll);
          resolve();
        } else if (++attempts > 20) {
          clearInterval(poll);
          reject(new Error("sdk-timeout"));
        }
      }, 100);
    };
    script.onerror = () => reject(new Error("sdk-timeout"));
    document.head.appendChild(script);
  });

// ── Provider ──────────────────────────────────────────────────────────────────

export function PiAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMessage, setAuthMessage] = useState("Connecting to Pi Network...");
  const [hasError, setHasError] = useState(false);
  const [piAccessToken, setPiAccessToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [diagnostics, setDiagnostics] = useState({
    sdkLoaded: false,
    sandboxMode: PI_SANDBOX,
    piInitialized: false,
    lastError: null as string | null,
  });

  const initialize = async () => {
    try {
      setHasError(false);
      setIsAuthenticated(false);
      setAuthMessage("Loading Pi Network SDK...");
      setDiagnostics((prev) => ({
        ...prev,
        sdkLoaded: false,
        piInitialized: false,
        lastError: null,
      }));

      // Race the SDK load against an 8-second timeout.
      // Outside Pi Browser the SDK script won't load — fail fast.
      console.log("[v0] Loading Pi SDK from:", PI_SDK_URL);
      await Promise.race([
        loadPiSDK(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("sdk-timeout")), 8000)
        ),
      ]);
      console.log("[v0] Pi SDK loaded successfully");

      setDiagnostics((prev) => ({ ...prev, sdkLoaded: true }));
      setAuthMessage("Initializing...");
      console.log("[v0] Calling Pi.init() with sandbox:", PI_SANDBOX);
      console.log("[v0] Pi SDK version:", PI_SDK_VERSION);
      console.log("[v0] Current URL:", window.location.href);
      console.log("[v0] Current origin:", window.location.origin);
      
      await window.Pi.init({ version: PI_SDK_VERSION, sandbox: PI_SANDBOX });
      console.log("[v0] Pi.init() completed successfully");
      console.log("[v0] Pi object state after init:", {
        piDefined: !!window.Pi,
        authenticateDefined: typeof window.Pi?.authenticate,
        userDefined: typeof window.Pi?.user,
      });

      setDiagnostics((prev) => ({ ...prev, piInitialized: true }));
      setAuthMessage("Authenticating with Pi Network...");

      console.log("[v0] Starting Pi.authenticate() with scopes: ['username', 'payments']");
      
      // Run portal environment diagnostics before attempting authenticate
      logPortalDiagnostics();
      
      // Log iframe context — if we're not in an iframe, postMessage will fail
      console.log("[v0] Iframe detection:");
      console.log("[v0]   window.self === window.top:", window.self === window.top);
      console.log("[v0]   window.parent === window:", window.parent === window);
      console.log("[v0]   window.frameElement:", !!window.frameElement);
      console.log("[v0] Current origin:", window.location.origin);
      console.log("[v0] Parent frame origin:", (() => {
        try {
          const parentOrigin = window.parent.location.origin;
          return parentOrigin;
        } catch (e) {
          return `Inaccessible (${(e as Error).message})`;
        }
      })());
      
      // Test postMessage capability directly
      console.log("[v0] Testing postMessage capability to parent frame:");
      try {
        window.parent.postMessage({ test: "connectivity-check-v0" }, "*");
        console.log("[v0] postMessage to parent successful (no error thrown)");
      } catch (pmErr) {
        console.log("[v0] postMessage to parent FAILED:", pmErr);
      }
      
      // Log Pi SDK internal state
      if (window.Pi) {
        console.log("[v0] Pi SDK ready for authenticate:");
        console.log("[v0]   Pi.user available:", !!window.Pi.user);
        console.log("[v0]   Pi.authenticate available:", typeof window.Pi.authenticate);
        console.log("[v0]   Pi.onIncompletePaymentFound available:", typeof window.Pi.onIncompletePaymentFound);
      }

      // Pi SDK authenticate — returns verified user + access token directly.
      // The onIncompletePaymentFound callback MUST NOT block authentication.
      // It runs in the background to recover prior payments, but errors should
      // not prevent the user from logging in.
      let authResult;
      try {
        console.log("[v0] Calling window.Pi.authenticate() with 15-second timeout...");
        authResult = await Promise.race([
          window.Pi.authenticate(
            ["username", "payments"],
            (payment: PiPayment) => {
              // Incomplete payment recovery — runs in background, non-blocking
              console.log("[v0] Incomplete payment callback triggered for:", payment.identifier);
              // Fire and forget — do not await or let errors block authentication
              (async () => {
                try {
                  await new Promise((r) => setTimeout(r, 1000));
                  await checkIncompletePayments(payment);
                  console.log("[v0] Incomplete payment recovery completed");
                } catch (err) {
                  // Non-fatal — log but don't rethrow
                  console.log("[v0] Incomplete payment recovery error (non-fatal):", err);
                }
              })();
            }
          ),
          // Add a 15-second timeout for authenticate() itself
          new Promise<never>((_, reject) =>
            setTimeout(() => {
              console.log("[v0] Pi.authenticate() timeout after 15 seconds");
              reject(new Error("authenticate-timeout: Pi.authenticate() did not complete within 15 seconds. This typically means postMessage communication with Pi Browser parent frame failed."));
            }, 15000)
          ),
        ]);
        console.log("[v0] Pi.authenticate() returned successfully:", authResult);
      } catch (authErr) {
        const authErrMsg = authErr instanceof Error ? authErr.message : String(authErr);
        console.log("[v0] Pi.authenticate() failed with error:", authErrMsg);
        console.log("[v0] Full error object:", authErr);
        console.log("[v0] Developer Portal postMessage failure — this typically means:");
        console.log("[v0]   1. App is not inside a Pi Browser iframe in the Developer Portal");
        console.log("[v0]   2. Developer Portal sandbox blocks postMessage to app-cdn.minepi.com");
        console.log("[v0]   3. CORS or iframe sandbox attribute prevents communication");
        throw authErr;
      }

      if (!authResult?.accessToken) {
        const err = `Pi.authenticate() returned accessToken: ${authResult?.accessToken}`;
        console.log("[v0]", err);
        throw new Error(err);
      }
      if (!authResult?.user?.uid) {
        const err = `Pi.authenticate() returned user.uid: ${authResult?.user?.uid}`;
        console.log("[v0]", err);
        throw new Error(err);
      }

      console.log("[v0] Authentication successful - uid:", authResult.user.uid, "username:", authResult.user.username);

      // Store token so API calls can use it
      setPiAccessToken(authResult.accessToken);
      setApiAuthToken(`Bearer ${authResult.accessToken}`);

      // Store user from SDK result — no server call needed
      setUserData({
        uid: authResult.user.uid,
        username: authResult.user.username,
      });

      // App is authenticated — show the UI
      setIsAuthenticated(true);
      setAuthMessage("Authenticated");
      initializeGlobalPayment();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isSdkTimeout = msg.includes("sdk-timeout");
      const isAuthTimeout = msg.includes("authenticate-timeout");

      console.log("[v0] Auth initialization failed");
      console.log("[v0] Error object:", err);
      console.log("[v0] Error message:", msg);
      console.log("[v0] Error is Error instance:", err instanceof Error);
      console.log("[v0] Error constructor:", (err as any)?.constructor?.name);
      console.log("[v0] Is SDK timeout:", isSdkTimeout);
      console.log("[v0] Is authenticate timeout:", isAuthTimeout);

      setDiagnostics((prev) => ({
        ...prev,
        lastError: msg,
      }));

      setHasError(true);
      setAuthMessage(
        isSdkTimeout
          ? "This app must be opened inside Pi Browser. Launch it from the Pi Network app."
          : isAuthTimeout
          ? `Pi.authenticate() timeout. The Pi SDK cannot communicate with Pi Browser (postMessage failed). Verify the app is inside a Pi Browser iframe in the Developer Portal.`
          : `Authentication failed: ${msg}`
      );
    }
  };

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: PiAuthContextType = {
    isAuthenticated,
    authMessage,
    hasError,
    piAccessToken,
    userData,
    walletAddress: userData?.uid ?? null,
    reinitialize: initialize,
    diagnostics,
  };

  return (
    <PiAuthContext.Provider value={value}>{children}</PiAuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePiAuth(): PiAuthContextType {
  const ctx = useContext(PiAuthContext);
  if (!ctx) throw new Error("usePiAuth must be used within a PiAuthProvider");
  return ctx;
}
