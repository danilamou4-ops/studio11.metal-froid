import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { markOverdueReviewAlerts } from "@/server/services/contribution/manualReviewSla";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    await markOverdueReviewAlerts(supabase);

    // Total active playlists
    const { count: playlists, error: e1 } = await supabase
      .from("playlists")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    // Playlists with audio embedding
    const { count: vectorized, error: e2 } = await supabase
      .from("playlists")
      .select("*", { count: "exact", head: true })
      .not("audio_embedding", "is", null);

    // Distinct curators among active playlists
    const { data: curatorRows, error: e3 } = await supabase
      .from("playlists")
      .select("curator_id")
      .eq("is_active", true);

    if (e1 ?? e2 ?? e3) {
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    const curators = new Set(
      (curatorRows ?? []).map((r) => r.curator_id).filter(Boolean),
    ).size;

    const { count: upvotes, error: e4 } = await supabase
      .from("community_feedback")
      .select("id", { count: "exact", head: true })
      .eq("vote", 1);

    const { count: downvotes, error: e5 } = await supabase
      .from("community_feedback")
      .select("id", { count: "exact", head: true })
      .eq("vote", -1);

    const { count: reviews, error: e6 } = await supabase
      .from("community_feedback")
      .select("id", { count: "exact", head: true })
      .not("review_text", "is", null);

    const { count: qualityTicketsOpen, error: e7 } = await supabase
      .from("quality_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_review", "escalated"]);

    const { data: playlistQualityRows, error: e8 } = await supabase
      .from("playlists")
      .select("id,quality_gate_snapshot")
      .eq("is_active", true)
      .limit(1000);

    const { count: borderlineQueue, error: e9 } = await supabase
      .from("playlists")
      .select("id", { count: "exact", head: true })
      .eq("contribution_status", "draft")
      .eq("quality_review_queue", true);

    const { count: overdueManualReviews, error: e10 } = await supabase
      .from("playlists")
      .select("id", { count: "exact", head: true })
      .eq("contribution_status", "draft")
      .eq("quality_review_queue", true)
      .lt("manual_review_due_at", new Date().toISOString());

    if (e4 ?? e5 ?? e6 ?? e7 ?? e8 ?? e9 ?? e10) {
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    let riskPlaylists = 0;
    for (const row of playlistQualityRows ?? []) {
      const snapshot = row.quality_gate_snapshot;
      if (!snapshot || typeof snapshot !== "object") continue;
      const communityFeedback = (snapshot as { community_feedback?: unknown }).community_feedback;
      if (!communityFeedback || typeof communityFeedback !== "object") continue;

      const typedSignals = communityFeedback as { total_votes?: number; downvotes?: number };
      const totalVotes = typedSignals.total_votes ?? 0;
      const downs = typedSignals.downvotes ?? 0;

      if (totalVotes >= 5 && downs / totalVotes > 0.4) {
        riskPlaylists += 1;
      }
    }

    const totalVotes = (upvotes ?? 0) + (downvotes ?? 0);
    const positiveRate = totalVotes > 0 ? (upvotes ?? 0) / totalVotes : 0;

    return NextResponse.json({
      playlists: playlists ?? 0,
      curators,
      vectorized: vectorized ?? 0,
      community: {
        upvotes: upvotes ?? 0,
        downvotes: downvotes ?? 0,
        reviews: reviews ?? 0,
        totalVotes,
        positiveRate: Number(positiveRate.toFixed(3)),
        riskPlaylists,
      },
      qualityTickets: {
        open: qualityTicketsOpen ?? 0,
      },
      governance: {
        borderlineQueue: borderlineQueue ?? 0,
        overdueManualReviews: overdueManualReviews ?? 0,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
