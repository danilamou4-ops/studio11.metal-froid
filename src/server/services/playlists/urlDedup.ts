import { createHash } from "crypto";

const SPOTIFY_PLAYLIST_ID_REGEX = /playlist\/([a-zA-Z0-9]+)/;

// ─── Types ────────────────────────────────────────────────────────────────────

export type Platform = "spotify" | "deezer" | "apple_music" | "youtube_music" | "soundcloud" | "napster" | "other";

export type PlaylistDuplicateCandidate = {
  id: string;
  name: string | null;
  spotify_playlist_id: string | null;
  spotify_url: string;
  spotify_url_normalized: string | null;
  spotify_url_fingerprint: string | null;
  // Migration 015 fields (may be null for older rows)
  platform?: Platform | null;
  platform_url?: string | null;
  platform_url_fingerprint?: string | null;
  contribution_status: string | null;
  is_active: boolean | null;
};

export type DuplicateDetectionResult = {
  hasExactDuplicate: boolean;
  hasNearDuplicate: boolean;
  duplicateConflict: boolean;
  reasons: string[];
  matchedPlaylistId: string | null;
};

// ─── Platform detection ───────────────────────────────────────────────────────

const PLATFORM_PATTERNS: Array<{ platform: Platform; regex: RegExp }> = [
  { platform: "spotify", regex: /open\.spotify\.com/i },
  { platform: "deezer", regex: /deezer\.com/i },
  { platform: "apple_music", regex: /music\.apple\.com/i },
  { platform: "youtube_music", regex: /music\.youtube\.com|youtube\.com\/playlist/i },
  { platform: "soundcloud", regex: /soundcloud\.com/i },
  { platform: "napster", regex: /napster\.com/i },
];

export function detectPlatform(url: string): Platform {
  for (const { platform, regex } of PLATFORM_PATTERNS) {
    if (regex.test(url)) return platform;
  }
  return "other";
}

// ─── Spotify helpers (kept for backward compat) ───────────────────────────────

export function extractSpotifyPlaylistId(url: string): string | null {
  const match = url.match(SPOTIFY_PLAYLIST_ID_REGEX);
  return match?.[1] ?? null;
}

export function normalizeSpotifyPlaylistUrl(url: string): string | null {
  const playlistId = extractSpotifyPlaylistId(url);
  if (!playlistId) {
    return null;
  }

  return `https://open.spotify.com/playlist/${playlistId}`;
}

export function buildSpotifyUrlFingerprint(normalizedUrl: string): string {
  return createHash("md5").update(normalizedUrl).digest("hex");
}

// ─── Generic platform URL normalization ──────────────────────────────────────

/**
 * Normalise une URL de playlist quelle que soit la plateforme.
 * - Spotify : extrait l'ID et reconstruit l'URL canonique
 * - Deezer, Apple Music, YouTube, SoundCloud : supprime les params de tracking
 * - Autre : supprime fragment + trailing slash
 */
export function normalizePlatformUrl(url: string): string {
  const platform = detectPlatform(url);

  if (platform === "spotify") {
    return normalizeSpotifyPlaylistUrl(url) ?? url;
  }

  try {
    const parsed = new URL(url);
    // Supprimer les paramètres de tracking communs
    const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "si", "app"];
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function buildPlatformUrlFingerprint(normalizedUrl: string): string {
  return createHash("md5").update(normalizedUrl).digest("hex");
}

// ─── Levenshtein ─────────────────────────────────────────────────────────────

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let i = 0; i < left.length; i += 1) {
    current[0] = i + 1;
    for (let j = 0; j < right.length; j += 1) {
      const substitutionCost = left[i] === right[j] ? 0 : 1;
      current[j + 1] = Math.min(
        current[j] + 1,
        previous[j + 1] + 1,
        previous[j] + substitutionCost,
      );
    }

    for (let j = 0; j < previous.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
}

export function normalizedEditDistance(left: string, right: string) {
  if (!left && !right) return 0;
  const distance = levenshteinDistance(left, right);
  return distance / Math.max(left.length, right.length, 1);
}

// ─── Duplicate detection (platform-aware) ────────────────────────────────────

export function detectPlaylistDuplicates(input: {
  spotifyPlaylistId: string;
  normalizedUrl: string;
  fingerprint: string;
  candidates: PlaylistDuplicateCandidate[];
  excludePlaylistId?: string | null;
}): DuplicateDetectionResult {
  const reasons: string[] = [];
  let matchedPlaylistId: string | null = null;
  let hasExactDuplicate = false;
  let hasNearDuplicate = false;

  for (const candidate of input.candidates) {
    if (input.excludePlaylistId && candidate.id === input.excludePlaylistId) {
      continue;
    }

    // Prefer migration-015 fields when available; fall back to Spotify-specific columns
    const candidateNormalizedUrl =
      candidate.platform_url
        ? normalizePlatformUrl(candidate.platform_url)
        : (candidate.spotify_url_normalized ?? normalizeSpotifyPlaylistUrl(candidate.spotify_url));

    const candidateFingerprint =
      candidate.platform_url_fingerprint
        ?? candidate.spotify_url_fingerprint
        ?? (candidateNormalizedUrl ? buildPlatformUrlFingerprint(candidateNormalizedUrl) : null);

    const isExactDuplicate =
      candidate.spotify_playlist_id === input.spotifyPlaylistId ||
      candidateNormalizedUrl === input.normalizedUrl ||
      candidateFingerprint === input.fingerprint;

    if (isExactDuplicate) {
      hasExactDuplicate = true;
      matchedPlaylistId = candidate.id;
      reasons.push(
        `Doublon exact detecte avec la playlist existante ${candidate.name ?? candidate.id}.`,
      );
      break;
    }

    if (candidateNormalizedUrl) {
      const distance = normalizedEditDistance(candidateNormalizedUrl, input.normalizedUrl);
      if (distance <= 0.05) {
        hasNearDuplicate = true;
        matchedPlaylistId = candidate.id;
        reasons.push(
          `Quasi-doublon detecte avec ${candidate.name ?? candidate.id} (distance URL normalisee ${distance.toFixed(3)}).`,
        );
        break;
      }
    }
  }

  return {
    hasExactDuplicate,
    hasNearDuplicate,
    duplicateConflict: hasExactDuplicate || hasNearDuplicate,
    reasons,
    matchedPlaylistId,
  };
}