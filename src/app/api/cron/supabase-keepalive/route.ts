import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hasValidCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${secret}`) {
    return true;
  }

  // Handy for manual checks with curl/Postman.
  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Missing CRON_SECRET" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!hasValidCronSecret(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("governance_controls").select("id").limit(1);

    if (error) {
      console.error("Supabase keepalive ping failed", error);
      return NextResponse.json(
        { ok: false, error: "Supabase ping failed" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        source: "vercel-cron",
        pingedAt: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Unexpected keepalive error", error);
    return NextResponse.json(
      { ok: false, error: "Unexpected error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
