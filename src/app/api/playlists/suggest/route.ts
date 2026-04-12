import { NextResponse } from "next/server";
import { z } from "zod";

import { enrichPlaylistById } from "@/lib/enrichment/enrichPlaylist";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGovernanceControlState } from "@/server/services/contribution/governanceControls";
import { logGovernanceTransition, updateContributionStatus } from "@/server/services/contribution/updateContributionStatus";
import {
  buildPlatformUrlFingerprint,
  buildSpotifyUrlFingerprint,
  detectPlatform,
  detectPlaylistDuplicates,
  extractSpotifyPlaylistId,
  normalizePlatformUrl,
  normalizeSpotifyPlaylistUrl,
  type PlaylistDuplicateCandidate,
} from "@/server/services/playlists/urlDedup";

const unitField = z.number().min(0).max(1).nullable().optional();
const nullableUrl = (message: string) =>
  z
    .preprocess((value) => (value === "" ? null : value), z.string().url(message).nullable().optional());

const requestSchema = z.object({
  playlistName: z.string().min(2),
  // playlistUrl est la clé canonique multi-platform ; spotifyUrl est conservé pour compat
  playlistUrl: nullableUrl("L'URL playlist doit etre une URL valide."),
  spotifyUrl: nullableUrl("L'URL Spotify doit etre une URL valide."),
  forceAddToExistingCurator: z.boolean().optional(),
  followers: z.number().int().min(0).nullable().optional(),
  genreLabel: z.preprocess(
    (value) => (value == null ? "" : value),
    z.string().trim().min(1, "Le genre est obligatoire."),
  ),
  country: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  contactUrl: nullableUrl("Le lien de contact doit etre une URL valide."),
  instagramUrl: nullableUrl("Le lien Instagram doit etre une URL valide."),
  email: z
    .preprocess((value) => (value === "" ? null : value), z.string().email().nullable().optional()),
  avgBpm: z.number().positive().nullable().optional(),
  avgEnergy: unitField,
  avgDanceability: unitField,
  avgValence: unitField,
  avgAcousticness: unitField,
  avgSpeechiness: unitField,
}).superRefine((value, ctx) => {
  const hasContact = Boolean(value.contactUrl || value.instagramUrl || value.email);
  if (!hasContact) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Au moins un contact est requis (contactUrl, instagramUrl ou email).",
      path: ["contactUrl"],
    });
  }
  const urlProvided = Boolean(value.playlistUrl || value.spotifyUrl);
  if (!urlProvided) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "L'URL de la playlist est obligatoire (playlistUrl ou spotifyUrl).",
      path: ["playlistUrl"],
    });
  }
});

type QualityGateInput = {
  playlistUrl: string;
  genreLabel: string;
  contactUrl: string | null;
  instagramUrl: string | null;
  email: string | null;
  qualityConfidence: number | null;
  duplicateReasons: string[];
};

