/**
 * Analyse audio via Essentia.js (WASM — navigateur uniquement).
 *
 * Algorithmes utilisés :
 *   BPM         → PercivalBpmEstimator  (rapide, précis sur 30-45 s audio)
 *   Key + mode  → KeyExtractor
 *   Danceability→ Danceability (range 0–3, normalisé /3)
 *   Energy      → RMS calculé sur frames (proxy fiable)
 *   ZCR         → ZeroCrossingRate (proxy speechiness / acousticness)
 *   Valence     → DynamicComplexity + danceability (dérivé)
 *
 * Stratégie de chargement :
 *   - Import dynamique du module EssentiaWASM (browser-only)
 *   - Le binaire .wasm est servi depuis /public/essentiajs/
 *   - locateFile() redirige le fetch vers cette URL publique
 *   - En cas d'échec → retourne null (le caller bascule sur le fallback heuristique)
 */

import type { CanonicalAudioFeatures } from "@/features/audio-features/types";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function computeRms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

// Singleton : on ne charge le WASM qu'une seule fois par session.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let essentiaInstance: any | null = null;

async function getEssentia() {
  if (essentiaInstance) return essentiaInstance;

  // ── 1. WASM factory (essentia-wasm.web.js est UMD) ───────────────────────
  // Export UMD final : `module.exports = EssentiaWASM` (la factory directement).
  // webpack 5 CJS-to-ESM interop → namespace.default = module.exports = factory.
  // On accepte aussi les variantes où la factory serait sous .EssentiaWASM.
  const wasmNS = await import("essentia.js/dist/essentia-wasm.web.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = wasmNS as any;
  const EssentiaWASMFactory: ((opts?: unknown) => Promise<unknown>) =
    (typeof w.default === "function" ? w.default : null) ??
    (typeof w.EssentiaWASM === "function" ? w.EssentiaWASM : null) ??
    (typeof w.default?.EssentiaWASM === "function" ? w.default.EssentiaWASM : null);

  if (typeof EssentiaWASMFactory !== "function") {
    throw new Error(
      `[Essentia] Factory introuvable. Keys: ${Object.keys(w).join(", ")} | typeof default: ${typeof w.default}`,
    );
  }

  // ── 2. Essentia core (ESM : export default Essentia) ─────────────────────
  // BUG original : { Essentia } sur un "export default" = undefined.
  // Correct : { default: EssentiaClass }
  const coreNS = await import("essentia.js/dist/essentia.js-core.es.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = coreNS as any;
  const EssentiaClass = c.default ?? c.Essentia;

  if (typeof EssentiaClass !== "function") {
    throw new Error(
      `[Essentia] Classe Essentia introuvable. Keys: ${Object.keys(c).join(", ")}`,
    );
  }

  // ── 3. Instanciation WASM ─────────────────────────────────────────────────
  // locateFile redirige le fetch du binaire .wasm vers /public/essentiajs/
  const wasm = await EssentiaWASMFactory({
    locateFile: (file: string) => `/essentiajs/${file}`,
  });

  essentiaInstance = new EssentiaClass(wasm);
  return essentiaInstance;
}

export type EssentiaAnalysisResult = {
  features: CanonicalAudioFeatures;
  /** "essentia" si l'analyse a réussi */
  method: "essentia";
};

/**
 * Analyse un buffer mono Float32Array avec Essentia.js.
 * Retourne null si le WASM ne peut pas être chargé (environnement non-navigateur,
 * ou erreur réseau/WASM) — le caller doit basculer sur l'analyse heuristique.
 */
export async function analyzeWithEssentia(
  samples: Float32Array,
  sampleRate: number,
): Promise<EssentiaAnalysisResult | null> {
  if (typeof window === "undefined") return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const essentia: any = await getEssentia();

    const signal = essentia.arrayToVector(samples);

    // ── BPM ──────────────────────────────────────────────────────────────────
    let bpm: number | null = null;
    try {
      const bpmResult = essentia.PercivalBpmEstimator(
        signal,
        /*frameSize*/ 1024,
        /*hopSize*/ 128,
        /*maxBPM*/ 210,
        /*minBPM*/ 50,
        sampleRate,
      );
      const rawBpm = bpmResult.bpm as number;
      bpm = rawBpm > 0 ? Math.round(rawBpm * 10) / 10 : null;
    } catch {
      // pas de beats détectés → laisse null
    }

    // ── Key + mode ────────────────────────────────────────────────────────────
    let key: string | null = null;
    let mode: "major" | "minor" | null = null;
    try {
      const keyResult = essentia.KeyExtractor(
        signal,
        /*averageDetuningCorrection*/ true,
        /*frameSize*/ 4096,
        /*hopSize*/ 4096,
        /*hpcpSize*/ 36,
        /*maxFrequency*/ 3500,
        /*maximumSpectralPeaks*/ 60,
        /*minFrequency*/ 25,
        /*pcpThreshold*/ 0.2,
        /*profileType*/ "bgate",
        sampleRate,
        /*spectralPeaksThreshold*/ 0.0001,
        /*tuningFrequency*/ 440,
        /*weightType*/ "cosine",
        /*windowType*/ "hann",
      );
      key = keyResult.key as string;
      const scale = keyResult.scale as string;
      mode = scale === "major" ? "major" : "minor";
    } catch {
      // laisse null
    }

    // ── Danceability (0–3 → 0–1) ─────────────────────────────────────────────
    let danceability = 0.5;
    try {
      const danceResult = essentia.Danceability(
        signal,
        /*maxTau*/ 8800,
        /*minTau*/ 310,
        sampleRate,
      );
      danceability = clamp01((danceResult.danceability as number) / 3);
    } catch {
      // valeur par défaut conservée
    }

    // ── ZeroCrossingRate ──────────────────────────────────────────────────────
    let zcr = 0.05;
    try {
      const zcrResult = essentia.ZeroCrossingRate(signal, /*threshold*/ 0);
      zcr = clamp01(zcrResult.zeroCrossingRate as number);
    } catch {
      // valeur par défaut
    }

    // ── DynamicComplexity → proxy dynamique (valence) ─────────────────────────
    let dynamicComplexity = 0.5;
    let loudnessDb = -30;
    try {
      const dynResult = essentia.DynamicComplexity(
        signal,
        /*frameSize =*/ 0.2,
        sampleRate,
      );
      dynamicComplexity = clamp01((dynResult.dynamicComplexity as number) / 9);
      loudnessDb = dynResult.loudness as number; // typiquement -60 à 0 dB
    } catch {
      // valeurs par défaut
    }

    signal.delete();

    // ── Features dérivées ─────────────────────────────────────────────────────
    const rms = computeRms(samples);
    const energy = clamp01(rms * 4.5); // 4.5 : calibration empirique

    // loudness normalisé [0,1] (référence -60 dB = 0, 0 dB = 1)
    const loudnessNorm = clamp01((loudnessDb + 60) / 60);

    // acousticness : signal peu énergique + ZCR faible = acoustique
    const acousticness = clamp01(
      (1 - energy) * 0.55 + (1 - clamp01(zcr * 8)) * 0.30 + (1 - danceability) * 0.15,
    );

    // speechiness : ZCR élevé + énergie modérée + complexité dynamique élevée
    const speechiness = clamp01(zcr * 3.5 + dynamicComplexity * 0.4 - energy * 0.2);

    // valence : énergie + danceabilité + loudness relatif
    const valence = clamp01(energy * 0.45 + danceability * 0.35 + loudnessNorm * 0.20);

    return {
      features: { bpm, energy, danceability, valence, acousticness, speechiness, key, mode },
      method: "essentia",
    };
  } catch (err) {
    console.warn("[Essentia] Analyse échouée, fallback heuristique :", err);
    return null;
  }
}
