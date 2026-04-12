import type { CanonicalAudioFeatures } from "@/features/audio-features/types";

function clampUnit(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
}

function toBpm(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return null;
  }

  return Number(value.toFixed(2));
}

export function normalizeSpotifyFeatures(raw: {
  tempo?: number;
  energy?: number;
  danceability?: number;
  valence?: number;
  acousticness?: number;
  speechiness?: number;
  key?: number;
  mode?: number;
}): CanonicalAudioFeatures {
  const keyMap = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  return {
    bpm: toBpm(raw.tempo),
    energy: clampUnit(raw.energy),
    danceability: clampUnit(raw.danceability),
    valence: clampUnit(raw.valence),
    acousticness: clampUnit(raw.acousticness),
    speechiness: clampUnit(raw.speechiness),
    key: typeof raw.key === "number" && raw.key >= 0 ? keyMap[raw.key] ?? null : null,
    mode: raw.mode === 1 ? "major" : raw.mode === 0 ? "minor" : null,
  };
}
