export type GenreAudioTemplate = {
  bpm: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  speechiness: number;
};

export type GenrePreset = {
  id: string;
  label: string;
  aliases: string[];
  summary: string;
  template: GenreAudioTemplate;
};

function normalizeGenreText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+\s-]/g, " ")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

export const GENRE_PRESETS: GenrePreset[] = [
  {
    id: "metal-hardcore",
    label: "Metal / Hardcore",
    aliases: [
      "metal",
      "hardcore",
      "metalcore",
      "deathcore",
      "black metal",
      "doom",
      "heavy metal",
      "thrash metal",
      "death metal",
      "progressive metal",
      "nu metal",
      "groove metal",
      "sludge metal",
      "industrial metal",
      "post hardcore",
      "hardcore punk",
      "punk hardcore",
    ],
    summary: "Rapide, dense, sombre, très peu acoustique.",
    template: {
      bpm: 165,
      energy: 0.88,
      danceability: 0.42,
      valence: 0.28,
      acousticness: 0.08,
      speechiness: 0.07,
    },
  },
  {
    id: "drill-trap",
    label: "Drill / Trap",
    aliases: [
      "drill",
      "trap",
      "uk drill",
      "trap metal",
      "rage",
      "phonk",
      "memphis rap",
      "dark trap",
      "trap soul",
      "cloud trap",
      "grime",
    ],
    summary: "Percussif, nerveux, très énergique, parole marquée.",
    template: {
      bpm: 142,
      energy: 0.85,
      danceability: 0.78,
      valence: 0.38,
      acousticness: 0.1,
      speechiness: 0.24,
    },
  },
  {
    id: "rap-melancolique",
    label: "Rap mélancolique",
    aliases: [
      "melanc",
      "mélanc",
      "sad",
      "emo rap",
      "sad rap",
      "melodic rap",
      "cloud rap",
      "alternative hip hop",
      "emo hip hop",
      "dark rap",
    ],
    summary: "Tempo modéré, groove stable, couleur émotionnelle basse.",
    template: {
      bpm: 110,
      energy: 0.62,
      danceability: 0.68,
      valence: 0.32,
      acousticness: 0.24,
      speechiness: 0.13,
    },
  },
  {
    id: "rap-conscient",
    label: "Rap conscient / lyric",
    aliases: [
      "conscient",
      "lyric",
      "boom bap",
      "conscious",
      "lyriciste",
      "engage",
      "engagé",
      "textes",
      "introspectif",
      "underground",
      "lyricism",
      "boom bap",
      "old school hip hop",
      "political hip hop",
      "abstract hip hop",
      "jazz rap",
      "spoken word",
    ],
    summary: "Plus posé, articulé, avec speechiness plus présente.",
    template: {
      bpm: 96,
      energy: 0.55,
      danceability: 0.58,
      valence: 0.42,
      acousticness: 0.2,
      speechiness: 0.26,
    },
  },
  {
    id: "rap-underground",
    label: "Rap underground",
    aliases: [
      "underground",
      "cloud rap",
      "abstract rap",
      "left field hip hop",
      "experimental hip hop",
      "lo fi hip hop",
      "lo-fi hip hop",
      "backpack rap",
      "underground hip hop",
    ],
    summary: "Tendu, assez énergique, plus brut que mainstream.",
    template: {
      bpm: 118,
      energy: 0.72,
      danceability: 0.66,
      valence: 0.44,
      acousticness: 0.16,
      speechiness: 0.2,
    },
  },
  {
    id: "hiphop-rap",
    label: "Hip-hop / Rap",
    aliases: [
      "hip-hop",
      "hip hop",
      "rap",
      "new wave",
      "hiphop",
      "old school",
      "east coast rap",
      "west coast rap",
      "southern hip hop",
      "french rap",
      "francophone rap",
      "boom bap rap",
    ],
    summary: "Groove haut, énergie solide, parole modérée.",
    template: {
      bpm: 124,
      energy: 0.76,
      danceability: 0.74,
      valence: 0.54,
      acousticness: 0.14,
      speechiness: 0.17,
    },
  },
  {
    id: "electro-club",
    label: "Electro / Club",
    aliases: [
      "electro",
      "club",
      "house",
      "techno",
      "edm",
      "electronic",
      "electronica",
      "dance",
      "deep house",
      "progressive house",
      "future house",
      "tech house",
      "trance",
      "hardstyle",
      "big room",
      "bass house",
      "electro house",
      "drum and bass",
      "dnb",
      "dubstep",
      "garage",
      "uk garage",
      "breakbeat",
    ],
    summary: "Très dansant, peu acoustique, énergie haute.",
    template: {
      bpm: 128,
      energy: 0.82,
      danceability: 0.84,
      valence: 0.58,
      acousticness: 0.06,
      speechiness: 0.08,
    },
  },
  {
    id: "ambient-post-rock",
    label: "Ambient / Post-rock",
    aliases: [
      "ambient",
      "post-rock",
      "post rock",
      "drone",
      "cinematic",
      "soundtrack",
      "dark ambient",
      "atmospheric",
      "experimental",
      "minimal",
      "new age",
      "meditation",
      "downtempo",
      "chillout",
      "trip hop",
      "idm",
      "shoegaze",
      "slowcore",
    ],
    summary: "Lent, ample, peu dansant, plutôt neutre ou sombre.",
    template: {
      bpm: 90,
      energy: 0.36,
      danceability: 0.32,
      valence: 0.4,
      acousticness: 0.42,
      speechiness: 0.05,
    },
  },
  {
    id: "indie-jazz-chill",
    label: "Indie / Jazz / Chill",
    aliases: [
      "chill",
      "jazz",
      "indie",
      "alternatif",
      "alternative",
      "lofi",
      "lo-fi",
      "indie rock",
      "alternative rock",
      "indie pop",
      "bedroom pop",
      "neo jazz",
      "nu jazz",
      "jazz fusion",
      "acid jazz",
      "chillhop",
      "lounge",
      "dream pop",
      "psychedelic",
      "post punk",
    ],
    summary: "Modéré, souple, plus organique et aéré.",
    template: {
      bpm: 98,
      energy: 0.48,
      danceability: 0.6,
      valence: 0.52,
      acousticness: 0.38,
      speechiness: 0.08,
    },
  },
  {
    id: "classique",
    label: "Classique / Néo-classique",
    aliases: [
      "classique",
      "classical",
      "neo-classical",
      "neoclassical",
      "orchestral",
      "piano",
      "chamber",
      "opera",
      "baroque",
      "contemporary classical",
      "romantic",
      "symphony",
      "instrumental",
      "modern classical",
      "film score",
    ],
    summary: "Très acoustique, speechiness quasi nulle, énergie variable, non dansant.",
    template: {
      bpm: 72,
      energy: 0.22,
      danceability: 0.18,
      valence: 0.45,
      acousticness: 0.92,
      speechiness: 0.03,
    },
  },
  {
    id: "soul-rnb",
    label: "Soul / R&B",
    aliases: [
      "soul",
      "r&b",
      "rnb",
      "funk",
      "neo soul",
      "gospel",
      "contemporary r&b",
      "motown",
      "disco",
      "boogie",
      "afro soul",
    ],
    summary: "Groove vocal, énergie modérée, acousticness moyenne.",
    template: {
      bpm: 96,
      energy: 0.62,
      danceability: 0.72,
      valence: 0.58,
      acousticness: 0.32,
      speechiness: 0.1,
    },
  },
  {
    id: "folk-acoustic",
    label: "Folk / Acoustique",
    aliases: [
      "folk",
      "acoustic",
      "singer-songwriter",
      "country",
      "bluegrass",
      "americana",
      "indie folk",
      "acoustic pop",
      "alt country",
      "blues",
      "reggae",
      "roots",
      "world",
      "afrobeat",
      "afrobeats",
      "latin",
      "bossa nova",
      "flamenco",
      "chanson",
    ],
    summary: "Très acoustique, énergie faible, dansabilité basse.",
    template: {
      bpm: 84,
      energy: 0.32,
      danceability: 0.38,
      valence: 0.55,
      acousticness: 0.78,
      speechiness: 0.06,
    },
  },
];