function isNonEmpty(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function isValidUrl(value: string | null) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEmail(value: string | null) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function qualityGate(input: QualityGateInput): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];

  const hasContact = isNonEmpty(input.contactUrl) || isNonEmpty(input.instagramUrl) || isNonEmpty(input.email);
  const complete = isNonEmpty(input.playlistUrl) && isNonEmpty(input.genreLabel) && hasContact;

  if (!complete) {
    reasons.push("Completu de insuffisante: URL playlist, genre et au moins un contact sont obligatoires.");
  }

  reasons.push(...input.duplicateReasons);

  if (input.contactUrl && !isValidUrl(input.contactUrl)) {
    reasons.push("contactUrl invalide: URL non exploitable.");
  }
  if (input.instagramUrl && !isValidUrl(input.instagramUrl)) {
    reasons.push("instagramUrl invalide: URL non exploitable.");
  }
  if (input.email && !isValidEmail(input.email)) {
    reasons.push("email invalide: format non exploitable.");
  }

  if (input.qualityConfidence == null) {
    reasons.push("quality_confidence indisponible: enrichissement en attente.");
  } else if (input.qualityConfidence < 0.6) {
    reasons.push("quality_confidence inferieur au seuil minimum (0.60).");
  }

  return { pass: reasons.length === 0, reasons };
}
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "Payload invalide",
          },
        },
        { status: 400 },
      );
    }

    // Résoudre l'URL canonique (playlistUrl prioritaire, spotifyUrl comme fallback compat)
    const rawUrl = (parsed.data.playlistUrl ?? parsed.data.spotifyUrl ?? "").trim();
    const platform = detectPlatform(rawUrl);
    const normalizedPlatformUrl = normalizePlatformUrl(rawUrl);
    const platformUrlFingerprint = buildPlatformUrlFingerprint(normalizedPlatformUrl);

    // Champs Spotify-spécifiques (null pour les autres plateformes)
    const spotifyPlaylistId = platform === "spotify" ? extractSpotifyPlaylistId(rawUrl) : null;
    const normalizedSpotifyUrl = platform === "spotify" ? normalizeSpotifyPlaylistUrl(rawUrl) : null;
    const spotifyUrlFingerprint = normalizedSpotifyUrl ? buildSpotifyUrlFingerprint(normalizedSpotifyUrl) : null;

    if (platform === "spotify" && !spotifyPlaylistId) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PLAYLIST_URL",
            message: "URL Spotify invalide : impossible d'extraire l'ID de la playlist.",
          },
        },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const governanceControl = await getGovernanceControlState(supabase);

    if (governanceControl.contributions_suspended) {
      return NextResponse.json(
        {
          error: {
            code: "CONTRIBUTIONS_SUSPENDED",
            message:
              governanceControl.suspended_reason
              ?? "Les contributions playlist sont temporairement suspendues par l'administration.",
          },
        },
        { status: 503 },
      );
    }

    // Cherche une playlist existante par fingerprint générique (couvre Spotify + autres plateformes)
    const { data: existingPlaylist } = await supabase
      .from("playlists")
      .select("id,spotify_playlist_id,contribution_status,is_active,quality_confidence,spotify_url_normalized,spotify_url_fingerprint,platform_url_fingerprint")
      .eq("platform_url_fingerprint", platformUrlFingerprint)
      .maybeSingle();

    if (existingPlaylist?.is_active && existingPlaylist.contribution_status === "active") {
      return NextResponse.json(
        {
          error: {
            code: "DUPLICATE_PLAYLIST",
            message: "Cette playlist existe deja et est deja active.",
          },
        },
        { status: 409 },
      );
    }

    const { data: duplicateCandidates, error: duplicateCandidatesError } = await supabase
      .from("playlists")
      .select("id,name,spotify_playlist_id,spotify_url,spotify_url_normalized,spotify_url_fingerprint,platform_url,platform_url_fingerprint,contribution_status,is_active")
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
      spotifyPlaylistId: spotifyPlaylistId ?? "",
      normalizedUrl: normalizedPlatformUrl,
      fingerprint: platformUrlFingerprint,
      excludePlaylistId: existingPlaylist?.id ?? null,
      candidates: ((duplicateCandidates ?? []) as PlaylistDuplicateCandidate[]),
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

    const contactValue = parsed.data.contactUrl ?? parsed.data.instagramUrl ?? parsed.data.email ?? null;

    // Si le curateur existe déjà avec une autre plateforme, demander confirmation explicite.
    const forceAddToExistingCurator = parsed.data.forceAddToExistingCurator === true;
    let existingCurator:
      | {
          id: string;
          name: string | null;
          country: string | null;
          contact_url: string | null;
          instagram_url: string | null;
          email: string | null;
        }
      | null = null;
    let existingCuratorPlatforms: string[] = [];

    const lookupEmail = parsed.data.email?.trim() || null;
    const lookupInstagram = parsed.data.instagramUrl?.trim() || null;
    const lookupContactUrl = parsed.data.contactUrl?.trim() || null;

    if (lookupEmail) {
      const { data } = await supabase
        .from("curators")
        .select("id,name,country,contact_url,instagram_url,email")
        .eq("email", lookupEmail)
        .limit(1)
        .maybeSingle();
      if (data) existingCurator = data;
    }

    if (!existingCurator && lookupInstagram) {
      const { data } = await supabase
        .from("curators")
        .select("id,name,country,contact_url,instagram_url,email")
        .eq("instagram_url", lookupInstagram)
        .limit(1)
        .maybeSingle();
      if (data) existingCurator = data;
    }

    if (!existingCurator && lookupContactUrl) {
      const { data } = await supabase
        .from("curators")
        .select("id,name,country,contact_url,instagram_url,email")
        .eq("contact_url", lookupContactUrl)
        .limit(1)
        .maybeSingle();
      if (data) existingCurator = data;
    }

    if (existingCurator) {
      const { data: curatorPlaylists } = await supabase
        .from("playlists")
        .select("platform,platform_url")
        .eq("curator_id", existingCurator.id)
        .limit(50);

      const knownPlatforms = Array.from(
        new Set((curatorPlaylists ?? []).map((row) => row.platform).filter((value): value is string => typeof value === "string")),
      );
      existingCuratorPlatforms = knownPlatforms;

      const hasDifferentPlatform = knownPlatforms.some((value) => value !== platform);
      if (hasDifferentPlatform && !forceAddToExistingCurator) {
        return NextResponse.json(
          {
            error: {
              code: "CURATOR_HAS_OTHER_PLATFORM",
              message: "Ce curateur a deja une playlist. Ajouter comme nouvelle plateforme ?",
              details: {
                curatorId: existingCurator.id,
                curator: {
                  name: existingCurator.name,
                  country: existingCurator.country,
                  contactUrl: existingCurator.contact_url,
                  instagramUrl: existingCurator.instagram_url,
                  email: existingCurator.email,
                },
                existingPlatforms: knownPlatforms,
                requestedPlatform: platform,
              },
            },
          },
          { status: 409 },
        );
      }
    }

    const curatorPayload = {
      name: `${parsed.data.playlistName} (curateur)`,
      country: parsed.data.country ?? null,
      contact_url: contactValue,
      instagram_url: parsed.data.instagramUrl ?? null,
      email: parsed.data.email ?? null,
    };
    let curatorId = existingCurator?.id ?? null;

    if (!curatorId) {
      const { data: curatorData, error: curatorError } = await supabase
        .from("curators")
        .insert(curatorPayload)
        .select("id")
        .single();

      if (curatorError) {
        return NextResponse.json(
          {
            error: {
              code: "CURATOR_UPSERT_FAILED",
              message: curatorError.message,
            },
          },
          { status: 500 },
        );
      }

      curatorId = curatorData.id;
    }

    const { data: playlistData, error: playlistError } = await supabase
      .from("playlists")
      .upsert(
        {
          curator_id: curatorId,
          spotify_playlist_id: spotifyPlaylistId,
          spotify_url_normalized: normalizedSpotifyUrl,
          spotify_url_fingerprint: spotifyUrlFingerprint,
          platform: platform,
          platform_url: normalizedPlatformUrl,
          platform_url_fingerprint: platformUrlFingerprint,
          name: parsed.data.playlistName,
          spotify_url: rawUrl,
          followers: parsed.data.followers ?? null,
          description: parsed.data.description ?? null,
          genre_label: parsed.data.genreLabel ?? null,
          avg_bpm: parsed.data.avgBpm ?? null,
          avg_energy: parsed.data.avgEnergy ?? null,
          avg_danceability: parsed.data.avgDanceability ?? null,
          avg_valence: parsed.data.avgValence ?? null,
          avg_acousticness: parsed.data.avgAcousticness ?? null,
          avg_speechiness: parsed.data.avgSpeechiness ?? null,
          contribution_status: "draft",
          is_active: false,
          quality_review_queue: true,
          pending_enrichment: true,
        },
        { onConflict: "spotify_playlist_id" },
      )
      .select("id,spotify_playlist_id,quality_confidence,quality_gate_snapshot,spotify_url_normalized,spotify_url_fingerprint,platform_url_fingerprint")
      .single();

    if (playlistError) {
      if ((playlistError as { code?: string }).code === "23505") {
        return NextResponse.json(
          {
            error: {
              code: "DUPLICATE_PLAYLIST",
              message: "Une playlist avec la meme URL existe deja.",
            },
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: {
            code: "PLAYLIST_UPSERT_FAILED",
            message: playlistError.message,
          },
        },
        { status: 500 },
      );
    }

    // Enrichissement en arriere-plan pour alimenter quality_confidence si absent.
    if (playlistData?.id) {
      void enrichPlaylistById(playlistData.id);
    }

    const gate = qualityGate({
      playlistUrl: rawUrl,
      genreLabel: parsed.data.genreLabel,
      contactUrl: parsed.data.contactUrl ?? null,
      instagramUrl: parsed.data.instagramUrl ?? null,
      email: parsed.data.email ?? null,
      qualityConfidence: playlistData?.quality_confidence ?? existingPlaylist?.quality_confidence ?? null,
      duplicateReasons: duplicateCheck.reasons,
    });

    const awaitingEnrichment = (playlistData?.quality_confidence ?? existingPlaylist?.quality_confidence) == null;
    const currentSnapshot =
      playlistData?.quality_gate_snapshot && typeof playlistData.quality_gate_snapshot === "object"
        ? playlistData.quality_gate_snapshot
        : {};

    const nextSnapshot = {
      ...currentSnapshot,
      quality_gate: {
        pass: gate.pass,
        reasons: gate.reasons,
        awaiting_enrichment: awaitingEnrichment,
        evaluated_at: new Date().toISOString(),
      },
    };

    if (gate.pass) {
      const updated = await updateContributionStatus({
        supabase,
        playlistId: playlistData.id,
        status: "active",
        reviewedBy: null,
        reviewReason: null,
        extraUpdates: {
          quality_review_queue: false,
          quality_gate_snapshot: nextSnapshot,
        },
      });

      await logGovernanceTransition({
        supabase,
        playlistId: playlistData.id,
        action: "auto_approved",
        status: "active",
        triggeredBy: "system",
        actorUserId: null,
        reasons: gate.reasons,
      });

      return NextResponse.json({
        ok: true,
        playlistId: updated.id,
        status: "active",
        groupedWithExistingCurator: Boolean(existingCurator),
        existingCuratorPlatforms,
        qualityGate: gate,
      });
    }

    const updated = await updateContributionStatus({
      supabase,
      playlistId: playlistData.id,
      status: "draft",
      reviewedBy: null,
      reviewReason: gate.reasons.join(" | "),
      extraUpdates: {
        quality_review_queue: true,
        quality_gate_snapshot: nextSnapshot,
      },
    });

    await logGovernanceTransition({
      supabase,
      playlistId: playlistData.id,
      action: "sent_to_review",
      status: "draft",
      triggeredBy: "system",
      actorUserId: null,
      reasons: gate.reasons,
    });

    return NextResponse.json({
      ok: true,
      playlistId: updated.id,
      status: "pending_review",
      groupedWithExistingCurator: Boolean(existingCurator),
      existingCuratorPlatforms,
      qualityGate: gate,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "PLAYLIST_SUBMIT_FAILED",
          message: error instanceof Error ? error.message : "Erreur inconnue",
        },
      },
      { status: 500 },
    );
  }
}
