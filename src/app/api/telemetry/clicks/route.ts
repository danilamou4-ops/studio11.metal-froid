import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("click_events")
      .select("playlist_id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = Array.from(
      new Set((data ?? []).map((row: { playlist_id: string }) => row.playlist_id)),
    );
    return NextResponse.json({ playlistIds: ids });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load telemetry click IDs.",
      },
      { status: 500 },
    );
  }
}
