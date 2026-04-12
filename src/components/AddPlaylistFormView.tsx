"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

import {
  GENRE_PRESETS,
  LASTFM_GENRE_SUGGESTIONS,
  findGenrePreset,
  type GenreAudioTemplate,
} from "@/features/scoring/genrePresets";
import { ViewState } from "@/components/ui/view-state";

// ─── Types ────────────────────────────────────────────────────────────────────

type RangeValue = { lo: number; hi: number };

type FormState = {
  playlistName: string;
  playlistUrl: string;
  followers: string;
  genreLabel: string;
  country: string;
  description: string;
  contactUrl: string;
  instagramUrl: string;
  email: string;
  bpm: RangeValue;
  energy: RangeValue;
  danceability: RangeValue;
  valence: RangeValue;
  acousticness: RangeValue;
  speechiness: RangeValue;
};

const initialState: FormState = {
  playlistName: "",
  playlistUrl: "",
  followers: "",
  genreLabel: "",
  country: "",
  description: "",
  contactUrl: "",
  instagramUrl: "",
  email: "",
  bpm: { lo: 100, hi: 160 },
  energy: { lo: 50, hi: 80 },
  danceability: { lo: 40, hi: 70 },
  valence: { lo: 30, hi: 60 },
  acousticness: { lo: 10, hi: 40 },
  speechiness: { lo: 10, hi: 30 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNumberOrNull(value: string) {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rangeToUnit(v: RangeValue) {
  return { lo: Number((v.lo / 100).toFixed(3)), hi: Number((v.hi / 100).toFixed(3)) };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

function buildPercentRange(center: number, spread: number) {
  const pct = Math.round(center * 100);
  const lo = snap(clamp(pct - spread, 0, 100), 10);
  const hi = snap(clamp(pct + spread, 0, 100), 10);
  return { lo, hi: hi === lo ? clamp(lo + 10, 0, 100) : hi };
}

function buildBpmRange(center: number, spread: number) {
  const lo = snap(clamp(center - spread, 0, 300), 10);
  const hi = snap(clamp(center + spread, 0, 300), 10);
  return { lo, hi: hi === lo ? clamp(lo + 10, 0, 300) : hi };
}

function templateToRanges(template: GenreAudioTemplate) {
  return {
    bpm: buildBpmRange(template.bpm, 20),
    energy: buildPercentRange(template.energy, 15),
    danceability: buildPercentRange(template.danceability, 15),
    valence: buildPercentRange(template.valence, 20),
    acousticness: buildPercentRange(template.acousticness, 15),
    speechiness: buildPercentRange(template.speechiness, 10),
  };
}

// ─── InfoTooltip ──────────────────────────────────────────────────────────────

function InfoTooltip({ title, lines }: { title: string; lines: string[] }) {
  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        aria-label={title}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-secondary text-[11px] font-semibold text-muted-foreground transition hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring"
      >
        i
      </button>
      <span className="pointer-events-none absolute right-0 top-7 z-20 hidden w-72 rounded-[var(--radius)] border border-primary/20 bg-card p-3 text-left text-xs leading-5 text-foreground shadow-2xl group-hover:block group-focus-within:block">
        <strong className="mb-1 block text-sm font-semibold text-foreground">{title}</strong>
        <span className="block space-y-1.5">
          {lines.map((line) => (
            <span key={line} className="block text-muted-foreground">
              {line}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

// ─── NumericInput ─────────────────────────────────────────────────────────────

function NumericInput({
  label,
  raw,
  suffix,
  onChange,
  onCommit,
}: {
  label: string;
  raw: string;
  suffix: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-1 rounded-[var(--radius)] border border-border bg-secondary px-2 py-1 shadow-sm">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={raw}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit((e.target as HTMLInputElement).value);
          }
        }}
        className="min-w-0 w-full bg-transparent text-right text-xs font-semibold tabular-nums text-foreground outline-none"
      />
      {suffix && <span className="shrink-0 text-[11px] text-muted-foreground">{suffix}</span>}
    </label>
  );
}

// ─── DualRangeField ───────────────────────────────────────────────────────────

function DualRangeField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  lowLabel,
  highLabel,
  guidance,
  tooltipLines,
  tickStep,
  fillClassName,
  thumbClassName,
  valueClassName,
  onChange,
}: {
  label: string;
  value: RangeValue;
  min: number;
  max: number;
  step: number;
  suffix: string;
  lowLabel: string;
  highLabel: string;
  guidance: string;
  tooltipLines: string[];
  tickStep: number;
  fillClassName: string;
  thumbClassName: string;
  valueClassName: string;
  onChange: (v: RangeValue) => void;
}) {
  const [loRaw, setLoRaw] = useState(String(value.lo));
  const [hiRaw, setHiRaw] = useState(String(value.hi));

  useEffect(() => {
    setLoRaw(String(value.lo));
  }, [value.lo]);

  useEffect(() => {
    setHiRaw(String(value.hi));
  }, [value.hi]);

  function commitLo(raw: string) {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) { setLoRaw(String(value.lo)); return; }
    const lo = Math.min(snap(clamp(n, min, max), step), value.hi);
    setLoRaw(String(lo));
    onChange({ lo, hi: value.hi });
  }

  function commitHi(raw: string) {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) { setHiRaw(String(value.hi)); return; }
    const hi = Math.max(snap(clamp(n, min, max), step), value.lo);
    setHiRaw(String(hi));
    onChange({ lo: value.lo, hi });
  }

  function onSliderLo(raw: string) {
    const lo = Math.min(snap(clamp(Number(raw), min, max), step), value.hi);
    setLoRaw(String(lo));
    onChange({ lo, hi: value.hi });
  }

  function onSliderHi(raw: string) {
    const hi = Math.max(snap(clamp(Number(raw), min, max), step), value.lo);
    setHiRaw(String(hi));
    onChange({ lo: value.lo, hi });
  }

  const loPercent = ((value.lo - min) / (max - min)) * 100;
  const hiPercent = ((value.hi - min) / (max - min)) * 100;

  const ticks = Array.from(
    { length: Math.floor((max - min) / tickStep) + 1 },
    (_, i) => min + i * tickStep,
  );

  return (
    <div className="flex h-full flex-col gap-2 rounded-[var(--radius)] border border-border bg-secondary p-3">
      {/* Header */}
      <div className="flex min-h-[3.75rem] items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
              {label}
            </span>
            <InfoTooltip title={label} lines={tooltipLines} />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{guidance}</p>
        </div>
        <span className={`whitespace-nowrap text-xs font-semibold tabular-nums ${valueClassName}`}>
          {value.lo}{suffix}&nbsp;–&nbsp;{value.hi}{suffix}
        </span>
      </div>

      {/* Slider track with two thumbs */}
      {/* The native range input shrinks its travel area by thumb-radius on each side.
          We compensate by shrinking the visual track by the same amount (7px = half of 14px thumb),
          then nudging the fill and ticks by the same offset so everything lines up. */}
      <div className="select-none">
        <div className="relative h-8">
          {/* Track bg — inset by 7px on each side to match browser thumb travel */}
          <div className="absolute left-[7px] right-[7px] top-1/2 h-1 -translate-y-1/2 rounded-full bg-secondary" />
          {/* Active fill — same 7px inset, then percent within that travel zone */}
          <div
            className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full ${fillClassName} [left:var(--fill-lo)] [right:var(--fill-hi)]`}
            style={{
              "--fill-lo": `calc(7px + ${loPercent} * (100% - 14px) / 100)`,
              "--fill-hi": `calc(7px + ${100 - hiPercent} * (100% - 14px) / 100)`,
            } as React.CSSProperties}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value.lo}
            aria-label={`${label} — minimum`}
            onChange={(e) => onSliderLo(e.target.value)}
            className={`pointer-events-none absolute left-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm ${thumbClassName} ${value.lo >= value.hi - step ? 'z-[5]' : 'z-[3]'}`}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value.hi}
            aria-label={`${label} — maximum`}
            onChange={(e) => onSliderHi(e.target.value)}
            className={`pointer-events-none absolute left-0 top-1/2 z-10 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm ${thumbClassName}`}
          />
        </div>
      </div>

      {/* Tick marks — aligned to same 7px inset so they match thumb positions */}
      <div className="flex justify-between px-[7px]">
        {ticks.map((tick) => (
          <div key={tick} className="flex flex-col items-center gap-0.5">
            <span className="h-1.5 w-px rounded-full bg-border" />
            <span className="text-[10px] text-muted-foreground">{tick}</span>
          </div>
        ))}
      </div>

      {/* Polarity labels */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>

      {/* Numeric inputs — visually separated section */}
      <div className="mt-auto flex items-stretch gap-2 border-t border-border pt-2">
        <NumericInput
          label="Min"
          raw={loRaw}
          suffix={suffix}
          onChange={setLoRaw}
          onCommit={commitLo}
        />
        <span className="text-xs text-muted-foreground">–</span>
        <NumericInput
          label="Max"
          raw={hiRaw}
          suffix={suffix}
          onChange={setHiRaw}
          onCommit={commitHi}
        />
      </div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AddPlaylistFormView({ onAdded }: { onAdded?: () => void } = {}) {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [curatorPlatformSuggestion, setCuratorPlatformSuggestion] = useState<{
    curatorId: string;
    existingPlatforms: string[];
  } | null>(null);
  const [genreQuery, setGenreQuery] = useState("");
  const [customGenres, setCustomGenres] = useState<string[]>([]);
  const [remoteLastfmGenres, setRemoteLastfmGenres] = useState<string[]>([]);
  // Track whether the last genre change came from a preset click (to avoid re-triggering)
  const [presetJustApplied, setPresetJustApplied] = useState(false);

  const activeGenrePreset = useMemo(() => findGenrePreset(form.genreLabel), [form.genreLabel]);
  const normalizedGenreQuery = genreQuery.trim().toLowerCase();

  const visiblePresetChips = useMemo(() => {
    if (!normalizedGenreQuery) return GENRE_PRESETS;
    return GENRE_PRESETS.filter((preset) =>
      [preset.label, ...preset.aliases].some((value) => value.toLowerCase().includes(normalizedGenreQuery)),
    );
  }, [normalizedGenreQuery]);

  const visibleCustomGenres = useMemo(() => {
    if (!normalizedGenreQuery) return customGenres;
    return customGenres.filter((genre) => genre.toLowerCase().includes(normalizedGenreQuery));
  }, [customGenres, normalizedGenreQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const endpoint = normalizedGenreQuery.length >= 2
          ? `/api/genres/lastfm?q=${encodeURIComponent(normalizedGenreQuery)}`
          : "/api/genres/lastfm";
        const res = await fetch(endpoint, {
          signal: controller.signal,
        });
        if (!res.ok) return;

        const data = (await res.json()) as { genres?: string[] };
        setRemoteLastfmGenres(Array.isArray(data.genres) ? data.genres : []);
      } catch {
        // Ignore aborted/temporary network errors on incremental search.
      }
    }, normalizedGenreQuery.length >= 2 ? 180 : 0);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [normalizedGenreQuery]);

  const visibleLastfmGenres = useMemo(() => {
    const merged = Array.from(new Set([...LASTFM_GENRE_SUGGESTIONS, ...remoteLastfmGenres]));
    return merged
      .filter((genre) => {
        const lower = genre.toLowerCase();
        return (
          (normalizedGenreQuery.length === 0 || lower.includes(normalizedGenreQuery)) &&
          !GENRE_PRESETS.some((preset) => preset.label.toLowerCase() === lower) &&
          !customGenres.some((custom) => custom.toLowerCase() === lower)
        );
      })
      .slice(0, normalizedGenreQuery.length >= 2 ? 14 : 18);
  }, [customGenres, normalizedGenreQuery, remoteLastfmGenres]);

  const canAddCustomGenre =
    normalizedGenreQuery.length > 0 &&
    !GENRE_PRESETS.some((preset) =>
      [preset.label, ...preset.aliases].some((value) => value.toLowerCase() === normalizedGenreQuery),
    ) &&
    !LASTFM_GENRE_SUGGESTIONS.some((genre) => genre.toLowerCase() === normalizedGenreQuery) &&
    !customGenres.some((genre) => genre.toLowerCase() === normalizedGenreQuery);

  const setRange = useCallback(
    (
      key: keyof Pick<
        FormState,
        "bpm" | "energy" | "danceability" | "valence" | "acousticness" | "speechiness"
      >,
    ) =>
      (v: RangeValue) =>
        setForm((s) => ({ ...s, [key]: v })),
    [],
  );

  const applyGenrePreset = useCallback((presetLabel: string) => {
    const preset = findGenrePreset(presetLabel);
    if (!preset) return;

    setPresetJustApplied(true);
    setForm((s) => ({
      ...s,
      genreLabel: preset.label,
      ...templateToRanges(preset.template),
    }));
    setGenreQuery("");
  }, []);

  // When user types in genre dominant: auto-select matching preset (partial match)
  // or add as custom genre if nothing matches
  const handleGenreLabelChange = useCallback(
    (typed: string) => {
      if (presetJustApplied) {
        setPresetJustApplied(false);
        return;
      }
      setForm((s) => ({ ...s, genreLabel: typed }));

      const matched = findGenrePreset(typed);
      if (matched) {
        // Auto-apply ranges when a preset matches what is being typed
        setForm((s) => ({
          ...s,
          genreLabel: typed,
          ...templateToRanges(matched.template),
        }));
      } else if (typed.trim() && !customGenres.some((g) => g.toLowerCase() === typed.trim().toLowerCase())) {
        setCustomGenres((prev) => [...prev, typed.trim()]);
      }
    },
    [presetJustApplied, customGenres],
  );

  const addCustomGenre = useCallback(() => {
    const nextGenre = genreQuery.trim();
    if (!nextGenre) return;

    setCustomGenres((current) =>
      current.some((genre) => genre.toLowerCase() === nextGenre.toLowerCase()) ? current : [...current, nextGenre],
    );
    setForm((s) => ({ ...s, genreLabel: nextGenre }));
    setGenreQuery("");
  }, [genreQuery]);

  const applyGenreLabelWithTemplate = useCallback((genreLabel: string) => {
    const preset = findGenrePreset(genreLabel);
    setPresetJustApplied(true);
    setForm((s) => ({
      ...s,
      genreLabel,
      ...(preset ? templateToRanges(preset.template) : {}),
    }));
    setGenreQuery("");
  }, []);

  async function submitPlaylist(forceAddToExistingCurator: boolean) {
    setSubmitting(true);
    setFeedback(null);
    setError(null);
    if (!forceAddToExistingCurator) {
      setCuratorPlatformSuggestion(null);
    }

    try {
      const energyU = rangeToUnit(form.energy);
      const danceU = rangeToUnit(form.danceability);
      const valenceU = rangeToUnit(form.valence);
      const acousticU = rangeToUnit(form.acousticness);
      const speechU = rangeToUnit(form.speechiness);

      const payload = {
        playlistName: form.playlistName.trim(),
        playlistUrl: form.playlistUrl.trim(),
        forceAddToExistingCurator,
        followers: toNumberOrNull(form.followers),
        genreLabel: form.genreLabel.trim() || null,
        country: form.country.trim() || null,
        description: form.description.trim() || null,
        contactUrl: form.contactUrl.trim() || null,
        instagramUrl: form.instagramUrl.trim() || null,
        email: form.email.trim() || null,
        avgBpm: Math.round((form.bpm.lo + form.bpm.hi) / 2),
        avgEnergy: Number(((energyU.lo + energyU.hi) / 2).toFixed(3)),
        avgDanceability: Number(((danceU.lo + danceU.hi) / 2).toFixed(3)),
        avgValence: Number(((valenceU.lo + valenceU.hi) / 2).toFixed(3)),
        avgAcousticness: Number(((acousticU.lo + acousticU.hi) / 2).toFixed(3)),
        avgSpeechiness: Number(((speechU.lo + speechU.hi) / 2).toFixed(3)),
      };

      const response = await fetch("/api/playlists/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok) {
        if (json?.error?.code === "CURATOR_HAS_OTHER_PLATFORM") {
          const details = json?.error?.details as {
            curatorId?: string;
            existingPlatforms?: string[];
            curator?: {
              country?: string | null;
              contactUrl?: string | null;
              instagramUrl?: string | null;
              email?: string | null;
            };
          };

          if (details?.curatorId) {
            setCuratorPlatformSuggestion({
              curatorId: details.curatorId,
              existingPlatforms: details.existingPlatforms ?? [],
            });
          }

          // Pré-remplir les champs curator si vides pour éviter la double saisie.
          setForm((current) => ({
            ...current,
            country: current.country || details?.curator?.country || "",
            contactUrl: current.contactUrl || details?.curator?.contactUrl || "",
            instagramUrl: current.instagramUrl || details?.curator?.instagramUrl || "",
            email: current.email || details?.curator?.email || "",
          }));

          setError(json?.error?.message ?? "Ce curateur existe déjà sur une autre plateforme.");
          return;
        }

        throw new Error(json?.error?.message ?? "Envoi impossible");
      }

      setFeedback("Playlist enregistrée avec succès. Elle est disponible pour le matching.");
      setForm(initialState);
      setCuratorPlatformSuggestion(null);
      onAdded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitPlaylist(false);
  }

  return (
    <section className="space-y-6 rounded-[var(--radius)] border border-border bg-card p-5 md:p-6 shadow-sm">
      {/* Header */}
      <div className="rounded-[var(--radius)] border border-border bg-secondary p-4 text-foreground">
        <h2 className="text-base font-semibold tracking-wide">Ajouter une playlist</h2>
          <p className="mt-1 text-sm text-muted-foreground">
          Remplis les infos curator + profil audio pour la rendre exploitable par le matching.
          L&apos;app acceptera bientôt des playlists multi-plateformes.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" aria-busy={submitting}>
        {/* Info générale */}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nom playlist *">
            <input
              required
              placeholder="ex: MÉTAL LOURD FR"
              value={form.playlistName}
              onChange={(e) => setForm((s) => ({ ...s, playlistName: e.target.value }))}
              className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </Field>
          <Field label="URL playlist * (Spotify, Deezer, Apple Music…)">
            <input
              required
              type="url"
              placeholder="https://open.spotify.com/playlist/… ou deezer.com/…"
              value={form.playlistUrl}
              onChange={(e) => setForm((s) => ({ ...s, playlistUrl: e.target.value }))}
              className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </Field>
          <Field label="Followers">
            <input
              type="number"
              min={0}
              placeholder="ex: 12000"
              value={form.followers}
              onChange={(e) => setForm((s) => ({ ...s, followers: e.target.value }))}
              className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </Field>
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Genre dominant
              <InfoTooltip
                title="Genre dominant"
                lines={[
                  "Metal / hardcore : énergie haute, acoustique basse, parole basse.",
                  "Hip-hop / rap : speechiness haute, groove régulier.",
                  "Ambient / post-rock : danceabilité basse, tempos souples, valence neutre.",
                  "Sois précis même si le son est hybride : ça aide à différencier les scènes proches.",
                ]}
              />
            </span>
            <input
              value={form.genreLabel}
              placeholder="ex: Metal, Hip-hop, Drill…"
              onChange={(e) => handleGenreLabelChange(e.target.value)}
              className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </label>
          <Field label="Pays">
            <input
              value={form.country}
              placeholder="ex: France, Belgique…"
              onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))}
              className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </Field>
          <Field label="Instagram curateur">
            <input
              type="url"
              placeholder="https://www.instagram.com/…"
              value={form.instagramUrl}
              onChange={(e) => setForm((s) => ({ ...s, instagramUrl: e.target.value }))}
              className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </Field>
          <Field label="Email curateur">
            <input
              type="email"
              placeholder="contact@domaine.com"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </Field>
          <Field label="Autre lien de contact">
            <input
              value={form.contactUrl}
              placeholder="https://…"
              onChange={(e) => setForm((s) => ({ ...s, contactUrl: e.target.value }))}
              className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            rows={3}
            placeholder="Ambiance de la playlist, type de tracks acceptées, contexte éditorial…"
            value={form.description}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </Field>

        {/* Audio profile */}
        <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Profil audio (matching)</h3>
          <div className="mb-3 rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
            <p className="font-medium">Définis la plage sonore réellement acceptée par la playlist.</p>
            <p className="mt-1 text-muted-foreground/80">
              Chaque métrique accepte un min et un max. Le scoring calcule la compatibilité du morceau analysé avec cette fourchette.
            </p>
          </div>

          {/* Genre presets — inside audio section */}
          <div className="mb-3 rounded-[var(--radius)] border border-border bg-secondary p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Presets genre
                </p>
                <p className="text-xs text-muted-foreground">
                  Sélectionne un genre pour pré-remplir les plages audio. Les presets et suggestions Last.fm sont regroupés ici, et la saisie dans «&nbsp;Genre dominant&nbsp;» applique aussi le preset correspondant.
                </p>
              </div>
              {activeGenrePreset && (
                <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  Preset actif : {activeGenrePreset.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <input
                value={genreQuery}
                onChange={(e) => setGenreQuery(e.target.value)}
                placeholder="Filtrer les genres…"
                className="h-9 w-40 shrink-0 rounded-full border border-border bg-secondary px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
              />
              {visiblePresetChips.map((preset) => {
                const isActive = activeGenrePreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyGenrePreset(preset.label)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-foreground hover:border-primary/50"
                    }`}
                    title={preset.summary}
                  >
                    {preset.label}
                  </button>
                );
              })}
              {visibleCustomGenres.map((genre) => {
                const isActive = form.genreLabel.trim().toLowerCase() === genre.toLowerCase();
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => applyGenreLabelWithTemplate(genre)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-foreground hover:border-primary/50"
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
              {visibleLastfmGenres.map((genre) => (
                <button
                  key={`lastfm-${genre}`}
                  type="button"
                  onClick={() => applyGenreLabelWithTemplate(genre)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    form.genreLabel.trim().toLowerCase() === genre.toLowerCase()
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-foreground hover:border-primary/50"
                  }`}
                  title="Genre issu du catalogue Last.fm"
                >
                  {genre}
                </button>
              ))}
              {canAddCustomGenre && (
                <button
                  type="button"
                  onClick={addCustomGenre}
                  className="shrink-0 rounded-full border border-dashed border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  + Ajouter « {genreQuery.trim()} »
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <DualRangeField
              label="BPM"
              value={form.bpm}
              min={0}
              max={300}
              step={10}
              suffix=""
              lowLabel="lent / ambient"
              highLabel="rapide / blast"
              guidance="Fourchette de tempo moyen des morceaux réellement acceptés."
              tooltipLines={[
                "Monte les deux curseurs pour les playlists rapides (métal, punk, DnB…).",
                "Laisse bas pour l'ambient, le doom, le post-rock lent.",
                "La moyenne de la plage sera utilisée pour le matching.",
              ]}
              tickStep={50}
              fillClassName="bg-primary"
              thumbClassName="[&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full"
              valueClassName="text-primary"
              onChange={setRange("bpm")}
            />
            <DualRangeField
              label="Énergie"
              value={form.energy}
              min={0}
              max={100}
              step={10}
              suffix="%"
              lowLabel="posé / aéré"
              highLabel="dense / agressif"
              guidance="Intensité et impact sonore attendus."
              tooltipLines={[
                "Monte si la playlist veut des mix compacts, percussifs, peu d'espace dynamique.",
                "Baisse pour des sons plus doux, aérés ou dynamiquement larges.",
              ]}
              tickStep={10}
              fillClassName="bg-orange-500"
              thumbClassName="[&::-webkit-slider-thumb]:bg-orange-500 [&::-moz-range-thumb]:bg-orange-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full"
              valueClassName="text-orange-500"
              onChange={setRange("energy")}
            />
            <DualRangeField
              label="Danceabilité"
              value={form.danceability}
              min={0}
              max={100}
              step={10}
              suffix="%"
              lowLabel="libre / cassé"
              highLabel="groove stable"
              guidance="Régularité et portance rythmique des morceaux."
              tooltipLines={[
                "Monte si les morceaux doivent avoir un groove stable et entraînant.",
                "Baisse pour les structures heurtées, syncopées ou atmosphériques.",
              ]}
              tickStep={10}
              fillClassName="bg-violet-500"
              thumbClassName="[&::-webkit-slider-thumb]:bg-violet-500 [&::-moz-range-thumb]:bg-violet-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full"
              valueClassName="text-violet-500"
              onChange={setRange("danceability")}
            />
            <DualRangeField
              label="Valence"
              value={form.valence}
              min={0}
              max={100}
              step={10}
              suffix="%"
              lowLabel="sombre / tendu"
              highLabel="lumineux / euphorique"
              guidance="Couleur émotionnelle globale attendue."
              tooltipLines={[
                "Baisse pour les playlists sombres, mélancoliques, dark ou agressives.",
                "Monte pour les sonorités légères, solaires ou euphorisantes.",
              ]}
              tickStep={10}
              fillClassName="bg-yellow-400"
              thumbClassName="[&::-webkit-slider-thumb]:bg-yellow-400 [&::-moz-range-thumb]:bg-yellow-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full"
              valueClassName="text-yellow-400"
              onChange={setRange("valence")}
            />
            <DualRangeField
              label="Acoustique"
              value={form.acousticness}
              min={0}
              max={100}
              step={10}
              suffix="%"
              lowLabel="produit / électrique"
              highLabel="organique / unplugged"
              guidance="Proportion de matière acoustique naturelle vs traitement électronique."
              tooltipLines={[
                "Baisse si la playlist préfère les batteries traitées, synthés, saturations.",
                "Monte si les morceaux doivent sonner live, boisé, peu transformé.",
              ]}
              tickStep={10}
              fillClassName="bg-teal-400"
              thumbClassName="[&::-webkit-slider-thumb]:bg-teal-400 [&::-moz-range-thumb]:bg-teal-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full"
              valueClassName="text-teal-400"
              onChange={setRange("acousticness")}
            />
            <DualRangeField
              label="Speechiness"
              value={form.speechiness}
              min={0}
              max={100}
              step={10}
              suffix="%"
              lowLabel="chant / instrumental"
              highLabel="parlé / rap / spoken"
              guidance="Part de vocal parlé, rythmique ou débité dans les morceaux."
              tooltipLines={[
                "Monte si la playlist accueille le rap, spoken word ou voix très articulées.",
                "Laisse bas pour l'instrumental, le chant mélodique ou les nappes vocales.",
              ]}
              tickStep={10}
              fillClassName="bg-sky-400"
              thumbClassName="[&::-webkit-slider-thumb]:bg-sky-400 [&::-moz-range-thumb]:bg-sky-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full"
              valueClassName="text-sky-400"
              onChange={setRange("speechiness")}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Envoi..." : "Ajouter la playlist"}
          </button>
          {curatorPlatformSuggestion && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                void submitPlaylist(true);
              }}
              className="rounded-[var(--radius)] border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ajouter comme nouvelle plateforme ({curatorPlatformSuggestion.existingPlatforms.join(", ")})
            </button>
          )}
        </div>

        {feedback ? (
          <div aria-live="polite">
            <ViewState
              variant="success"
              title="Soumission réussie"
              description={feedback}
            />
          </div>
        ) : null}
        {error ? (
          <div aria-live="assertive">
            <ViewState
              variant="error"
              title="Soumission impossible"
              description={error}
            />
          </div>
        ) : null}
      </form>
    </section>
  );
}
