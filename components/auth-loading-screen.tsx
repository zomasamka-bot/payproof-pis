"use client";

/**
 * AuthLoadingScreen — pure presentational component.
 *
 * Accepts explicit props instead of calling usePiAuth() directly.
 * This is critical: the component is rendered both inside AND outside
 * PiAuthProvider (as a hydration-safe initial shell), so it CANNOT
 * call usePiAuth() — that hook throws when called outside the provider.
 */

interface AuthLoadingScreenProps {
  message?: string;
  hasError?: boolean;
  onRetry?: () => void;
}

export function AuthLoadingScreen({
  message = "Connecting to Pi Network...",
  hasError = false,
  onRetry,
}: AuthLoadingScreenProps) {
  const isPiBrowserRequired =
    hasError &&
    (message.includes("Pi Browser") || message.includes("Pi Network app"));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full text-center space-y-6">

        {/* Icon */}
        <div className="flex justify-center">
          {isPiBrowserRequired ? (
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 8h4.5a2.5 2.5 0 0 1 0 5H9m0-5v8m0-5h4" />
              </svg>
            </div>
          ) : hasError ? (
            <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-destructive"
                fill="none"
                strokeWidth="1.8"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          ) : (
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          )}
        </div>

        {/* App identity */}
        <div className="space-y-1">
          <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
            PayProof PIS
          </p>
          <h1 className="text-xl font-semibold">
            {isPiBrowserRequired
              ? "Open in Pi Browser"
              : hasError
              ? "Authentication Failed"
              : "Connecting to Pi Network"}
          </h1>
        </div>

        {/* Message */}
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>

        {/* Pi Browser instructions */}
        {isPiBrowserRequired && (
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-left space-y-3">
            <p className="text-xs font-semibold text-foreground">How to open this app:</p>
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
              <li>Open the Pi Network app on your device</li>
              <li>
                Tap the browser icon and navigate to{" "}
                <span className="font-mono text-foreground">https://payproof-pis.vercel.app</span>
              </li>
              <li>The app will authenticate automatically</li>
            </ol>
          </div>
        )}

        {/* Retry button for non-Pi-Browser errors */}
        {hasError && !isPiBrowserRequired && onRetry && (
          <button
            onClick={onRetry}
            className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium text-sm"
          >
            Retry Connection
          </button>
        )}

        {!hasError && (
          <p className="text-xs text-muted-foreground/50 font-mono">
            Payment Information Service
          </p>
        )}
      </div>
    </div>
  );
}
