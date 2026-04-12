import type { CanonicalAudioFeatures } from "@/features/audio-features/types";
import { findClosestPresetForFeatures, findGenrePreset, type GenreAudioTemplate } from "@/features/scoring/genrePresets";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── BPM normalisation (identique à la migration SQL) ────────────────────────
const BPM_MIN = 60;
const BPM_RANGE = 140; // 60–200 BPM → [0, 1]

/**
 * Construit le vecteur de requête à partir des features audio.
 * Retourne null si moins de 4 des 6 dimensions sont disponibles.
 */
function buildQueryVector(features: CanonicalAudioFeatures): number[] | null {
  const bpmNorm =
    features.bpm != null
      ? Math.max(0, Math.min(1, (features.bpm - BPM_MIN) / BPM_RANGE))
      : null;

  const dims = [
    bpmNorm,
    features.energy ?? null,
    features.danceability ?? null,
    features.valence ?? null,
    features.acousticness ?? null,
    features.speechiness ?? null,
  ];

  const defined = dims.filter((d) => d !== null).length;
  if (defined < 4) return null;

  // Remplacer les dimensions manquantes par 0.5 (valeur neutre)
  return dims.map((d) => d ?? 0.5);
}

type PlaylistRow = {
  id: string;
  name: string;
  platform_url: string;
  platforms: string[] | null;
  platform_urls: string[] | null;
  description: string | null;
  genre_label: string | null;
  followers: number | null;
  avg_bpm: number | null;
  avg_energy: number | null;
  avg_danceability: number | null;
  avg_valence: number | null;
  avg_acousticness: number | null;
  avg_speechiness: number | null;
  tags: string[] | null;
  artist_genres: string[] | null;
  curator_name: string | null;
  curator_country: string | null;
  curator_contact_url: string | null;
  curator_instagram_url: string | null;
  curator_email: string | null;
};

type CuratorViewRow = {
  primary_playlist_id: string;
  playlist_name: string;
  max_followers: number | null;
  platforms: string[] | null;
  platform_urls: string[] | null;
  description: string | null;
  genre_label: string | null;
  avg_bpm: number | null;
  avg_energy: number | null;
  avg_danceability: number | null;
  avg_valence: number | null;
  avg_acousticness: number | null;
  avg_speechiness: number | null;
  audio_embedding: unknown | null;
  tags: unknown | null;
  artist_genres: unknown | null;
  curator_name: string | null;
  curator_country: string | null;
  curator_contact_url: string | null;
  curator_instagram_url: string | null;
  curator_email: string | null;
};

type FeedbackSignals = {
  upvotes: number;
  downvotes: number;
  reviews: number;
  sentimentScore: number;
};

/** Ligne retournée par la RPC match_playlists_by_embedding */
type VectorPlaylistRow = {
  id: string;
  name: string;
  platform_url: string;
  platforms: string[] | null;
  platform_urls: string[] | null;
  description: string | null;
  genre_label: string | null;
  followers: number | null;
  avg_bpm: number | null;
  avg_energy: number | null;
  avg_danceability: number | null;
  avg_valence: number | null;
  avg_acousticness: number | null;
  avg_speechiness: number | null;
  tags: unknown | null;
  artist_genres: unknown | null;
  curator_name: string | null;
  curator_country: string | null;
  curator_contact_url: string | null;
  curator_instagram_url: string | null;
  curator_email: string | null;
  cosine_distance: number;
};

const WEIGHTS = {
  bpm: 0.2,
  energy: 0.2,
  danceability: 0.2,
  valence: 0.15,
  acousticness: 0.15,
  speechiness: 0.1,
};

function unitSimilarity(a: number, b: number): number {
  return Math.max(0, 1 - Math.abs(a - b));
}

