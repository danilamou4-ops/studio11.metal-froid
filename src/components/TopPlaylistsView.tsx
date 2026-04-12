"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Check, Copy, Download, Headphones, Link2, Mail, Shield, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { PlatformBadges } from "@/lib/platformConfig";

// ─── CSV export ──────────────────────────────────────────────────────────────
function escapeCsv(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportToCsv(items: PlaylistResult[]) {
  const header = ["Playlist", "URL", "Curateur", "Email", "Instagram", "Contact URL", "Score (%)"];
  const rows = items.map((r) => [
    escapeCsv(r.playlistName),
    escapeCsv(r.playlistUrl),
    escapeCsv(r.curatorName),
    escapeCsv(r.curatorEmail),
    escapeCsv(r.curatorInstagramUrl),
    escapeCsv(r.curatorContactUrl),
    String(r.score),
  ]);
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `curator-match-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildContactsText(items: PlaylistResult[]): string {
  return items
    .map((r) => {
      const parts = [r.playlistName];
      if (r.curatorName) parts.push(r.curatorName);
      if (r.curatorEmail) parts.push(r.curatorEmail);
      if (r.curatorInstagramUrl) parts.push(r.curatorInstagramUrl);
      if (r.curatorContactUrl) parts.push(r.curatorContactUrl);
      return parts.join(" | ");
    })
    .join("\n");
}

type ScoreMode = "direct" | "genre-template" | "popularity";

type MatchedSignal = {
  label: string;
  similarity: number;
};

export type PlaylistResult = {
  playlistId: string;
  playlistName: string;
  playlistUrl: string;
  platforms: string[];
  platformUrls: string[];
  description: string | null;
  curatorName: string | null;
  curatorCountry: string | null;
  curatorContactUrl: string | null;
  curatorInstagramUrl: string | null;
  curatorEmail: string | null;
  genreLabel: string | null;
  followers: number | null;
  score: number;
  confidence: number;
  qualityConfidence?: number | null;
  feedbackSignals?: {
    upvotes: number;
    downvotes: number;
    reviews: number;
    sentimentScore: number;
  } | null;
  scoreMode: ScoreMode;
  matchedSignals: MatchedSignal[];
};

type TrustLevel = {
  label: string;
  tone: string;
  detail: string;
  score: number;
};

export type ScoreModeSummary = {
  direct: number;
  "genre-template": number;
  popularity: number;
};

type Props = {
  results: PlaylistResult[];
  totalCandidates: number;
  scoreModeSummary?: ScoreModeSummary;
};

const MODE_LABEL: Record<ScoreMode, string> = {
  direct: "Signaux directs",
  "genre-template": "Template genre",
  popularity: "Popularité",
};

const MODE_CLASS: Record<ScoreMode, string> = {
  direct: "bg-primary/10 text-primary border border-primary/30",
  "genre-template": "bg-muted text-muted-foreground border border-border",
  popularity: "bg-muted text-muted-foreground border border-border",
};

const SIGNAL_LABELS: Record<string, string> = {
  bpm: "BPM",
  energy: "Énergie",
  danceability: "Danceabilité",
  valence: "Valence",
  acousticness: "Acoustique",
  speechiness: "Speechiness",
  genre: "Contexte genre",
};

function explainSignals(signals: MatchedSignal[]): string[] {
  if (signals.length === 0) return [];
  const sorted = [...signals].sort((a, b) => b.similarity - a.similarity);
  return sorted.slice(0, 3).map((s) => {
    const name = SIGNAL_LABELS[s.label] ?? s.label;
    const pct = Math.round(s.similarity * 100);
    if (pct >= 85) return `${name} très aligné (${pct}%)`;
    if (pct >= 60) return `${name} compatible (${pct}%)`;
    return `${name} proche (${pct}%)`;
  });
}

function ScoreBar({ score }: { score: number }) {
  const scoreLabel = score >= 85 ? "Match fort" : score >= 70 ? "Match solide" : "Match exploratoire";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all [width:var(--bar-w)]" style={{ "--bar-w": `${score}%` } as React.CSSProperties} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-muted-foreground">{score}%</span>
      <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
        {scoreLabel}
      </span>
    </div>
  );
}

function SummaryBadge({ label, count, className }: { label: string; count: number; className: string }) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border ${className}`}>
      {count} {label}
    </span>
  );
}

