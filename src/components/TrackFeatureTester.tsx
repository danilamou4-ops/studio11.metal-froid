"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { analyzeLocalAudioFile } from "@/features/audio-features/analyzeLocalFile";
import type { CanonicalAudioFeatures } from "@/features/audio-features/types";
import { useArtistProfile } from "@/features/artist-profile/useArtistProfile";
import { profileToFeatures } from "@/features/artist-profile/profileToFeatures";
import { AudioFeaturesCard } from "@/components/AudioFeaturesCard";
import { TopPlaylistsView } from "@/components/TopPlaylistsView";
import { ViewState } from "@/components/ui/view-state";
import type { PlaylistResult, ScoreModeSummary } from "@/components/TopPlaylistsView";

type AnalysisMeta = {
  fileName: string;
  warnings: string[];
  sourceLabel?: string;
};

type SearchResultData = {
  sourceType: "feature-search";
  totalCandidates: number;
  results: PlaylistResult[];
};

type SearchResponse = {
  data: SearchResultData;
  meta: { partial: boolean; scoreModeSummary?: ScoreModeSummary };
};

type LastMatchHint = {
  fileName: string;
  count: number;
};

const LAST_MATCH_KEY = "mf-last-match";

export function TrackFeatureTester() {
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<AnalysisMeta | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [analyzedFeatures, setAnalyzedFeatures] = useState<CanonicalAudioFeatures | null>(null);
  const [lastMatch, setLastMatch] = useState<LastMatchHint | null>(null);
  const { profile } = useArtistProfile();

  // Read session hint
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LAST_MATCH_KEY);
      if (raw) setLastMatch(JSON.parse(raw) as LastMatchHint);
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  function persistLastMatch(fileName: string, count: number) {
    try {
      const hint: LastMatchHint = { fileName, count };
      sessionStorage.setItem(LAST_MATCH_KEY, JSON.stringify(hint));
      setLastMatch(hint);
    } catch {
      // ignore
    }
  }

  async function onAnalyzeLocalFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!localFile) return;

    setLocalLoading(true);
    setAnalysisError(null);
    setAnalysisMeta(null);
    setAnalyzedFeatures(null);
    setSearchResult(null);
    try {
      const analysis = await analyzeLocalAudioFile(localFile);
      setAnalyzedFeatures(analysis.features);
      const isEssentia = analysis.method === "essentia";
      setAnalysisMeta({
        fileName: localFile.name,
        warnings: isEssentia
          ? []
          : ["Analyse locale heuristique (Essentia.js non disponible)."],
        sourceLabel: isEssentia ? "Essentia.js · WASM" : "Local · heuristique",
      });
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Analyse impossible.");
    } finally {
      setLocalLoading(false);
    }
  }

  async function onMatchPlaylists() {
    if (!analyzedFeatures) return;

    setSearchLoading(true);
    setSearchResult(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: analyzedFeatures, limit: 20 }),
      });
      const payload = (await response.json()) as SearchResponse;
      setSearchResult(payload);
      persistLastMatch(
        analysisMeta?.fileName ?? "—",
        payload.data?.results?.length ?? 0,
      );
    } finally {
      setSearchLoading(false);
    }
  }

  async function onMatchWithProfile() {
    if (!profile) return;
    const features = profileToFeatures(profile);
    setAnalyzedFeatures(features);
    setAnalysisMeta({
      fileName: "Profil artiste",
      warnings: ["Matching basé sur ton profil musical — sans analyse de fichier."],
      sourceLabel: "Profil · estimé",
    });
    setSearchResult(null);
    setSearchLoading(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features, limit: 20 }),
      });
      const payload = (await response.json()) as SearchResponse;
      setSearchResult(payload);
      persistLastMatch("Profil artiste", payload.data?.results?.length ?? 0);
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <section className="space-y-6">

      {/* ── Analyse locale ──────────────────────────────────────── */}
      <form
        onSubmit={onAnalyzeLocalFile}
        className="rounded-[var(--radius)] border border-border bg-card p-5 md:p-6 shadow-sm"
      >
        <p className="mb-1 text-sm font-semibold text-foreground">Analyse locale</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Upload un fichier MP3 ou WAV — BPM, énergie et tonalité estimés directement dans le navigateur.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm"
            aria-label="Sélectionner un fichier audio"
            onChange={(event) => setLocalFile(event.target.files?.[0] ?? null)}
            className="block flex-1 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={!localFile || localLoading}
            className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {localLoading ? "Analyse en cours..." : "Analyser"}
          </button>
        </div>
        {analysisError && (
          <ViewState
            variant="error"
            className="mt-3"
            title="Analyse impossible"
            description={analysisError}
          >
            <p className="inline-flex items-center gap-1 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Vérifie le format du fichier ou relance une nouvelle analyse.</span>
            </p>
          </ViewState>
        )}
      </form>

      {/* ── Profile shortcut card ───────────────────────────────── */}
      {profile && profile.genres.length > 0 && !searchResult && (
        <div className="flex items-start justify-between gap-4 rounded-[var(--radius)] border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Matcher depuis mon profil artiste
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {profile.genres.join(" · ")}
              {profile.bpmMin ?? profile.bpmMax
                ? ` · ${profile.bpmMin ?? "?"}–${profile.bpmMax ?? "?"} BPM`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onMatchWithProfile}
            disabled={searchLoading}
            className="shrink-0 rounded-[var(--radius)] bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searchLoading ? "Matching..." : "Lancer le matching"}
          </button>
        </div>
      )}

      {/* ── Recent results hint ─────────────────────────────────── */}
      {lastMatch && !analyzedFeatures && (
        <div className="flex items-center justify-between rounded-[var(--radius)] bg-muted/50 px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            Dernière analyse&nbsp;:{" "}
            <span className="font-medium text-foreground">{lastMatch.fileName}</span>
            {" "}·{" "}
            <span className="font-medium text-foreground">{lastMatch.count}</span>
            {" "}résultats
          </span>
          <button
            type="button"
            onClick={() => setLastMatch(null)}
            className="ml-4 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
      )}

      {!analyzedFeatures && !searchResult && (
        <ViewState
          variant="empty"
          title="Aucune analyse en cours"
          description="Commence par uploader un fichier audio, ou lance un matching direct depuis ton profil pour obtenir des recommandations immédiatement."
        />
      )}

      {/* ── Audio features result ───────────────────────────────── */}
      {analyzedFeatures && analysisMeta && (
        <AudioFeaturesCard
          features={analyzedFeatures}
          fileName={analysisMeta.fileName}
          warnings={analysisMeta.warnings}
          sourceLabel={analysisMeta.sourceLabel}
        />
      )}

      {/* ── Match button ────────────────────────────────────────── */}
      {analyzedFeatures && (
        <div className="flex items-center justify-between rounded-[var(--radius)] border border-primary/30 bg-primary/10 px-4 py-3">
          <p className="text-sm text-foreground">Features prêtes — lance le matching curateurs</p>
          <button
            type="button"
            onClick={onMatchPlaylists}
            disabled={searchLoading}
            className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searchLoading ? "Matching..." : "Trouver les playlists"}
          </button>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────── */}
      {searchResult?.data?.results && searchResult.data.results.length > 0 && (
        <TopPlaylistsView
          results={searchResult.data.results}
          totalCandidates={searchResult.data.totalCandidates}
          scoreModeSummary={searchResult.meta?.scoreModeSummary}
        />
      )}

      {searchResult && (!searchResult.data?.results || searchResult.data.results.length === 0) && (
        <ViewState
          variant="empty"
          title="Aucun résultat trouvé"
          description="Aucune playlist ne correspond à cette recherche pour le moment."
        />
      )}

    </section>
  );
}

