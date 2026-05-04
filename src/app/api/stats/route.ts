import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { markOverdueReviewAlerts } from "@/server/services/contribution/manualReviewSla";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    await markOverdueReviewAlerts(supabase);

    const [
      { count: playlists, error: e1 },
      { count: vectorized, error: e2 },
      { data: curatorRows, error: e3 },
      { count: upvotes, error: e4 },
      { count: downvotes, error: e5 },
      { count: reviews, error: e6 },
      { count: qualityTicketsOpen, error: e7 },
      { data: playlistQualityRows, error: e8 },
      { count: borderlineQueue, error: e9 },
      { count: overdueManualReviews, error: e10 },
    ] = await Promise.all([
      // Total active playlists
      supabase.from("playlists").select("*", { count: "exact", head: true }).eq("is_active", true),
      // Playlists with audio embedding
      supabase.from("playlists").select("*", { count: "exact", head: true }).not("audio_embedding", "is", null),
      // Distinct curators among active playlists
      supabase.from("playlists").select("curator_id").eq("is_active", true),
      // Community votes
      supabase.from("community_feedback").select("id", { count: "exact", head: true }).eq("vote", 1),
      supabase.from("community_feedback").select("id", { count: "exact", head: true }).eq("vote", -1),
      supabase.from("community_feedback").select("id", { count: "exact", head: true }).not("review_text", "is", null),
      // Quality tickets
      supabase.from("quality_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_review", "escalated"]),
      // Quality gate snapshots
      supabase.from("playlists").select("id,quality_gate_snapshot").eq("is_active", true).limit(1000),
      // Governance queues
      supabase.from("playlists").select("id", { count: "exact", head: true }).eq("contribution_status", "draft").eq("quality_review_queue", true),
      supabase.from("playlists").select("id", { count: "exact", head: true }).eq("contribution_status", "draft").eq("quality_review_queue", true).lt("manual_review_due_at", new Date().toISOString()),
    ]);

    if (e1 ?? e2 ?? e3 ?? e4 ?? e5 ?? e6 ?? e7 ?? e8 ?? e9 ?? e10) {
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    const curators = new Set(
      (curatorRows ?? []).map((r) => r.curator_id).filter(Boolean),
    ).size;

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