function trackClickEvent(playlistId: string, clickedUrl: string) {
  // Fire-and-forget telemetry to keep navigation instant.
  void fetch("/api/telemetry/click", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playlistId,
      clickedUrl,
    }),
    keepalive: true,
  });
}

function getLinkLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return `Infos contact · ${hostname}`;
  } catch {
    return "Infos contact";
  }
}

function getPreferredCuratorContact(item: PlaylistResult): { href: string; label: string; actionLabel: string; icon: "instagram" | "mail" | "link" } | null {
  if (item.curatorInstagramUrl) {
    return { href: item.curatorInstagramUrl, label: "Instagram", actionLabel: "Contacter sur Instagram", icon: "instagram" };
  }

  if (item.curatorEmail) {
    return { href: `mailto:${item.curatorEmail}`, label: "Email", actionLabel: "Contacter par email", icon: "mail" };
  }

  if (item.curatorContactUrl) {
    return { href: item.curatorContactUrl, label: getLinkLabel(item.curatorContactUrl), actionLabel: "Ouvrir le canal de contact", icon: "link" };
  }

  return null;
}

function ContactIcon({ icon }: { icon: "instagram" | "mail" | "link" }) {
  if (icon === "instagram") return <Camera className="h-3.5 w-3.5" />;
  if (icon === "mail") return <Mail className="h-3.5 w-3.5" />;
  return <Link2 className="h-3.5 w-3.5" />;
}

function getTrustLevel(item: PlaylistResult): TrustLevel {
  const baseConfidence = item.qualityConfidence ?? Math.max(0.45, Math.min(0.92, item.confidence));
  const totalVotes = (item.feedbackSignals?.upvotes ?? 0) + (item.feedbackSignals?.downvotes ?? 0);
  const reviews = item.feedbackSignals?.reviews ?? 0;
  const sentiment = item.feedbackSignals?.sentimentScore ?? 0;
  const sampleWeight = Math.min(0.18, totalVotes * 0.03 + reviews * 0.015);
  const adjustedScore = Math.max(0, Math.min(1, baseConfidence + sentiment * sampleWeight));

  if (adjustedScore >= 0.75) {
    return {
      label: "Confiance élevée",
      tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
      detail: `Qualité solide, ${totalVotes} vote(s) et ${reviews} avis pris en compte.`,
      score: adjustedScore,
    };
  }

  if (adjustedScore >= 0.5) {
    return {
      label: "Confiance modérée",
      tone: "border-amber-500/40 bg-amber-500/10 text-amber-400",
      detail: `À confirmer avec plus de signaux communautaires (${totalVotes} vote(s), ${reviews} avis).`,
      score: adjustedScore,
    };
  }

  return {
    label: "Confiance fragile",
    tone: "border-red-500/40 bg-red-500/10 text-red-400",
    detail: "Signal à surveiller: feedback communautaire encore faible ou mitigé.",
    score: adjustedScore,
  };
}

function TrustBadge({ item }: { item: PlaylistResult }) {
  const trust = getTrustLevel(item);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${trust.tone}`}
      title={trust.detail}
    >
      <Shield className="h-3.5 w-3.5" />
      <span>{trust.label}</span>
      <span className="tabular-nums">{Math.round(trust.score * 100)}%</span>
    </span>
  );
}

function CommunitySignals({ signals, className = "" }: { signals: PlaylistResult["feedbackSignals"]; className?: string }) {
  if (!signals) return null;

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] text-muted-foreground ${className}`}>
      <span className="inline-flex items-center gap-1">
        <ThumbsUp className="h-3 w-3 text-emerald-600" />
        <span>{signals.upvotes}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <ThumbsDown className="h-3 w-3 text-red-600" />
        <span>{signals.downvotes}</span>
      </span>
      <span>{signals.reviews} avis</span>
    </div>
  );
}

