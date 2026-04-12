import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser, getUserTeamRole } from "@/lib/auth/route-auth";
import { markOverdueReviewAlerts } from "@/server/services/contribution/manualReviewSla";
import { logGovernanceTransition, updateContributionStatus } from "@/server/services/contribution/updateContributionStatus";
import {
  buildSpotifyUrlFingerprint,
  detectPlaylistDuplicates,
  extractSpotifyPlaylistId,
  normalizeSpotifyPlaylistUrl,
  type PlaylistDuplicateCandidate,
} from "@/server/services/playlists/urlDedup";

const statusSchema = z.object({
  playlistId: z.string().uuid(),
  newStatus: z.enum(["draft", "active", "rejected", "archived"]),
  notes: z.string().trim().max(500).optional(),
});

const detailsSchema = z
  .object({
    playlistId: z.string().uuid(),
    name: z.string().trim().min(2).max(200).optional(),
    spotifyUrl: z.string().url().optional(),
    genreLabel: z.string().trim().min(1).max(120).nullable().optional(),
    followers: z.number().int().min(0).nullable().optional(),
    description: z.string().trim().max(4000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasAtLeastOneField =
      value.name !== undefined
      || value.spotifyUrl !== undefined
      || value.genreLabel !== undefined
      || value.followers !== undefined
      || value.description !== undefined;

    if (!hasAtLeastOneField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Au moins un champ doit etre fourni.",
        path: ["name"],
      });
    }
  });

