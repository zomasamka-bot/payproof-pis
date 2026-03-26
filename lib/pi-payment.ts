/**
 * PayProof PIS — Pi Network Payment Integration
 *
 * Full payment flow: create → approve (server) → complete (server)
 *
 * All server calls go to our own Next.js API routes:
 *   POST /api/payments/approve   — calls Pi Platform + writes to Redis
 *   POST /api/payments/complete  — calls Pi Platform + updates Redis
 *
 * The locked system-config.ts BACKEND_URLS are intentionally NOT used here.
 * This file is entirely self-contained using lib/pi-payment-config.ts.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type PaymentMetadata = {
  referenceId?: string;
  recipientWalletAddress?: string;
  recipientUsername?: string;
  senderWalletAddress?: string;
  description?: string;
  domain?: string;
  [key: string]: unknown;
};

export type PaymentOptions = {
  amount: number;
  memo?: string;
  metadata: PaymentMetadata;
  /** Called after server completion succeeds. txid is the Pi blockchain transaction ID. */
  onComplete?: (txid: string, metadata: PaymentMetadata) => void;
  onError?: (error: Error, payment?: PiPayment) => void;
};

export type PiPaymentData = {
  amount: number;
  memo: string;
  metadata: PaymentMetadata;
};

export type PiPaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: PiPayment) => void;
};

export type PiPayment = {
  identifier: string;
  amount: number;
  memo: string;
  metadata: PaymentMetadata;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction: null | {
    txid: string;
    verified: boolean;
    _link: string;
  };
  created_at: string;
};

// ============================================================================
// Global Window Declaration
// ============================================================================

declare global {
  interface Window {
    Pi: {
      init: (config: { version: string; sandbox?: boolean }) => Promise<void>;
      authenticate: (
        scopes: string[],
        onIncompletePaymentFound: (payment: PiPayment) => void
      ) => Promise<{
        accessToken: string;
        user: { uid: string; username: string };
      }>;
      createPayment: (
        paymentData: PiPaymentData,
        callbacks: PiPaymentCallbacks
      ) => void;
    };
    pay: (options: PaymentOptions) => Promise<void>;
  }
}

// ============================================================================
// Internal server call helpers
// (these hit OUR Next.js API routes, not Pi Platform directly)
// ============================================================================

async function callApprove(
  paymentId: string,
  metadata: PaymentMetadata
): Promise<void> {
  const res = await fetch("/api/payments/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId,
      referenceId: metadata.referenceId,
      metadata,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Approve failed (${res.status}): ${detail}`);
  }
}

async function callComplete(
  paymentId: string,
  txid: string,
  referenceId?: string
): Promise<void> {
  const res = await fetch("/api/payments/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId, txid, referenceId }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Complete failed (${res.status}): ${detail}`);
  }
}

// ============================================================================
// Payment Callbacks
// ============================================================================

function createPaymentCallbacks(options: PaymentOptions): PiPaymentCallbacks {
  const referenceId = options.metadata?.referenceId;

  const onReadyForServerApproval = async (paymentId: string): Promise<void> => {
    try {
      await callApprove(paymentId, options.metadata);
    } catch (error) {
      console.error("[PIS] onReadyForServerApproval error:", error);
      // Do not rethrow — Pi SDK handles the cancelled state via onError callback
    }
  };

  const onReadyForServerCompletion = async (
    paymentId: string,
    txid: string
  ): Promise<void> => {
    try {
      await callComplete(paymentId, txid, referenceId);

      if (options.onComplete) {
        // txid is first arg — pay page uses it to call updateTransactionStatus
        options.onComplete(txid, options.metadata);
      }
    } catch (error) {
      console.error("[PIS] onReadyForServerCompletion error:", error);
      if (options.onError) {
        options.onError(
          error instanceof Error ? error : new Error("Payment completion failed"),
          undefined
        );
      }
    }
  };

  const onCancel = (paymentId: string): void => {
    console.info("[PIS] Payment cancelled by user:", paymentId);
    // Surface as a structured error so the pay page can show the cancelled state
    if (options.onError) {
      options.onError(new Error("user cancelled payment"), undefined);
    }
  };

  const onError = (error: Error, payment?: PiPayment): void => {
    console.error("[PIS] Pi SDK payment error:", error, payment);
    if (options.onError) {
      options.onError(error, payment);
    }
  };

  return {
    onReadyForServerApproval,
    onReadyForServerCompletion,
    onCancel,
    onError,
  };
}

// ============================================================================
// Core Payment Function
// ============================================================================

export const pay = async (options: PaymentOptions): Promise<void> => {
  if (typeof window === "undefined" || !window.Pi) {
    throw new Error("Pi SDK is not available. Open this app inside Pi Browser.");
  }

  const paymentData: PiPaymentData = {
    amount: options.amount,
    memo: options.memo ?? `PayProof PIS – ${options.metadata?.referenceId ?? "payment"}`,
    metadata: options.metadata,
  };

  const callbacks = createPaymentCallbacks(options);

  try {
    window.Pi.createPayment(paymentData, callbacks);
  } catch (error) {
    console.error("[PIS] Pi.createPayment failed:", error);
    if (options.onError) {
      options.onError(
        error instanceof Error ? error : new Error("Failed to create Pi payment"),
        undefined
      );
    }
    throw error;
  }
};

// ============================================================================
// Incomplete Payment Recovery
// Called by Pi SDK during authenticate() if a prior payment was not completed
// ============================================================================

export const checkIncompletePayments = async (
  payment: PiPayment
): Promise<void> => {
  const paymentId = payment.identifier;
  const txid = payment.transaction?.txid;

  console.info("[PIS] Incomplete payment found:", paymentId, "txid:", txid);

  try {
    if (!payment.status.developer_approved) {
      // Not yet approved — approve it first
      await callApprove(paymentId, payment.metadata ?? {});
    }

    if (payment.status.developer_approved && txid && !payment.status.developer_completed) {
      // Approved but not completed — complete it now
      await callComplete(paymentId, txid, payment.metadata?.referenceId);
    }
  } catch (error) {
    console.error("[PIS] Failed to recover incomplete payment:", paymentId, error);
  }
};

// ============================================================================
// Initialize Global Payment Function
// ============================================================================

export const initializeGlobalPayment = (): void => {
  if (typeof window !== "undefined") {
    window.pay = pay;
  }
};
