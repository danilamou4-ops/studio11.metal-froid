import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

const clickSchema = z.object({
  playlistId: z.string().uuid(),
  clickedUrl: z.string().url(),
  searchRunId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = clickSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "Invalid payload",
          },
        },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { error } = await supabase.from("click_events").insert({
      search_run_id: parsed.data.searchRunId ?? null,
      playlist_id: parsed.data.playlistId,
      user_id: null,
      clicked_url: parsed.data.clickedUrl,
    });

    if (error) {
      return NextResponse.json(
        {
          error: {
            code: "CLICK_TELEMETRY_FAILED",
            message: error.message,
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "CLICK_TELEMETRY_FAILED",
          message: "Unable to record click event.",
        },
      },
      { status: 500 },
    );
  }
}
