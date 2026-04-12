export type CanonicalAudioFeatures = {
  bpm: number | null;
  energy: number | null;
  danceability: number | null;
  valence: number | null;
  acousticness: number | null;
  speechiness: number | null;
  key: string | null;
  mode: "major" | "minor" | null;
};
