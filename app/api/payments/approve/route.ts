/**
 * POST /api/payments/approve
 *
 * Called by the Pi SDK's onReadyForServerApproval callback.
 * Approves the payment on the Pi Platform and records the pending state
 * in Upstash Redis for idempotency and recovery.
 *
 * Request body:  { paymentId: string, referenceId?: string, metadata?: object }
 * Response:      { approved: true, paymentId }
 *
 * Pi Platform docs:
 *   POST https://api.minepi.com/v2/payments/{paymentId}/approve
 *   Authorization: Key {PI_API_KEY}
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { piApproveUrl } from "@/lib/pi-payment-config";

// Upstash Redis client — uses KV_REST_API_URL + KV_REST_API_TOKEN env vars
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const PI_API_KEY = process.env.PI_API_KEY;

export async function POST(req: NextRequest) {
  if (!PI_API_KEY) {
    console.error("[PIS approve] PI_API_KEY is not configured.");
    return NextResponse.json({ error: "Server misconfiguration: missing PI_API_KEY." }, { status: 500 });
  }

  let paymentId: string | undefined;
  let referenceId: string | undefined;
  let metadata: Record<string, unknown> = {};

  try {
    const body = await req.json();
    paymentId = body?.paymentId;
    referenceId = body?.referenceId;
    metadata = body?.metadata ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!paymentId || typeof paymentId !== "string") {
    return NextResponse.json({ error: "Missing paymentId." }, { status: 400 });
  }

  // Idempotency check — if already approved, return early
  const redisKey = `pis:payment:${paymentId}`;
  try {
    const existing = await redis.get<Record<string, unknown>>(redisKey);
    if (existing?.status === "approved" || existing?.status === "completed") {
      return NextResponse.json({
        approved: true,
        paymentId,
        idempotent: true,
        status: existing.status,
      });
    }
  } catch (e) {
    // Redis unavailable — log but continue so payment isn't blocked
    console.error("[PIS approve] Redis read error (non-fatal):", e);
  }

  // Call Pi Platform approve endpoint
  let piResponse: Response;
  try {
    piResponse = await fetch(piApproveUrl(paymentId), {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
  } catch (networkErr) {
    console.error("[PIS approve] Network error calling Pi Platform:", networkErr);
    return NextResponse.json(
      { error: "Failed to reach Pi Platform. Please try again." },
      { status: 502 }
    );
  }

  const responseText = await piResponse.text();
  let piData: Record<string, unknown> = {};
  try { piData = JSON.parse(responseText); } catch { /* non-JSON body */ }

  if (!piResponse.ok) {
    console.error("[PIS approve] Pi Platform returned error:", piResponse.status, responseText);
    return NextResponse.json(
      { error: "Pi Platform approval failed.", detail: piData, status: piResponse.status },
      { status: piResponse.status }
    );
  }

  // Record in Redis — 24h TTL (payments should complete well within this window)
  const record = {
    paymentId,
    referenceId: referenceId ?? null,
    status: "approved",
    approvedAt: new Date().toISOString(),
    metadata,
    piData,
  };

  try {
    await redis.set(redisKey, record, { ex: 86400 }); // 24 hours
  } catch (e) {
    console.error("[PIS approve] Redis write error (non-fatal):", e);
  }

  return NextResponse.json({ approved: true, paymentId }, { status: 200 });
}