export function TopPlaylistsView({ results, totalCandidates, scoreModeSummary }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [filterGenre, setFilterGenre] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterFollowersMin, setFilterFollowersMin] = useState("");
  const [compatibilityMin, setCompatibilityMin] = useState(0);
  const [compatibilityMax, setCompatibilityMax] = useState(100);
  const [copied, setCopied] = useState(false);
  const [clickedIds, setClickedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void fetch("/api/telemetry/clicks")
      .then((r) => r.json())
      .then((data: { playlistIds?: string[] }) => {
        if (data.playlistIds) {
          setClickedIds(new Set(data.playlistIds));
        }
      });
  }, []);

  const genres = useMemo(
    () => Array.from(new Set(results.map((r) => r.genreLabel).filter(Boolean) as string[])).sort(),
    [results],
  );

  const countries = useMemo(
    () => Array.from(new Set(results.map((r) => r.curatorCountry).filter(Boolean) as string[])).sort(),
    [results],
  );

  const filtered = useMemo(() => {
    const minFollowers = filterFollowersMin === "" ? 0 : parseInt(filterFollowersMin, 10);
    return results
      .filter((r) => {
        if (filterGenre && r.genreLabel !== filterGenre) return false;
        if (filterCountry && r.curatorCountry !== filterCountry) return false;
        if (minFollowers > 0 && (r.followers ?? 0) < minFollowers) return false;
        if (r.score < compatibilityMin || r.score > compatibilityMax) return false;
        return true;
      })
      .map((r) =>
        clickedIds.has(r.playlistId)
          ? { ...r, score: Math.min(100, Math.round(r.score * 1.05)) }
          : r,
      )
      .sort((a, b) => b.score - a.score);
  }, [results, filterGenre, filterCountry, filterFollowersMin, compatibilityMin, compatibilityMax, clickedIds]);

  const hasFilters =
    filterGenre !== "" ||
    filterCountry !== "" ||
    filterFollowersMin !== "" ||
    compatibilityMin !== 0 ||
    compatibilityMax !== 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-semibold text-foreground">Top playlists</h3>
          <span className="text-xs text-muted-foreground">
            {filtered.length}{hasFilters ? ` / ${results.length}` : ""} résultats · {totalCandidates} candidats
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scoreModeSummary && (
            <div className="flex flex-wrap gap-1.5">
              <SummaryBadge label={MODE_LABEL.direct} count={scoreModeSummary.direct} className={MODE_CLASS.direct} />
              <SummaryBadge label={MODE_LABEL["genre-template"]} count={scoreModeSummary["genre-template"]} className={MODE_CLASS["genre-template"]} />
              <SummaryBadge label={MODE_LABEL.popularity} count={scoreModeSummary.popularity} className={MODE_CLASS.popularity} />
            </div>
          )}
          {filtered.length > 0 && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => exportToCsv(filtered)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs text-foreground hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(buildContactsText(filtered)).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs text-foreground hover:bg-muted"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copié" : "Copier contacts"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-border bg-secondary px-3 py-2.5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Genre</label>
          <select
            value={filterGenre}
            aria-label="Filtrer par genre"
            onChange={(e) => setFilterGenre(e.target.value)}
            className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground"
          >
            <option value="">Tous</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Pays</label>
          <select
            value={filterCountry}
            aria-label="Filtrer par pays"
            onChange={(e) => setFilterCountry(e.target.value)}
            className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground"
          >
            <option value="">Tous</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Abonnés min.</label>
          <input
            type="number"
            min={0}
            step={100}
            value={filterFollowersMin}
            onChange={(e) => setFilterFollowersMin(e.target.value)}
            placeholder="ex: 1000"
            className="w-28 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground"
          />
        </div>
        <div className="min-w-48 flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Compatibilité min/max ({compatibilityMin}% - {compatibilityMax}%)
          </label>
          <div className="relative h-8 w-56">
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-secondary" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary [left:var(--compat-lo)] [right:var(--compat-hi)]"
              style={{
                "--compat-lo": `${compatibilityMin}%`,
                "--compat-hi": `${100 - compatibilityMax}%`,
              } as React.CSSProperties}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={compatibilityMin}
              aria-label="Compatibilité minimum"
              onChange={(e) => {
                const nextMin = Number(e.target.value);
                setCompatibilityMin(Math.min(nextMin, compatibilityMax));
              }}
              className="pointer-events-none absolute left-0 top-1/2 z-20 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-sm"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={compatibilityMax}
              aria-label="Compatibilité maximum"
              onChange={(e) => {
                const nextMax = Number(e.target.value);
                setCompatibilityMax(Math.max(nextMax, compatibilityMin));
              }}
              className="pointer-events-none absolute left-0 top-1/2 z-10 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-sm"
            />
          </div>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setFilterGenre("");
              setFilterCountry("");
              setFilterFollowersMin("");
              setCompatibilityMin(0);
              setCompatibilityMax(100);
            }}
            className="rounded-[var(--radius)] border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun résultat pour ces filtres.</p>
      ) : (
        <ol className="space-y-2">
          {filtered.map((item, idx) => {
            const reasons = explainSignals(item.matchedSignals);
            const preferredContact = getPreferredCuratorContact(item);
            return (
              <li
                key={item.playlistId}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
              >
                <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <a
                      href={item.playlistUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackClickEvent(item.playlistId, item.playlistUrl)}
                      className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground hover:underline"
                    >
                      {item.playlistName}
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.genreLabel && (
                      <span className="rounded-full border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary">
                        {item.genreLabel}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${MODE_CLASS[item.scoreMode]}`}
                      title={`Mode de scoring : ${item.scoreMode}`}
                    >
                      {MODE_LABEL[item.scoreMode]}
                    </span>
                    {clickedIds.has(item.playlistId) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                        <Check className="h-3 w-3" />
                        <span>Déjà contacté</span>
                      </span>
                    )}
                  </div>

                  {item.platforms.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PlatformBadges
                        platforms={item.platforms}
                        platformUrls={item.platformUrls}
                        fallbackUrl={item.playlistUrl}
                        playlistId={item.playlistId}
                        onTrackClick={trackClickEvent}
                        maxVisible={3}
                      />
                    </div>
                  ) : null}

                  {/* Infos curator */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {item.curatorName && (
                      <span className="inline-flex items-center gap-1">
                        <Headphones className="h-3.5 w-3.5" />
                        <span>{item.curatorName}</span>
                        {item.curatorCountry ? ` · ${item.curatorCountry}` : ""}
                      </span>
                    )}
                    {item.followers != null && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>{item.followers.toLocaleString("fr-FR")} abonnés</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {preferredContact ? (
                      <a
                        href={preferredContact.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackClickEvent(item.playlistId, preferredContact.href)}
                        className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 transition-colors"
                      >
                        <span aria-hidden="true"><ContactIcon icon={preferredContact.icon} /></span>
                        <span>{preferredContact.actionLabel}</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span>Aucun canal curateur dans le seed</span>
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="line-clamp-1 text-xs text-muted-foreground sm:line-clamp-2" title={item.description}>
                      {item.description}
                    </p>
                  )}

                  {/* Score + explicabilité */}
                  <div className="space-y-2 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <ScoreBar score={item.score} />
                      <TrustBadge item={item} />
                      <CommunitySignals signals={item.feedbackSignals} className="hidden md:inline-flex" />
                    </div>
                    {reasons.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {reasons.slice(0, 2).map((reason) => (
                          <li
                            key={reason}
                            className="rounded-full border border-border bg-secondary px-2 py-1 text-xs text-muted-foreground"
                          >
                            {reason}
                          </li>
                        ))}
                        {reasons.length > 2 ? (
                          <li className="rounded-full border border-border bg-secondary px-2 py-1 text-xs text-muted-foreground">
                            +{reasons.length - 2} raison{reasons.length - 2 > 1 ? "s" : ""}
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* JSON brut toggle */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {showRaw ? "Masquer" : "Voir"} le JSON brut
        </button>
        {showRaw && (
          <pre className="mt-2 overflow-x-auto rounded-md bg-secondary p-3 text-xs text-foreground">
            {JSON.stringify({ results, totalCandidates, scoreModeSummary }, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
