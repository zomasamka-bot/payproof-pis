/**
 * POST /api/payments/complete
 *
 * Called by the Pi SDK's onReadyForServerCompletion callback.
 * Completes the payment on the Pi Platform and updates the Redis record
 * with the final txid and completed status.
 *
 * Request body:  { paymentId: string, txid: string, referenceId?: string }
 * Response:      { completed: true, paymentId, txid }
 *
 * Pi Platform docs:
 *   POST https://api.minepi.com/v2/payments/{paymentId}/complete
 *   Authorization: Key {PI_API_KEY}
 *   Body: { txid: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { piCompleteUrl } from "@/lib/pi-payment-config";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const PI_API_KEY = process.env.PI_API_KEY;

export async function POST(req: NextRequest) {
  if (!PI_API_KEY) {
    console.error("[PIS complete] PI_API_KEY is not configured.");
    return NextResponse.json({ error: "Server misconfiguration: missing PI_API_KEY." }, { status: 500 });
  }

  let paymentId: string | undefined;
  let txid: string | undefined;
  let referenceId: string | undefined;

  try {
    const body = await req.json();
    paymentId = body?.paymentId;
    txid = body?.txid;
    referenceId = body?.referenceId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!paymentId || typeof paymentId !== "string") {
    return NextResponse.json({ error: "Missing paymentId." }, { status: 400 });
  }
  if (!txid || typeof txid !== "string") {
    return NextResponse.json({ error: "Missing txid." }, { status: 400 });
  }

  // Idempotency check — if already completed, return early
  const redisKey = `pis:payment:${paymentId}`;
  try {
    const existing = await redis.get<Record<string, unknown>>(redisKey);
    if (existing?.status === "completed") {
      return NextResponse.json({
        completed: true,
        paymentId,
        txid: existing.txid ?? txid,
        idempotent: true,
      });
    }
  } catch (e) {
    console.error("[PIS complete] Redis read error (non-fatal):", e);
  }

  // Call Pi Platform complete endpoint
  let piResponse: Response;
  try {
    piResponse = await fetch(piCompleteUrl(paymentId), {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
    });
  } catch (networkErr) {
    console.error("[PIS complete] Network error calling Pi Platform:", networkErr);
    return NextResponse.json(
      { error: "Failed to reach Pi Platform. Please try again." },
      { status: 502 }
    );
  }

  const responseText = await piResponse.text();
  let piData: Record<string, unknown> = {};
  try { piData = JSON.parse(responseText); } catch { /* non-JSON body */ }

  if (!piResponse.ok) {
    console.error("[PIS complete] Pi Platform returned error:", piResponse.status, responseText);
    return NextResponse.json(
      { error: "Pi Platform completion failed.", detail: piData, status: piResponse.status },
      { status: piResponse.status }
    );
  }

  // Update Redis record with completed status and txid
  try {
    const existing = await redis.get<Record<string, unknown>>(redisKey) ?? {};
    await redis.set(
      redisKey,
      {
        ...existing,
        paymentId,
        txid,
        referenceId: referenceId ?? existing.referenceId ?? null,
        status: "completed",
        completedAt: new Date().toISOString(),
        piData,
      },
      { ex: 86400 * 30 } // retain completed records for 30 days
    );
  } catch (e) {
    console.error("[PIS complete] Redis write error (non-fatal):", e);
  }

  return NextResponse.json({ completed: true, paymentId, txid }, { status: 200 });
}
