/**
 * POST /api/auth/login
 *
 * Verifies a Pi Network access token by calling the Pi Platform /v2/me
 * endpoint and returns the authenticated user's profile.
 *
 * This replaces the locked system-config BACKEND_URLS.LOGIN which pointed
 * to the foreign App Studio proxy backend.
 *
 * Request body:  { pi_auth_token: string }
 * Response:      { id, username, wallet_address, app_id, credits_balance, terms_accepted }
 */

import { NextRequest, NextResponse } from "next/server";
import { PI_ME_URL } from "@/lib/pi-payment-config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const piAuthToken: string | undefined = body?.pi_auth_token;

    if (!piAuthToken || typeof piAuthToken !== "string") {
      return NextResponse.json(
        { error: "Missing pi_auth_token in request body." },
        { status: 400 }
      );
    }

    // Call the Pi Platform /v2/me endpoint to verify the token and get user data
    const meRes = await fetch(PI_ME_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${piAuthToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!meRes.ok) {
      const errorText = await meRes.text();
      console.error("[PIS] Pi /v2/me returned error:", meRes.status, errorText);
      return NextResponse.json(
        { error: "Pi Network token verification failed.", detail: errorText },
        { status: 401 }
      );
    }

    const piUser = await meRes.json();

    /*
     * Pi Platform /v2/me response shape:
     * {
     *   uid:      string   // Pi UID — used as wallet address / primary identifier
     *   username: string
     *   roles?:   string[]
     *   credentials?: { scopes: string[] }
     * }
     */
    const uid: string = piUser.uid ?? piUser.user?.uid ?? "";
    const username: string = piUser.username ?? piUser.user?.username ?? "";

    if (!uid) {
      return NextResponse.json(
        { error: "Pi Network returned an invalid user profile (missing uid)." },
        { status: 500 }
      );
    }

    // Return a LoginDTO-compatible shape that the auth context expects
    const loginDto = {
      id: uid,
      username,
      // wallet_address: Pi UID is the on-chain identifier
      wallet_address: uid,
      // app_id: use the Pi UID as the app-scoped id since we have no App Studio app id
      app_id: uid,
      credits_balance: 0,
      terms_accepted: true,
    };

    return NextResponse.json(loginDto, { status: 200 });
  } catch (err) {
    console.error("[PIS] /api/auth/login unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error during authentication." },
      { status: 500 }
    );
  }
}
