import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CuratorRow = {
  id: string;
  name: string | null;
  country: string | null;
  contact_url: string | null;
  instagram_url: string | null;
  email: string | null;
};

type PlaylistRow = {
  id: string;
  name: string;
  platform: string | null;
  platform_url: string | null;
  spotify_url: string;
  description: string | null;
  genre_label: string | null;
  followers: number | null;
  contribution_status: string | null;
  quality_confidence: number | null;
  quality_gate_snapshot: Record<string, unknown> | null;
  curator: CuratorRow | CuratorRow[] | null;
};

function extractFeedbackSignals(snapshot: Record<string, unknown> | null) {
  const communityFeedback = snapshot?.community_feedback;

  if (!communityFeedback || typeof communityFeedback !== "object") {
    return null;
  }

  const signals = communityFeedback as {
    upvotes?: number;
    downvotes?: number;
    reviews?: number;
    sentiment_score?: number;
  };

  return {
    upvotes: signals.upvotes ?? 0,
    downvotes: signals.downvotes ?? 0,
    reviews: signals.reviews ?? 0,
    sentimentScore: signals.sentiment_score ?? 0,
  };
}

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("playlists")
      .select(
        "id,name,platform,platform_url,spotify_url,description,genre_label,followers,contribution_status,quality_confidence,quality_gate_snapshot,curator:curators(id,name,country,contact_url,instagram_url,email)",
      )
      .eq("is_active", true)
      .order("followers", { ascending: false, nullsFirst: false })
      .limit(500);

    if (error) {
      return NextResponse.json(
        { error: { code: "PLAYLISTS_FETCH_FAILED", message: error.message } },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as PlaylistRow[];

    // Group by (curator_id, normalized title) to merge multi-platform entries into one card
    type GroupEntry = {
      primary: PlaylistRow;
      curator: CuratorRow | null;
      platforms: string[];
      platformUrls: string[];
    };

    const groupMap = new Map<string, GroupEntry>();

    for (const row of rows) {
      const curator = Array.isArray(row.curator) ? (row.curator[0] ?? null) : (row.curator ?? null);
      const key = `${curator?.id ?? "__no_curator"}:${row.name.trim().toLowerCase()}`;
      const platform = row.platform ?? "spotify";
      const url = row.platform_url ?? row.spotify_url;

      if (!groupMap.has(key)) {
        groupMap.set(key, { primary: row, curator, platforms: [platform], platformUrls: [url] });
      } else {
        const entry = groupMap.get(key)!;
        if (!entry.platforms.includes(platform)) {
          entry.platforms.push(platform);
          entry.platformUrls.push(url);
        }
      }
    }

    const results = Array.from(groupMap.values()).map(({ primary: row, curator, platforms, platformUrls }) => ({
      playlistId: row.id,
      playlistName: row.name,
      playlistUrl: platformUrls[0] ?? row.spotify_url,
      platforms,
      platformUrls,
      description: row.description,
      genreLabel: row.genre_label,
      followers: row.followers,
      curatorId: curator?.id ?? null,
      curatorName: curator?.name ?? null,
      curatorCountry: curator?.country ?? null,
      curatorContactUrl: curator?.contact_url ?? null,
      curatorInstagramUrl: curator?.instagram_url ?? null,
      curatorEmail: curator?.email ?? null,
      contribution_status: (row.contribution_status as "draft" | "active" | "rejected" | "archived") ?? null,
      quality_confidence: row.quality_confidence,
      feedbackSignals: extractFeedbackSignals(row.quality_gate_snapshot),
    }));

    return NextResponse.json({
      data: {
        total: results.length,
        results,
      },
      meta: {
        partial: false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "PLAYLISTS_FETCH_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}
