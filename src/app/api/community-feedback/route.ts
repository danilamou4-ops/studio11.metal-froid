import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/route-auth";
import { computeFeedbackSignals } from "@/features/community-feedback/feedback-utils";

type CommunityFeedbackRow = {
  id: string;
  vote: number | null;
  review_text: string | null;
};

const feedbackSchema = z
  .object({
    target_type: z.enum(["playlist", "curator", "contributor"]),
    target_id: z.string().uuid(),
    vote: z.union([z.literal(1), z.literal(-1)]).optional(),
    review_text: z.string().trim().max(500).optional(),
    search_run_id: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.vote == null && !value.review_text) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide vote and/or review_text.",
      });
    }
  });

function applyTargetFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  targetType: "playlist" | "curator" | "contributor",
  targetId: string,
) {
  if (targetType === "playlist") return query.eq("playlist_id", targetId);
  if (targetType === "curator") return query.eq("curator_id", targetId);
  return query.eq("contributor_user_id", targetId);
}

async function syncPlaylistFeedbackSignals(supabase: ReturnType<typeof createAdminClient>, playlistId: string) {
  const { data: rows, error: feedbackError } = await supabase
    .from("community_feedback")
    .select("id,vote,review_text")
    .eq("playlist_id", playlistId);

  if (feedbackError) {
    console.error("Failed to aggregate playlist feedback signals:", feedbackError.message);
    return;
  }

  const signals = computeFeedbackSignals((rows ?? []) as CommunityFeedbackRow[]);
  const { data: playlistRow, error: playlistError } = await supabase
    .from("playlists")
    .select("quality_gate_snapshot")
    .eq("id", playlistId)
    .maybeSingle();

  if (playlistError) {
    console.error("Failed to read playlist quality snapshot:", playlistError.message);
    return;
  }

  const currentSnapshot = playlistRow?.quality_gate_snapshot && typeof playlistRow.quality_gate_snapshot === "object"
    ? playlistRow.quality_gate_snapshot
    : {};

  const nextSnapshot = {
    ...currentSnapshot,
    community_feedback: signals,
  };

  const { error: updateError } = await supabase
    .from("playlists")
    .update({ quality_gate_snapshot: nextSnapshot })
    .eq("id", playlistId);

  if (updateError) {
    console.error("Failed to persist playlist feedback signals:", updateError.message);
  }
}

