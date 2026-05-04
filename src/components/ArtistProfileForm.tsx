"use client";

import { useEffect, useState } from "react";
import { BarChart3, Check, MessageSquare, Shield, ThumbsDown, ThumbsUp, Users, Zap } from "lucide-react";

import dynamic from "next/dynamic";

const AdminContributionPanel = dynamic(
  () =>
    import("@/components/AdminContributionPanel").then((m) => ({
      default: m.AdminContributionPanel,
    })),
  { loading: () => <div className="animate-pulse h-32 bg-muted rounded" /> },
);
import { AccountSettingsCard } from "@/components/AccountSettingsCard";
import { ViewState } from "@/components/ui/view-state";
import { useTeamRole } from "@/features/auth/useTeamRole";
import { useArtistProfile } from "@/features/artist-profile/useArtistProfile";
import { EMPTY_PROFILE, type ArtistProfile } from "@/features/artist-profile/types";

const GENRE_SUGGESTIONS = [
  "rap conscient",
  "rap underground",
  "rap mélancolique",
  "hip-hop",
  "trap",
  "drill",
  "boom bap",
  "lo-fi",
  "r&b",
  "soul",
  "jazz",
  "indie",
  "folk",
  "électro",
];

type DbStats = {
  playlists: number;
  curators: number;
  vectorized: number;
  community?: {
    upvotes: number;
    downvotes: number;
    reviews: number;
    totalVotes: number;
    positiveRate: number;
    riskPlaylists: number;
  };
  qualityTickets?: {
    open: number;
  };
  governance?: {
    borderlineQueue: number;
    overdueManualReviews: number;
  };
};