function mapGovernanceAction(status: "draft" | "active" | "rejected" | "archived") {
  if (status === "active") return "admin_approved" as const;
  if (status === "rejected") return "admin_rejected" as const;
  if (status === "archived") return "admin_archived" as const;
  return "admin_restored" as const;
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

    const role = await getUserTeamRole(user.id, user.email ?? null);

    if (role !== "admin") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin role required." } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const queue = searchParams.get("queue");

    const supabase = createAdminClient();
    await markOverdueReviewAlerts(supabase);

    let query = supabase
      .from("playlists")
      .select("id,name,spotify_url,spotify_playlist_id,genre_label,followers,description,contribution_status,submitted_by,reviewed_by,quality_confidence,quality_gate_snapshot,quality_review_queue,is_active,review_reason,updated_at,manual_review_due_at,manual_review_alerted_at")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (status && ["draft", "active", "rejected", "archived"].includes(status)) {
      query = query.eq("contribution_status", status);
    }

    if (queue === "borderline") {
      query = query.eq("contribution_status", "draft").eq("quality_review_queue", true);
    }

    if (queue === "overdue") {
      query = query
        .eq("contribution_status", "draft")
        .eq("quality_review_queue", true)
        .lt("manual_review_due_at", new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: "CONTRIBUTION_QUEUE_FETCH_FAILED", message: error.message } },
        { status: 500 },
      );
    }

    const playlistRows = data ?? [];
    const playlistIds = playlistRows.map((playlist) => playlist.id);
    const openTicketCountByPlaylist = new Map<string, number>();

    if (playlistIds.length > 0) {
      const { data: ticketRows, error: ticketError } = await supabase
        .from('quality_tickets')
        .select('playlist_id,status')
        .in('playlist_id', playlistIds)
        .in('status', ['open', 'in_review', 'escalated']);

      if (ticketError) {
        return NextResponse.json(
          { error: { code: 'CONTRIBUTION_QUEUE_FETCH_FAILED', message: ticketError.message } },
          { status: 500 },
        );
      }

      for (const ticket of ticketRows ?? []) {
        const key = ticket.playlist_id as string;
        openTicketCountByPlaylist.set(key, (openTicketCountByPlaylist.get(key) ?? 0) + 1);
      }
    }

    const nowMs = Date.now();
    const enrichedRows = playlistRows
      .map((playlist) => ({
        ...playlist,
        open_ticket_count: openTicketCountByPlaylist.get(playlist.id) ?? 0,
      }))
      .sort((left, right) => {
        const leftOverdue = left.manual_review_due_at ? new Date(left.manual_review_due_at).getTime() < nowMs : false;
        const rightOverdue = right.manual_review_due_at ? new Date(right.manual_review_due_at).getTime() < nowMs : false;

        if (leftOverdue !== rightOverdue) {
          return leftOverdue ? -1 : 1;
        }

        if ((left.open_ticket_count ?? 0) !== (right.open_ticket_count ?? 0)) {
          return (right.open_ticket_count ?? 0) - (left.open_ticket_count ?? 0);
        }

        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      });

    return NextResponse.json({ playlists: enrichedRows, userRole: role, queue: queue ?? null });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "CONTRIBUTION_QUEUE_FETCH_FAILED",
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
    const parsed = statusSchema.safeParse(body);

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

    const role = await getUserTeamRole(user.id, user.email ?? null);

    if (role !== "admin") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin role required." } },
        { status: 403 },
      );
    }

    const supabase = createAdminClient();
    let data;
    try {
      data = await updateContributionStatus({
        supabase,
        playlistId: parsed.data.playlistId,
        status: parsed.data.newStatus,
        reviewedBy: user.id,
        reviewReason: parsed.data.notes ?? null,
        extraUpdates: {
          quality_review_queue: parsed.data.newStatus === "draft",
        },
      });
    } catch (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "PLAYLIST_STATUS_UPDATE_FAILED",
            message: updateError instanceof Error ? updateError.message : "Unknown error",
          },
        },
        { status: 500 },
      );
    }

    const governanceAction = mapGovernanceAction(parsed.data.newStatus);

    try {
      await logGovernanceTransition({
        supabase,
        playlistId: parsed.data.playlistId,
        action: governanceAction,
        status: parsed.data.newStatus,
        triggeredBy: user.id,
        actorUserId: user.id,
        reasons: parsed.data.notes ? [parsed.data.notes] : [],
        note: parsed.data.notes ?? null,
      });
    } catch (governanceError) {
      return NextResponse.json(
        {
          error: {
            code: "PLAYLIST_STATUS_UPDATED_GOVERNANCE_LOG_FAILED",
            message: governanceError instanceof Error ? governanceError.message : "Unknown error",
          },
          data,
        },
        { status: 207 },
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "PLAYLIST_STATUS_UPDATE_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = detailsSchema.safeParse(body);

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

    const role = await getUserTeamRole(user.id, user.email ?? null);

    if (role !== "admin") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin role required." } },
        { status: 403 },
      );
    }

    const supabase = createAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from("playlists")
      .select("id,contribution_status,spotify_playlist_id,spotify_url,spotify_url_normalized,spotify_url_fingerprint")
      .eq("id", parsed.data.playlistId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error: {
            code: "PLAYLIST_DETAILS_UPDATE_FAILED",
            message: existingError.message,
          },
        },
        { status: 500 },
      );
    }

    if (!existing) {
      return NextResponse.json(
        {
          error: {
            code: "PLAYLIST_NOT_FOUND",
            message: "Playlist introuvable.",
          },
        },
        { status: 404 },
      );
    }

    if (existing.contribution_status !== "draft") {
      return NextResponse.json(
        {
          error: {
            code: "PLAYLIST_NOT_PENDING_REVIEW",
            message: "Seules les playlists en attente peuvent etre modifiees.",
          },
        },
        { status: 409 },
      );
    }

    const updates: Record<string, string | number | null> = {};

    if (parsed.data.name !== undefined) {
      updates.name = parsed.data.name;
    }

    if (parsed.data.genreLabel !== undefined) {
      updates.genre_label = parsed.data.genreLabel;
    }

    if (parsed.data.followers !== undefined) {
      updates.followers = parsed.data.followers;
    }

    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description;
    }

    if (parsed.data.spotifyUrl !== undefined) {
      const spotifyPlaylistId = extractSpotifyPlaylistId(parsed.data.spotifyUrl);
      const normalizedSpotifyUrl = normalizeSpotifyPlaylistUrl(parsed.data.spotifyUrl);

      if (!spotifyPlaylistId || !normalizedSpotifyUrl) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_SPOTIFY_URL",
              message: "URL playlist invalide ou non normalisable.",
            },
          },
          { status: 400 },
        );
      }

      const spotifyUrlFingerprint = buildSpotifyUrlFingerprint(normalizedSpotifyUrl);

      const { data: duplicateCandidates, error: duplicateCandidatesError } = await supabase
        .from("playlists")
        .select("id,name,spotify_playlist_id,spotify_url,spotify_url_normalized,spotify_url_fingerprint,contribution_status,is_active")
        .limit(1000);

      if (duplicateCandidatesError) {
        return NextResponse.json(
          {
            error: {
              code: "DUPLICATE_CHECK_FAILED",
              message: duplicateCandidatesError.message,
            },
          },
          { status: 500 },
        );
      }

      const duplicateCheck = detectPlaylistDuplicates({
        spotifyPlaylistId,
        normalizedUrl: normalizedSpotifyUrl,
        fingerprint: spotifyUrlFingerprint,
        excludePlaylistId: existing.id,
        candidates: (duplicateCandidates ?? []) as PlaylistDuplicateCandidate[],
      });

      if (duplicateCheck.duplicateConflict) {
        return NextResponse.json(
          {
            error: {
              code: duplicateCheck.hasExactDuplicate ? "DUPLICATE_PLAYLIST" : "NEAR_DUPLICATE_PLAYLIST",
              message: duplicateCheck.reasons[0] ?? "Doublon playlist detecte.",
              details: {
                matchedPlaylistId: duplicateCheck.matchedPlaylistId,
                exact: duplicateCheck.hasExactDuplicate,
              },
            },
          },
          { status: 409 },
        );
      }

      updates.spotify_url = parsed.data.spotifyUrl;
      updates.spotify_playlist_id = spotifyPlaylistId;
      updates.spotify_url_normalized = normalizedSpotifyUrl;
      updates.spotify_url_fingerprint = spotifyUrlFingerprint;
    }

    const { data, error } = await supabase
      .from("playlists")
      .update(updates)
      .eq("id", parsed.data.playlistId)
      .select("id,name,spotify_url,spotify_playlist_id,genre_label,followers,description,contribution_status,quality_review_queue,updated_at")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json(
          {
            error: {
              code: "DUPLICATE_PLAYLIST",
              message: "Une playlist avec la meme URL normalisee existe deja.",
            },
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: {
            code: "PLAYLIST_DETAILS_UPDATE_FAILED",
            message: error.message,
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "PLAYLIST_DETAILS_UPDATE_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}
