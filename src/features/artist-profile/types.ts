export type ArtistProfile = {
  // Identité genre
  genres: string[]; // ex: ["rap conscient", "underground", "lyriciste"]
  influences: string; // ex: "Médine, Nekfeu, Oxmo Puccino"
  langue: "fr" | "en" | "fr+en"; // langue principale des textes

  // Profil audio
  bpmMin: number | null;
  bpmMax: number | null;
  energy: "faible" | "moyen" | "élevé" | null;
  ambiance: string; // ex: "introspectif, nocturne, dense"

  // Ciblage
  marchePrioritaire: string; // ex: "France, Belgique, Québec"
  niveauMainstream: "underground" | "indépendant" | "mainstream";
};

export const EMPTY_PROFILE: ArtistProfile = {
  genres: [],
  influences: "",
  langue: "fr",
  bpmMin: null,
  bpmMax: null,
  energy: null,
  ambiance: "",
  marchePrioritaire: "",
  niveauMainstream: "indépendant",
};
