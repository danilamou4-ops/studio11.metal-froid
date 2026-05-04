/**
 * Minimal typed interface for the Essentia.js WASM instance.
 * The essentia.js package ships no TypeScript types — this covers the subset
 * of algorithms used in analyzeWithEssentia.ts.
 */

/** Opaque WASM vector — must be explicitly freed with .delete() after use. */
export interface EssentiaVector {
  delete(): void;
}

export interface EssentiaInstance {
  arrayToVector(samples: Float32Array): EssentiaVector;

  PercivalBpmEstimator(
    signal: EssentiaVector,
    frameSize: number,
    hopSize: number,
    maxBPM: number,
    minBPM: number,
    sampleRate: number,
  ): { bpm: number };

  KeyExtractor(
    signal: EssentiaVector,
    averageDetuningCorrection: boolean,
    frameSize: number,
    hopSize: number,
    hpcpSize: number,
    maxFrequency: number,
    maximumSpectralPeaks: number,
    minFrequency: number,
    pcpThreshold: number,
    profileType: string,
    sampleRate: number,
    spectralPeaksThreshold: number,
    tuningFrequency: number,
    weightType: string,
    windowType: string,
  ): { key: string; scale: string };

  Danceability(
    signal: EssentiaVector,
    maxTau: number,
    minTau: number,
    sampleRate: number,
  ): { danceability: number };

  ZeroCrossingRate(signal: EssentiaVector, threshold: number): { zeroCrossingRate: number };

  DynamicComplexity(
    signal: EssentiaVector,
    frameSize: number,
    sampleRate: number,
  ): { dynamicComplexity: number; loudness: number };
}
