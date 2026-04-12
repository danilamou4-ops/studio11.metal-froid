import type { CanonicalAudioFeatures } from "@/features/audio-features/types";
import { analyzeWithEssentia } from "@/features/audio-features/analyzeWithEssentia";

type LocalAnalysisResult = {
  features: CanonicalAudioFeatures;
  /** "essentia" si Essentia.js WASM a réussi, "heuristic" sinon */
  method: "essentia" | "heuristic";
  diagnostics: {
    durationSec: number;
    sampleRate: number;
    analyzedSamples: number;
  };
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function estimateBpm(samples: Float32Array, sampleRate: number): number | null {
  const frameSize = 1024;
  const hop = 512;
  const energies: number[] = [];

  for (let i = 0; i + frameSize < samples.length; i += hop) {
    let sumSq = 0;
    for (let j = 0; j < frameSize; j += 1) {
      const s = samples[i + j];
      sumSq += s * s;
    }
    energies.push(Math.sqrt(sumSq / frameSize));
  }

  if (energies.length < 10) return null;

  const meanEnergy = average(energies);
  const threshold = meanEnergy * 1.35;
  const peaks: number[] = [];

  for (let i = 1; i < energies.length - 1; i += 1) {
    const value = energies[i];
    if (value > threshold && value > energies[i - 1] && value >= energies[i + 1]) {
      peaks.push(i);
    }
  }

  if (peaks.length < 2) return null;

  const bpmHistogram = new Map<number, number>();
  for (let i = 1; i < peaks.length; i += 1) {
    const intervalFrames = peaks[i] - peaks[i - 1];
    const intervalSec = (intervalFrames * hop) / sampleRate;
    if (intervalSec <= 0) continue;

    let bpm = 60 / intervalSec;
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;

    const rounded = Math.round(bpm);
    if (rounded < 70 || rounded > 180) continue;

    bpmHistogram.set(rounded, (bpmHistogram.get(rounded) ?? 0) + 1);
  }

  if (bpmHistogram.size === 0) return null;

  let bestBpm = 0;
  let bestScore = -1;
  bpmHistogram.forEach((score, bpm) => {
    if (score > bestScore) {
      bestBpm = bpm;
      bestScore = score;
    }
  });

  return bestBpm || null;
}

function computeZeroCrossingRate(samples: Float32Array): number {
  if (samples.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) {
      crossings += 1;
    }
  }
  return crossings / samples.length;
}

function computeFrameEnergyVariation(samples: Float32Array): number {
  const frameSize = 2048;
  const hop = 512;
  const frameEnergies: number[] = [];

  for (let i = 0; i + frameSize <= samples.length; i += hop) {
    let sumSq = 0;
    for (let j = 0; j < frameSize; j += 1) {
      const sample = samples[i + j];
      sumSq += sample * sample;
    }
    frameEnergies.push(Math.sqrt(sumSq / frameSize));
  }

  if (frameEnergies.length < 2) return 0;

  const meanEnergy = average(frameEnergies);
  if (meanEnergy <= 0.0001) return 0;

  const variance = average(frameEnergies.map((energy) => (energy - meanEnergy) ** 2));
  let deltaSum = 0;

  for (let i = 1; i < frameEnergies.length; i += 1) {
    deltaSum += Math.abs(frameEnergies[i] - frameEnergies[i - 1]);
  }

  const meanDelta = deltaSum / (frameEnergies.length - 1);
  const normalizedVariance = Math.sqrt(variance) / meanEnergy;
  const normalizedDelta = meanDelta / meanEnergy;

  return clamp01((normalizedVariance * 0.5) + (normalizedDelta * 1.4) - 0.1);
}

function downmixToMono(channelData: Float32Array[]): Float32Array {
  if (channelData.length === 1) return channelData[0];
  const length = channelData[0].length;
  const mono = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (const channel of channelData) sum += channel[i] ?? 0;
    mono[i] = sum / channelData.length;
  }

  return mono;
}

export async function analyzeLocalAudioFile(file: File): Promise<LocalAnalysisResult> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const mono = downmixToMono(channels);

    const durationSec = Number(buffer.duration.toFixed(2));

    // ── Tentative Essentia.js (WASM) ────────────────────────────────────────
    // On analyse les 45 premières secondes pour rester léger en mémoire WASM.
    const maxSamples = Math.min(mono.length, Math.floor(buffer.sampleRate * 45));
    const sampleSlice = mono.slice(0, maxSamples);

    const essentiaResult = await analyzeWithEssentia(sampleSlice, buffer.sampleRate);
    if (essentiaResult) {
      return {
        features: essentiaResult.features,
        method: "essentia",
        diagnostics: { durationSec, sampleRate: buffer.sampleRate, analyzedSamples: sampleSlice.length },
      };
    }

    // ── Fallback heuristique (WebAudio uniquement) ──────────────────────────
    // sampleSlice already computed above — reuse it.
    const rms = Math.sqrt(
      sampleSlice.reduce((sum, s) => sum + s * s, 0) / Math.max(1, sampleSlice.length),
    );
    const bpm = estimateBpm(sampleSlice, buffer.sampleRate);
    const frameEnergyVariation = computeFrameEnergyVariation(sampleSlice);
    const zcr = computeZeroCrossingRate(sampleSlice);

    const energy = clamp01(rms * 3.2);
    const danceability = clamp01((energy * 0.65) + (bpm ? clamp01(1 - Math.abs(bpm - 120) / 80) * 0.35 : 0.2));
    const acousticness = clamp01((1 - energy) * 0.75 + clamp01(0.22 - zcr) * 0.25);
    const speechiness = clamp01((frameEnergyVariation * 0.85) + (1 - acousticness) * 0.08 - (energy * 0.05));
    const valence = clamp01((energy * 0.55) + (danceability * 0.35) - (acousticness * 0.2));

    return {
      features: {
        bpm,
        energy,
        danceability,
        valence,
        acousticness,
        speechiness,
        key: null,
        mode: null,
      },
      method: "heuristic",
      diagnostics: {
        durationSec,
        sampleRate: buffer.sampleRate,
        analyzedSamples: sampleSlice.length,
      },
    };
  } finally {
    await audioContext.close();
  }
}
