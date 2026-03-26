"use client";

import { type ReactNode } from "react";
import { PiAuthProvider } from "@/contexts/pi-auth-context";

/**
 * AppWrapper — wraps the app in PiAuthProvider.
 *
 * IMPORTANT: The app always renders. Auth state is available via usePiAuth()
 * in any page that needs it. We do NOT gate the entire app behind an auth
 * wall — that prevents the app from loading on Vercel entirely.
 *
 * Pages that require auth (e.g. pay) check isAuthenticated themselves.
 */
export function AppWrapper({ children }: { children: ReactNode }) {
  return <PiAuthProvider>{children}</PiAuthProvider>;
}
