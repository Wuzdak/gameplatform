import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server authentication is not configured." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const token = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // getUser(token) already returns the verified user record, including ban status.
    // Avoid a second Auth Admin request for every active visitor.
    const bannedUntil = authData.user.banned_until;
    const isCurrentlyBanned =
      typeof bannedUntil === "string" &&
      Number.isFinite(Date.parse(bannedUntil)) &&
      Date.parse(bannedUntil) > Date.now();

    if (isCurrentlyBanned) {
      return NextResponse.json(
        { code: "account_blocked", message: "This account is blocked." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Account status check failed:", error);
    return NextResponse.json(
      { error: "Unable to verify account status." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
