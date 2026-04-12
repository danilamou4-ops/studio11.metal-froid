import type { CanonicalAudioFeatures } from "@/features/audio-features/types";
import { findGenrePreset } from "@/features/scoring/genrePresets";
import type { ArtistProfile } from "./types";

const ENERGY_MAP = {
  faible: 0.38,
  moyen: 0.58,
  élevé: 0.78,
};

/**
 * Traduit un profil artiste en CanonicalAudioFeatures estimées.
 * Utilisé pour le matching sans upload de fichier.
 */
export function profileToFeatures(profile: ArtistProfile): CanonicalAudioFeatures {
  // BPM : milieu de la plage, ou null si non renseigné
  const bpm =
    profile.bpmMin != null && profile.bpmMax != null
      ? (profile.bpmMin + profile.bpmMax) / 2
      : profile.bpmMin ?? profile.bpmMax ?? null;

  const energy = profile.energy ? ENERGY_MAP[profile.energy] : null;

  // Cherche le preset correspondant au premier genre renseigné
  const firstPreset = profile.genres
    .map((g) => findGenrePreset(g))
    .find((p) => p !== null);

  return {
    bpm,
    energy: energy ?? firstPreset?.template.energy ?? null,
    danceability: firstPreset?.template.danceability ?? null,
    valence: firstPreset?.template.valence ?? null,
    acousticness: firstPreset?.template.acousticness ?? null,
    speechiness: firstPreset?.template.speechiness ?? null,
    key: null,
    mode: null,
  };
}

/**
 * Construit la liste d'aliases sémantiques du profil pour le tagOverlapScore.
 */
export function profileToAliases(profile: ArtistProfile): string[] {
  const aliases = new Set<string>();

  // Genres renseignés
  for (const g of profile.genres) {
    for (const part of g.toLowerCase().split(/[\s,/]+/)) {
      if (part.length > 2) aliases.add(part);
    }
    // Ajoute aussi les aliases du preset correspondant
    const preset = findGenrePreset(g);
    if (preset) {
      aliases.add(preset.id);
      for (const a of preset.aliases) aliases.add(a);
    }
  }

  // Niveau mainstream
  if (profile.niveauMainstream === "underground") {
    aliases.add("underground");
    aliases.add("indie");
  }

  // Langue → marché
  if (profile.langue === "fr" || profile.langue === "fr+en") {
    aliases.add("french");
    aliases.add("francophone");
    aliases.add("français");
  }

  // Ambiance
  for (const mot of profile.ambiance.toLowerCase().split(/[\s,]+/)) {
    if (mot.length > 3) aliases.add(mot);
  }

  return Array.from(aliases);
}