import type { CanonicalAudioFeatures } from "@/features/audio-features/types";

/**
 * Trouve le preset genre le plus proche des features audio d'un morceau.
 * Utilisé pour dériver le contexte sémantique de la piste analysée.
 */
export function findClosestPresetForFeatures(features: CanonicalAudioFeatures): GenrePreset | null {
  let best: { preset: GenrePreset; score: number } | null = null;

  for (const preset of GENRE_PRESETS) {
    const t = preset.template;
    const sims: number[] = [];

    // BPM : fenêtre 60 BPM
    if (features.bpm != null) sims.push(Math.max(0, 1 - Math.abs(features.bpm - t.bpm) / 60));
    // Acousticness : signal le plus discriminant (classique vs rap)
    if (features.acousticness != null) sims.push(Math.max(0, 1 - Math.abs(features.acousticness - t.acousticness)) ** 1.5);
    // Energy
    if (features.energy != null) sims.push(Math.max(0, 1 - Math.abs(features.energy - t.energy)));
    // Speechiness : très discriminant (rap vs instrumental)
    if (features.speechiness != null) sims.push(Math.max(0, 1 - Math.abs(features.speechiness - t.speechiness)) ** 1.5);
    // Danceability
    if (features.danceability != null) sims.push(Math.max(0, 1 - Math.abs(features.danceability - t.danceability)));

    if (sims.length === 0) continue;
    const avg = sims.reduce((a, b) => a + b, 0) / sims.length;
    if (!best || avg > best.score) best = { preset, score: avg };
  }

  // Seuil abaissé à 0.38 — on préfère un preset approximatif à rien du tout
  return best && best.score >= 0.38 ? best.preset : null;
}

export function findGenrePreset(genreLabel: string | null): GenrePreset | null {
  if (!genreLabel) return null;

  const normalized = normalizeGenreText(genreLabel);
  if (!normalized) return null;

  let best: { preset: GenrePreset; score: number } | null = null;

  for (const preset of GENRE_PRESETS) {
    let score = 0;

    for (const rawValue of [preset.label, ...preset.aliases]) {
      const value = normalizeGenreText(rawValue);
      if (!value) continue;

      if (normalized === value) {
        score += 100;
        continue;
      }

      if (normalized.includes(value)) score += Math.max(12, Math.min(40, value.length * 2));
      if (value.includes(normalized)) score += 10;

      const valueTokens = value.split(" ").filter((t) => t.length > 2);
      for (const token of valueTokens) {
        if (normalized.includes(token)) score += 3;
      }
    }

    if (!best || score > best.score) {
      best = { preset, score };
    }
  }

  if (!best || best.score < 12) return null;
  return best.preset;
}

export const LASTFM_GENRE_SUGGESTIONS = Array.from(
  new Set(
    GENRE_PRESETS.flatMap((preset) => [preset.label, ...preset.aliases].map((value) => value.trim())).filter(
      (value) => value.length > 0,
    ),
  ),
).sort((a, b) => a.localeCompare(b));