function bpmSimilarity(a: number, b: number): number {
  // 40 BPM difference => 0 similarity.
  return Math.max(0, 1 - Math.abs(a - b) / 40);
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function getGenreTemplate(genreLabel: string | null): GenreAudioTemplate | null {
  return findGenrePreset(genreLabel)?.template ?? null;
}

type ScoreMode = "direct" | "genre-template" | "popularity";

/** Score sémantique : overlap entre les aliases du genre détecté et les tags Last.fm de la playlist */
function tagOverlapScore(userAliases: string[], playlistTags: string[]): number {
  if (userAliases.length === 0 || playlistTags.length === 0) return 0;
  const corpus = playlistTags.map((t) => t.toLowerCase());
  let matches = 0;
  for (const alias of userAliases.slice(0, 8)) {
    const a = alias.toLowerCase();
    if (corpus.some((pt) => pt.includes(a) || a.includes(pt))) matches++;
  }
  return Math.min(1, (matches / Math.min(userAliases.length, 5)) * 1.5);
}

/**
 * Pénalise les playlists dont le corpus de tags est connu mais totalement incompatible
 * avec le genre détecté du morceau. Ex : classique sur playlist rap → 0.35
 */
function genreMismatchMultiplier(
  userPresetId: string | null,
  userAliases: string[],
  playlistTags: string[],
  tagScore: number,
): number {
  // Pas de données suffisantes → pas de pénalité
  if (!userPresetId || playlistTags.length < 3 || userAliases.length === 0) return 1;
  // Si même un tag colle, pas de pénalité
  if (tagScore > 0.05) return 1;

  // Tags rap/hip-hop dans la playlist
  const RAP_TAGS = /\b(rap|hip.?hop|trap|drill|boom.?bap|conscient|lyric|underground|grime|rnb|r&b)\b/i;
  const playlistIsRap = playlistTags.some((t) => RAP_TAGS.test(t));
  // Tags instrumentaux/classiques dans la playlist
  const INSTR_TAGS = /\b(classical|classique|piano|orchestral|ambient|acoustic|folk|jazz|guitar|instrumental)\b/i;
  const playlistIsInstrumental = playlistTags.some((t) => INSTR_TAGS.test(t));

  const userIsRap = ["rap-conscient", "rap-melancolique", "rap-underground", "hiphop-rap", "drill-trap"].includes(userPresetId);
  const userIsInstrumental = ["classique", "folk-acoustic", "ambient-post-rock", "indie-jazz-chill"].includes(userPresetId);

  // Classique / acoustique sur playlist rap → forte pénalité
  if (userIsInstrumental && playlistIsRap) return 0.30;
  // Rap sur playlist classique/instrumental → forte pénalité
  if (userIsRap && playlistIsInstrumental) return 0.30;

  return 1;
}

function scoreOne(
  features: CanonicalAudioFeatures,
  playlist: PlaylistRow,
  userPresetId: string | null,
  userPresetAliases: string[],
): {
  score: number;
  confidence: number;
  comparisons: Array<{ label: string; similarity: number }>;
  mode: ScoreMode;
} {
  let weightedScore = 0;
  let weightSum = 0;

  const comparisons: Array<{ label: string; similarity: number }> = [];

  const bpmInput = toNullableNumber(features.bpm);
  const bpmProfile = toNullableNumber(playlist.avg_bpm);
  if (bpmInput !== null && bpmProfile !== null) {
    const similarity = bpmSimilarity(bpmInput, bpmProfile);
    weightedScore += similarity * WEIGHTS.bpm;
    weightSum += WEIGHTS.bpm;
    comparisons.push({ label: "bpm", similarity });
  }

  const energyInput = toNullableNumber(features.energy);
  const energyProfile = toNullableNumber(playlist.avg_energy);
  if (energyInput !== null && energyProfile !== null) {
    const similarity = unitSimilarity(energyInput, energyProfile);
    weightedScore += similarity * WEIGHTS.energy;
    weightSum += WEIGHTS.energy;
    comparisons.push({ label: "energy", similarity });
  }

  const danceInput = toNullableNumber(features.danceability);
  const danceProfile = toNullableNumber(playlist.avg_danceability);
  if (danceInput !== null && danceProfile !== null) {
    const similarity = unitSimilarity(danceInput, danceProfile);
    weightedScore += similarity * WEIGHTS.danceability;
    weightSum += WEIGHTS.danceability;
    comparisons.push({ label: "danceability", similarity });
  }

  const valenceInput = toNullableNumber(features.valence);
  const valenceProfile = toNullableNumber(playlist.avg_valence);
  if (valenceInput !== null && valenceProfile !== null) {
    const similarity = unitSimilarity(valenceInput, valenceProfile);
    weightedScore += similarity * WEIGHTS.valence;
    weightSum += WEIGHTS.valence;
    comparisons.push({ label: "valence", similarity });
  }

  const acousticInput = toNullableNumber(features.acousticness);
  const acousticProfile = toNullableNumber(playlist.avg_acousticness);
  if (acousticInput !== null && acousticProfile !== null) {
    const similarity = unitSimilarity(acousticInput, acousticProfile);
    weightedScore += similarity * WEIGHTS.acousticness;
    weightSum += WEIGHTS.acousticness;
    comparisons.push({ label: "acousticness", similarity });
  }

  const speechInput = toNullableNumber(features.speechiness);
  const speechProfile = toNullableNumber(playlist.avg_speechiness);
  if (speechInput !== null && speechProfile !== null) {
    const similarity = unitSimilarity(speechInput, speechProfile);
    weightedScore += similarity * WEIGHTS.speechiness;
    weightSum += WEIGHTS.speechiness;
    comparisons.push({ label: "speechiness", similarity });
  }

  // Score sémantique via tags Last.fm
  const playlistTagCorpus = [...(playlist.artist_genres ?? []), ...(playlist.tags ?? [])];
  const tagScore = tagOverlapScore(userPresetAliases, playlistTagCorpus);
  const mismatch = genreMismatchMultiplier(userPresetId, userPresetAliases, playlistTagCorpus, tagScore);
  if (tagScore > 0) comparisons.push({ label: "genre", similarity: tagScore });

  if (weightSum === 0) {
    const template = getGenreTemplate(playlist.genre_label);

    if (template) {
      const templateComparisons: Array<{ label: string; similarity: number }> = [];
      let templateWeighted = 0;
      let templateWeightSum = 0;

      const withUnit = (
        label: keyof typeof WEIGHTS,
        input: number | null,
        profile: number,
      ) => {
        if (input === null) return;
        const similarity = label === "bpm" ? bpmSimilarity(input, profile) : unitSimilarity(input, profile);
        templateWeighted += similarity * WEIGHTS[label];
        templateWeightSum += WEIGHTS[label];
        templateComparisons.push({ label, similarity });
      };

      withUnit("bpm", toNullableNumber(features.bpm), template.bpm);
      withUnit("energy", toNullableNumber(features.energy), template.energy);
      withUnit("danceability", toNullableNumber(features.danceability), template.danceability);
      withUnit("valence", toNullableNumber(features.valence), template.valence);
      withUnit("acousticness", toNullableNumber(features.acousticness), template.acousticness);
      withUnit("speechiness", toNullableNumber(features.speechiness), template.speechiness);

      if (tagScore > 0) templateComparisons.push({ label: "genre", similarity: tagScore });

      const popularityBonus = Math.min(0.03, Math.log10((playlist.followers ?? 0) + 1) / 120);
      const scoreFromTemplate = templateWeightSum > 0 ? templateWeighted / templateWeightSum : 0;
      // Blend : 72% audio template + 23% tags Last.fm + 5% popularité
      const finalTemplateScore = (0.72 * scoreFromTemplate + 0.23 * tagScore + popularityBonus) * mismatch;

      return {
        score: Math.min(1, finalTemplateScore),
        confidence: Math.max(0.18, Math.min(0.35, templateWeightSum * 0.45)),
        comparisons: templateComparisons,
        mode: "genre-template" as ScoreMode,
      };
    }

    const genreMatch = playlist.genre_label?.toLowerCase().includes("rap") ? 0.1 : 0;
    const popScore = Math.min(0.12, Math.log10((playlist.followers ?? 0) + 1) / 50 + genreMatch);
    // Blend : 75% popularité/genre + 25% tags Last.fm, plafonné à 12%
    return {
      score: Math.min(0.12, (popScore * 0.75 + tagScore * 0.25) * mismatch),
      confidence: 0.08,
      comparisons,
      mode: "popularity" as ScoreMode,
    };
  }

  const baseScore = weightedScore / weightSum;
  const popularityBonus = Math.min(0.03, Math.log10((playlist.followers ?? 0) + 1) / 100);
  // Blend : 72% audio direct + 23% tags Last.fm + 5% popularité
  const finalScore = (0.72 * baseScore + 0.23 * tagScore + popularityBonus) * mismatch;

  return {
    score: Math.min(1, finalScore),
    confidence: weightSum,
    comparisons,
    mode: "direct" as ScoreMode,
  };
}

function extractFeedbackSignals(snapshot: Record<string, unknown> | null): FeedbackSignals | null {
  const feedback = snapshot?.community_feedback;

  if (!feedback || typeof feedback !== "object") {
    return null;
  }

  const payload = feedback as {
    upvotes?: number;
    downvotes?: number;
    reviews?: number;
    sentiment_score?: number;
  };

  return {
    upvotes: payload.upvotes ?? 0,
    downvotes: payload.downvotes ?? 0,
    reviews: payload.reviews ?? 0,
    sentimentScore: payload.sentiment_score ?? 0,
  };
}

async function hydrateTrustSignals<T extends {
  playlistId: string;
  qualityConfidence?: number | null;
  feedbackSignals?: FeedbackSignals | null;
}>(
  supabase: ReturnType<typeof createAdminClient>,
  results: T[],
): Promise<T[]> {
  if (results.length === 0) {
    return results;
  }

  const playlistIds = Array.from(new Set(results.map((result) => result.playlistId)));

  const { data: trustRows, error: trustError } = await supabase
    .from("playlists")
    .select("id,quality_confidence,quality_gate_snapshot")
    .in("id", playlistIds);

  if (trustError) {
    console.warn("Unable to hydrate trust signals on search results:", trustError.message);
    return results;
  }

  const trustMap = new Map<string, { qualityConfidence: number | null; feedbackSignals: FeedbackSignals | null }>();

  for (const row of trustRows ?? []) {
    const playlist = row as {
      id: string;
      quality_confidence: number | null;
      quality_gate_snapshot: Record<string, unknown> | null;
    };

    trustMap.set(playlist.id, {
      qualityConfidence: playlist.quality_confidence,
      feedbackSignals: extractFeedbackSignals(playlist.quality_gate_snapshot),
    });
  }

  return results.map((result) => {
    const trust = trustMap.get(result.playlistId);
    if (!trust) {
      return result;
    }

    return {
      ...result,
      qualityConfidence: trust.qualityConfidence,
      feedbackSignals: trust.feedbackSignals,
    } as T;
  });
}

// ─── Shape commune pour les résultats ─────────────────────────────────────────
function toRankedResult(
  row: {
    id: string; name: string; platform_url: string; description: string | null;
    platforms: string[] | null; platform_urls: string[] | null;
    genre_label: string | null; followers: number | null;
    curatorName: string | null; curatorCountry: string | null;
    curatorContactUrl: string | null; curatorInstagramUrl: string | null; curatorEmail: string | null;
  },
  scoring: { score: number; confidence: number; comparisons: Array<{ label: string; similarity: number }>; mode: ScoreMode },
) {
  return {
    playlistId: row.id,
    playlistName: row.name,
    playlistUrl: row.platform_url,
    platforms: row.platforms ?? ["spotify"],
    platformUrls: row.platform_urls ?? [row.platform_url],
    curatorName: row.curatorName,
    curatorCountry: row.curatorCountry,
    curatorContactUrl: row.curatorContactUrl,
    curatorInstagramUrl: row.curatorInstagramUrl,
    curatorEmail: row.curatorEmail,
    description: row.description,
    genreLabel: row.genre_label,
    followers: row.followers,
    score: Number((scoring.score * 100).toFixed(1)),
    confidence: Number(scoring.confidence.toFixed(2)),
    qualityConfidence: null,
    feedbackSignals: null,
    scoreMode: scoring.mode,
    matchedSignals: scoring.comparisons,
  };
}

export async function scorePlaylists(features: CanonicalAudioFeatures, limit = 20) {
  const supabase = createAdminClient();
  const queryVector = buildQueryVector(features);

  // Dériver le profil sémantique du morceau analysé (1 fois pour tous)
  const userPreset = findClosestPresetForFeatures(features);
  const userPresetId = userPreset?.id ?? null;
  const userPresetAliases = userPreset ? [userPreset.id, ...userPreset.aliases] : [];

  // ── Branche pgvector : au moins 4 features audio disponibles ────────────────
  if (queryVector) {
    // 1. Playlists avec embedding → cosine distance via RPC
    const { data: vectorData, error: vectorError } = await supabase.rpc(
      "match_playlists_by_embedding",
      { query_vector: queryVector, match_count: 500 },
    );
    if (vectorError) throw new Error(`RPC match_playlists_by_embedding: ${vectorError.message}`);

    const vectorRows = (vectorData ?? []) as VectorPlaylistRow[];

    // 2. Playlists sans embedding → fallback genre-template / popularity
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("playlists_by_curator")
      .select(
        "primary_playlist_id,playlist_name,max_followers,platforms,platform_urls,description,genre_label,avg_bpm,avg_energy,avg_danceability,avg_valence,avg_acousticness,avg_speechiness,audio_embedding,tags,artist_genres,curator_name,curator_country,curator_contact_url,curator_instagram_url,curator_email",
      )
      .is("audio_embedding", null)
      .order("max_followers", { ascending: false, nullsFirst: false })
      .limit(500);
    if (fallbackError) throw new Error(`Unable to read fallback playlists: ${fallbackError.message}`);

    const fallbackRows = ((fallbackData ?? []) as CuratorViewRow[]).map((row) => ({
      id: row.primary_playlist_id,
      name: row.playlist_name,
      platform_url: row.platform_urls?.[0] ?? "",
      platforms: row.platforms,
      platform_urls: row.platform_urls,
      description: row.description,
      genre_label: row.genre_label,
      followers: row.max_followers,
      avg_bpm: row.avg_bpm,
      avg_energy: row.avg_energy,
      avg_danceability: row.avg_danceability,
      avg_valence: row.avg_valence,
      avg_acousticness: row.avg_acousticness,
      avg_speechiness: row.avg_speechiness,
      tags: toStringArray(row.tags),
      artist_genres: toStringArray(row.artist_genres),
      curator_name: row.curator_name,
      curator_country: row.curator_country,
      curator_contact_url: row.curator_contact_url,
      curator_instagram_url: row.curator_instagram_url,
      curator_email: row.curator_email,
    }));

    // 3. Scorer les playlists vectorisées (mode "direct" cosine)
    const vectorRanked = vectorRows.map((row) => {
      // cosine_distance ∈ [0, 2], typiquement [0, 1] pour des vecteurs normalisés
      // audioScore = 1 - cosine_distance (0 = identique → score 1.0)
      const audioScore = Math.max(0, 1 - row.cosine_distance);

      const playlistTagCorpus = [...toStringArray(row.artist_genres), ...toStringArray(row.tags)];
      const tagScore = tagOverlapScore(userPresetAliases, playlistTagCorpus);
      const mismatch = genreMismatchMultiplier(userPresetId, userPresetAliases, playlistTagCorpus, tagScore);
      const popularityBonus = Math.min(0.03, Math.log10((row.followers ?? 0) + 1) / 100);

      const finalScore = (0.72 * audioScore + 0.23 * tagScore + popularityBonus) * mismatch;
      const comparisons: Array<{ label: string; similarity: number }> = [
        { label: "vector", similarity: audioScore },
        ...(tagScore > 0 ? [{ label: "genre", similarity: tagScore }] : []),
      ];

      return toRankedResult(
        {
          id: row.id, name: row.name, platform_url: row.platform_url,
          platforms: row.platforms, platform_urls: row.platform_urls,
          description: row.description, genre_label: row.genre_label, followers: row.followers,
          curatorName: row.curator_name, curatorCountry: row.curator_country,
          curatorContactUrl: row.curator_contact_url, curatorInstagramUrl: row.curator_instagram_url,
          curatorEmail: row.curator_email,
        },
        {
          score: Math.min(1, finalScore),
          confidence: 0.85 + audioScore * 0.15,
          comparisons,
          mode: "direct",
        },
      );
    });

    // 4. Scorer les playlists sans embedding (mode genre-template / popularity)
    const fallbackRanked = fallbackRows.map((playlist) => {
      const scoring = scoreOne(features, playlist, userPresetId, userPresetAliases);
      return toRankedResult(
        {
          id: playlist.id, name: playlist.name, platform_url: playlist.platform_url,
          platforms: playlist.platforms, platform_urls: playlist.platform_urls,
          description: playlist.description, genre_label: playlist.genre_label, followers: playlist.followers,
          curatorName: playlist.curator_name, curatorCountry: playlist.curator_country,
          curatorContactUrl: playlist.curator_contact_url, curatorInstagramUrl: playlist.curator_instagram_url,
          curatorEmail: playlist.curator_email,
        },
        scoring,
      );
    });

    const all = [...vectorRanked, ...fallbackRanked]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const hydratedResults = await hydrateTrustSignals(supabase, all);

    return {
      totalCandidates: vectorRows.length + fallbackRows.length,
      results: hydratedResults,
      scoreModeSummary: {
        direct: hydratedResults.filter((r) => r.scoreMode === "direct").length,
        "genre-template": hydratedResults.filter((r) => r.scoreMode === "genre-template").length,
        popularity: hydratedResults.filter((r) => r.scoreMode === "popularity").length,
      },
    };
  }

  // ── Branche legacy : pas assez de features audio (profile-only ou incomplet) ─
  const { data, error } = await supabase
    .from("playlists_by_curator")
    .select(
      "primary_playlist_id,playlist_name,max_followers,platforms,platform_urls,description,genre_label,avg_bpm,avg_energy,avg_danceability,avg_valence,avg_acousticness,avg_speechiness,tags,artist_genres,curator_name,curator_country,curator_contact_url,curator_instagram_url,curator_email",
    )
    .order("max_followers", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    throw new Error(`Unable to read playlists: ${error.message}`);
  }

  const rows = ((data ?? []) as CuratorViewRow[]).map((row) => ({
    id: row.primary_playlist_id,
    name: row.playlist_name,
    platform_url: row.platform_urls?.[0] ?? "",
    platforms: row.platforms,
    platform_urls: row.platform_urls,
    description: row.description,
    genre_label: row.genre_label,
    followers: row.max_followers,
    avg_bpm: row.avg_bpm,
    avg_energy: row.avg_energy,
    avg_danceability: row.avg_danceability,
    avg_valence: row.avg_valence,
    avg_acousticness: row.avg_acousticness,
    avg_speechiness: row.avg_speechiness,
    tags: toStringArray(row.tags),
    artist_genres: toStringArray(row.artist_genres),
    curator_name: row.curator_name,
    curator_country: row.curator_country,
    curator_contact_url: row.curator_contact_url,
    curator_instagram_url: row.curator_instagram_url,
    curator_email: row.curator_email,
  }));

  const ranked = rows
    .map((playlist) => {
      const scoring = scoreOne(features, playlist, userPresetId, userPresetAliases);
      return toRankedResult(
        {
          id: playlist.id, name: playlist.name, platform_url: playlist.platform_url,
          platforms: playlist.platforms, platform_urls: playlist.platform_urls,
          description: playlist.description, genre_label: playlist.genre_label, followers: playlist.followers,
          curatorName: playlist.curator_name, curatorCountry: playlist.curator_country,
          curatorContactUrl: playlist.curator_contact_url, curatorInstagramUrl: playlist.curator_instagram_url,
          curatorEmail: playlist.curator_email,
        },
        scoring,
      );
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const hydratedRanked = await hydrateTrustSignals(supabase, ranked);

  const scoreModeSummary = {
    direct: hydratedRanked.filter((r) => r.scoreMode === "direct").length,
    "genre-template": hydratedRanked.filter((r) => r.scoreMode === "genre-template").length,
    popularity: hydratedRanked.filter((r) => r.scoreMode === "popularity").length,
  };

  return {
    totalCandidates: rows.length,
    results: hydratedRanked,
    scoreModeSummary,
  };
}