export function ArtistProfileForm() {
  const { isAdmin, loaded: roleLoaded } = useTeamRole();
  const { profile, loaded, saveProfile, clearProfile } = useArtistProfile();
  const [form, setForm] = useState<ArtistProfile>(EMPTY_PROFILE);
  const [genreInput, setGenreInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stats, setStats] = useState<DbStats | null>(null);

  // Pré-remplit le formulaire dès que le profil est chargé depuis l'API
  useEffect(() => {
    if (loaded && profile) setForm(profile);
  }, [loaded, profile]);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data: DbStats) => setStats(data))
      .catch(() => {});
  }, []);

  function set<K extends keyof ArtistProfile>(key: K, value: ArtistProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function addGenre(genre: string) {
    const cleaned = genre.trim().toLowerCase();
    if (!cleaned || form.genres.includes(cleaned)) return;
    set("genres", [...form.genres, cleaned]);
    setGenreInput("");
  }

  function removeGenre(genre: string) {
    set("genres", form.genres.filter((g) => g !== genre));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setSaveError(null);
      await saveProfile(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Impossible de sauvegarder le profil.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    try {
      setSaving(true);
      setSaveError(null);
      await clearProfile();
      setForm(EMPTY_PROFILE);
      setSaved(false);
    } catch {
      setSaveError("Impossible de reinitialiser le profil.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <ViewState
        variant="loading"
        title="Chargement du profil"
        description="Récupération des préférences en cours..."
      />
    );
  }

  return (
    <div className="space-y-6">
      <AccountSettingsCard />

      {roleLoaded && isAdmin ? <AdminContributionPanel /> : null}

      <div className="space-y-3 rounded-[var(--radius)] border border-border bg-card p-5 md:p-6 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-foreground">État des playlists</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Vue globale des playlists, de la confiance communautaire et des tickets qualité.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 rounded-[var(--radius)] border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 size={14} className="shrink-0 text-primary/70" />
            <span>
              <span className="font-medium text-foreground">{stats?.playlists ?? "—"}</span>
              {" "}playlists actives
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users size={14} className="shrink-0 text-primary/70" />
            <span>
              <span className="font-medium text-foreground">{stats?.curators ?? "—"}</span>
              {" "}curateurs
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap size={14} className="shrink-0 text-primary/70" />
            <span>
              <span className="font-medium text-foreground">{stats?.vectorized ?? "—"}</span>
              {" "}vectorisées
            </span>
          </div>
        </div>

        <div className="grid gap-3 rounded-[var(--radius)] border border-border bg-card px-4 py-3 md:grid-cols-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield size={14} className="shrink-0 text-primary/70" />
            <span>
              Confiance positive&nbsp;:
              <span className="ml-1 font-medium text-foreground">
                {stats?.community ? `${Math.round(stats.community.positiveRate * 100)}%` : "—"}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ThumbsUp size={14} className="shrink-0 text-emerald-600" />
            <span>
              {stats?.community?.upvotes ?? "—"} positifs
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ThumbsDown size={14} className="shrink-0 text-red-600" />
            <span>
              {stats?.community?.downvotes ?? "—"} critiques
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare size={14} className="shrink-0 text-primary/70" />
            <span>
              {stats?.community?.reviews ?? "—"} avis
            </span>
          </div>
        </div>

        <div className="grid gap-3 rounded-[var(--radius)] border border-border bg-card px-4 py-3 md:grid-cols-2">
          <div className="text-sm text-muted-foreground">
            Playlists à risque (feedback négatif {'>'} 40% / 7j):
            <span className="ml-2 font-medium text-foreground">{stats?.community?.riskPlaylists ?? "—"}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Tickets qualité ouverts:
            <span className="ml-2 font-medium text-foreground">{stats?.qualityTickets?.open ?? "—"}</span>
          </div>
        </div>

        {roleLoaded && isAdmin ? (
          <div className="grid gap-3 rounded-[var(--radius)] border border-border bg-card px-4 py-3 md:grid-cols-2">
            <div className="text-sm text-muted-foreground">
              File borderline:
              <span className="ml-2 font-medium text-foreground">{stats?.governance?.borderlineQueue ?? "—"}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Revues hors SLA:
              <span className="ml-2 font-medium text-foreground">{stats?.governance?.overdueManualReviews ?? "—"}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-6 rounded-[var(--radius)] border border-border bg-card p-5 md:p-6 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-foreground">Profil Musical</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sauvegarde en base, unique a ton compte connecte.
          </p>
        </div>

        {/* Genres */}
        <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">Genres / Univers</label>
        <div className="flex flex-wrap gap-1.5">
          {form.genres.map((g) => (
            <span
              key={g}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {g}
              <button
                type="button"
                onClick={() => removeGenre(g)}
                aria-label={`Supprimer ${g}`}
                className="ml-0.5 text-primary/70 hover:text-primary"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={genreInput}
            onChange={(e) => setGenreInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addGenre(genreInput); }
            }}
            placeholder="ex: rap conscient"
            className="flex-1 rounded-[var(--radius)] border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => addGenre(genreInput)}
            className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
          >
            Ajouter
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {GENRE_SUGGESTIONS.filter((s) => !form.genres.includes(s)).slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addGenre(s)}
              className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-foreground hover:bg-muted"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

        {/* Influences */}
        <div>
        <label className="block text-sm font-medium text-foreground">Influences / Artistes similaires</label>
        <input
          type="text"
          value={form.influences}
          onChange={(e) => set("influences", e.target.value)}
          placeholder="ex: Médine, Nekfeu, Oxmo Puccino, Kendrick Lamar"
          className="mt-1 w-full rounded-[var(--radius)] border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

        {/* Langue */}
        <div>
        <label className="block text-sm font-medium text-foreground">Langue des textes</label>
        <div className="mt-1 flex gap-3">
          {(["fr", "en", "fr+en"] as const).map((l) => (
            <label key={l} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="langue"
                value={l}
                checked={form.langue === l}
                onChange={() => set("langue", l)}
              />
              {l === "fr" ? "Français" : l === "en" ? "Anglais" : "Les deux"}
            </label>
          ))}
        </div>
      </div>

        {/* BPM */}
        <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground">BPM min</label>
          <input
            type="number"
            min={60}
            max={200}
            value={form.bpmMin ?? ""}
            onChange={(e) => set("bpmMin", e.target.value ? Number(e.target.value) : null)}
            placeholder="ex: 85"
            className="mt-1 w-full rounded-[var(--radius)] border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">BPM max</label>
          <input
            type="number"
            min={60}
            max={200}
            value={form.bpmMax ?? ""}
            onChange={(e) => set("bpmMax", e.target.value ? Number(e.target.value) : null)}
            placeholder="ex: 105"
            className="mt-1 w-full rounded-[var(--radius)] border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

        {/* Énergie */}
        <div>
        <label className="block text-sm font-medium text-foreground">Énergie générale</label>
        <div className="mt-1 flex gap-3">
          {([null, "faible", "moyen", "élevé"] as const).map((e) => (
            <label key={String(e)} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="energy"
                value={String(e)}
                checked={form.energy === e}
                onChange={() => set("energy", e)}
              />
              {e === null ? "Non défini" : e.charAt(0).toUpperCase() + e.slice(1)}
            </label>
          ))}
        </div>
      </div>

        {/* Ambiance */}
        <div>
        <label className="block text-sm font-medium text-foreground">Ambiance / Contexte d&apos;écoute</label>
        <input
          type="text"
          value={form.ambiance}
          onChange={(e) => set("ambiance", e.target.value)}
          placeholder="ex: introspectif, nocturne, dense, concentration"
          className="mt-1 w-full rounded-[var(--radius)] border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

        {/* Marché */}
        <div>
        <label className="block text-sm font-medium text-foreground">Marché prioritaire</label>
        <input
          type="text"
          value={form.marchePrioritaire}
          onChange={(e) => set("marchePrioritaire", e.target.value)}
          placeholder="ex: France, Belgique, Québec"
          className="mt-1 w-full rounded-[var(--radius)] border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

        {/* Niveau mainstream */}
        <div>
        <label className="block text-sm font-medium text-foreground">Positionnement</label>
        <div className="mt-1 flex gap-3">
          {(["underground", "indépendant", "mainstream"] as const).map((n) => (
            <label key={n} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="niveauMainstream"
                value={n}
                checked={form.niveauMainstream === n}
                onChange={() => set("niveauMainstream", n)}
              />
              {n.charAt(0).toUpperCase() + n.slice(1)}
            </label>
          ))}
        </div>
      </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Réinitialiser le profil
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {saved && !saving ? <Check className="h-4 w-4" /> : null}
          <span>{saving ? "Sauvegarde..." : saved ? "Sauvegardé" : "Sauvegarder"}</span>
        </button>
        </div>
        {saved && !saving ? (
          <ViewState
            variant="success"
            title="Profil sauvegardé"
            description="Tes préférences musicales ont bien été enregistrées."
          />
        ) : null}
        {saveError ? (
          <ViewState
            variant="error"
            title="Sauvegarde impossible"
            description={saveError}
          />
        ) : null}
      </div>
    </div>
  );
}
