import { AlertTriangle } from "lucide-react";

import type { CanonicalAudioFeatures } from "@/features/audio-features/types";

type Props = {
  features: CanonicalAudioFeatures;
  fileName?: string;
  warnings?: string[];
  sourceLabel?: string;
};

type BarProps = {
  label: string;
  value: number | null;
  color: string;
};

function FeatureBar({ label, value, color }: BarProps) {
  if (value === null) {
    return (
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
        <span className="text-xs italic text-muted-foreground">—</span>
      </div>
    );
  }
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-1 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full ${color} transition-all duration-500 [width:var(--bar-w)]`}
            style={{ "--bar-w": `${pct}%` } as React.CSSProperties}
          />
        </div>
        <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
      </div>
    </div>
  );
}

export function AudioFeaturesCard({ features, fileName, warnings, sourceLabel = "Local · heuristique" }: Props) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-5 md:p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Analyse audio
          </p>
          {fileName && (
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">{fileName}</p>
          )}
        </div>
        <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
          {sourceLabel}
        </span>
      </div>

      {/* BPM + tonalité */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-center rounded-[var(--radius)] border border-border bg-secondary px-4 py-2 shadow-sm">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {features.bpm !== null ? Math.round(features.bpm) : "—"}
          </span>
          <span className="text-xs text-muted-foreground">BPM</span>
        </div>
        {(features.key || features.mode) && (
          <div className="flex flex-col items-center rounded-[var(--radius)] border border-border bg-secondary px-4 py-2 shadow-sm">
            <span className="text-2xl font-bold text-foreground">
              {[features.key, features.mode].filter(Boolean).join(" ")}
            </span>
            <span className="text-xs text-muted-foreground">Tonalité</span>
          </div>
        )}
      </div>

      {/* Jauges */}
      <div className="space-y-2.5">
        <FeatureBar label="Énergie" value={features.energy} color="bg-orange-500" />
        <FeatureBar label="Danceabilité" value={features.danceability} color="bg-violet-500" />
        <FeatureBar label="Valence" value={features.valence} color="bg-yellow-400" />
        <FeatureBar label="Acoustique" value={features.acousticness} color="bg-teal-400" />
        <FeatureBar label="Speechiness" value={features.speechiness} color="bg-sky-400" />
      </div>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <ul className="mt-4 space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