export async function GET(request: Request) {
  try {
    const { user } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("targetType");
    const targetId = searchParams.get("targetId");
    const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 200);

    const supabase = createAdminClient();
    let query = supabase
      .from("community_feedback")
      .select("id,playlist_id,curator_id,contributor_user_id,vote,review_text,created_by,created_at")
      .order("created_at", { ascending: false })
      .limit(Number.isNaN(limit) ? 100 : limit);

    if (targetType && targetId && ["playlist", "curator", "contributor"].includes(targetType)) {
      query = applyTargetFilter(query, targetType as "playlist" | "curator" | "contributor", targetId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: "COMMUNITY_FEEDBACK_FETCH_FAILED", message: error.message } },
        { status: 500 },
      );
    }

    // Fetch current user's own vote for this target separately
    let userVote: number | null = null;
    if (targetType && targetId) {
      let ownQuery = supabase
        .from("community_feedback")
        .select("vote")
        .eq("created_by", user.id)
        .not("vote", "is", null)
        .limit(1);

      if (["playlist", "curator", "contributor"].includes(targetType)) {
        ownQuery = applyTargetFilter(ownQuery, targetType as "playlist" | "curator" | "contributor", targetId);
      }

      const { data: ownData } = await ownQuery.maybeSingle();
      userVote = ownData?.vote ?? null;
    }

    return NextResponse.json({ feedback: data ?? [], userVote });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "COMMUNITY_FEEDBACK_FETCH_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);

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

    const { user } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    const supabase = createAdminClient();

    const targetMap: Record<string, string> = {
      playlist: "playlist_id",
      curator: "curator_id",
      contributor: "contributor_user_id",
    };

    const columnName = targetMap[parsed.data.target_type];
    type FeedbackInsert = {
      vote: number | null;
      review_text: string | null;
      search_run_id: string | null;
      created_by: string;
      playlist_id: string | null;
      curator_id: string | null;
      contributor_user_id: string | null;
    };

    const insertData: FeedbackInsert = {
      vote: parsed.data.vote || null,
      review_text: parsed.data.review_text || null,
      search_run_id: parsed.data.search_run_id || null,
      created_by: user.id,
      playlist_id: null,
      curator_id: null,
      contributor_user_id: null,
    };

    // Type-safe column assignment
    if (columnName === "playlist_id") insertData.playlist_id = parsed.data.target_id;
    if (columnName === "curator_id") insertData.curator_id = parsed.data.target_id;
    if (columnName === "contributor_user_id") insertData.contributor_user_id = parsed.data.target_id;

    let voteRecord: unknown = null;
    let reviewRecord: unknown = null;

    if (parsed.data.vote != null) {
      let existingVoteQuery = supabase
        .from("community_feedback")
        .select("id,vote,review_text")
        .eq("created_by", user.id)
        .not("vote", "is", null)
        .is("review_text", null)
        .limit(1);

      existingVoteQuery = applyTargetFilter(existingVoteQuery, parsed.data.target_type, parsed.data.target_id);

      const { data: existingVote, error: existingVoteError } = await existingVoteQuery.maybeSingle();

      if (existingVoteError) {
        return NextResponse.json(
          { error: { code: "COMMUNITY_FEEDBACK_SAVE_FAILED", message: existingVoteError.message } },
          { status: 500 },
        );
      }

      if (existingVote && existingVote.vote === parsed.data.vote) {
        if (!parsed.data.review_text) {
          const { error: deleteError } = await supabase
            .from("community_feedback")
            .delete()
            .eq("id", existingVote.id);

          if (deleteError) {
            return NextResponse.json(
              { error: { code: "COMMUNITY_FEEDBACK_SAVE_FAILED", message: deleteError.message } },
              { status: 500 },
            );
          }
        } else {
          voteRecord = existingVote;
        }
      } else if (existingVote) {
        const { data: updatedVote, error: updateError } = await supabase
          .from("community_feedback")
          .update({ vote: parsed.data.vote })
          .eq("id", existingVote.id)
          .select("id,playlist_id,curator_id,contributor_user_id,vote,review_text,created_by,created_at")
          .single();

        if (updateError) {
          return NextResponse.json(
            { error: { code: "COMMUNITY_FEEDBACK_SAVE_FAILED", message: updateError.message } },
            { status: 500 },
          );
        }

        voteRecord = updatedVote;
      } else {
        const { data: insertedVote, error: insertVoteError } = await supabase
          .from("community_feedback")
          .insert({ ...insertData, review_text: null })
          .select("id,playlist_id,curator_id,contributor_user_id,vote,review_text,created_by,created_at")
          .single();

        if (insertVoteError) {
          return NextResponse.json(
            { error: { code: "COMMUNITY_FEEDBACK_SAVE_FAILED", message: insertVoteError.message } },
            { status: 500 },
          );
        }

        voteRecord = insertedVote;
      }
    }

    if (parsed.data.review_text) {
      const { data: insertedReview, error: insertReviewError } = await supabase
        .from("community_feedback")
        .insert({ ...insertData, vote: null, review_text: parsed.data.review_text })
        .select("id,playlist_id,curator_id,contributor_user_id,vote,review_text,created_by,created_at")
        .single();

      if (insertReviewError) {
        return NextResponse.json(
          { error: { code: "COMMUNITY_FEEDBACK_SAVE_FAILED", message: insertReviewError.message } },
          { status: 500 },
        );
      }

      reviewRecord = insertedReview;
    }

    if (parsed.data.target_type === "playlist") {
      await syncPlaylistFeedbackSignals(supabase, parsed.data.target_id);
    }

    return NextResponse.json({ ok: true, data: { vote: voteRecord, review: reviewRecord } });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "COMMUNITY_FEEDBACK_SAVE_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}
