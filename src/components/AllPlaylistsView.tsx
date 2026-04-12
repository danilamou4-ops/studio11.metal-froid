"use client";

// CONVENTION PROJET : icons over emojis — utiliser lucide-react systématiquement

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, ChevronDown, ChevronRight, Link2, Mail, MessageSquare, Shield, ThumbsDown, ThumbsUp } from "lucide-react";
import { PlatformBadges } from "@/lib/platformConfig";
import { CommunityFeedbackPanel } from "./CommunityFeedbackPanel";
import { ReportQualityIssueButton } from "./QualityTicketPanel";
import { StatusBadge } from "./ContributionStatusDisplay";
import { ViewState } from "@/components/ui/view-state";

type PlaylistItem = {
  playlistId: string;
  playlistName: string;
  playlistUrl: string;
  platforms: string[];
  platformUrls: string[];
  description: string | null;
  genreLabel: string | null;
  followers: number | null;
  curatorId: string | null;
  curatorName: string | null;
  curatorCountry: string | null;
  curatorContactUrl: string | null;
  curatorInstagramUrl: string | null;
  curatorEmail: string | null;
  contribution_status?: 'draft' | 'active' | 'rejected' | 'archived';
  quality_confidence?: number | null;
  feedbackSignals?: {
    upvotes: number;
    downvotes: number;
    reviews: number;
    sentimentScore: number;
  } | null;
};

type TrustLevel = {
  label: string;
  tone: string;
  detail: string;
  score: number;
};

type PlaylistsResponse = {
  data: {
    total: number;
    results: PlaylistItem[];
  };
};

function trackClickEvent(playlistId: string, clickedUrl: string) {
  void fetch("/api/telemetry/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playlistId, clickedUrl }),
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

function getPreferredCuratorContact(item: PlaylistItem): { href: string; label: string; actionLabel: string; icon: "instagram" | "mail" | "link" } | null {
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

function getTrustLevel(item: PlaylistItem): TrustLevel {
  const baseConfidence = item.quality_confidence ?? 0.55;
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
    detail: `Signal à surveiller: feedback communautaire encore faible ou mitigé.`,
    score: adjustedScore,
  };
}

function TrustBadge({ item }: { item: PlaylistItem }) {
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

function CommunitySignals({ signals, className = "" }: { signals: PlaylistItem["feedbackSignals"]; className?: string }) {
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

export function AllPlaylistsView({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/playlists", { cache: "no-store" });
        const payload = (await response.json()) as PlaylistsResponse;
        if (!response.ok) {
          throw new Error("Impossible de charger les playlists.");
        }
        if (!canceled) {
          setItems(payload.data.results ?? []);
        }
      } catch (e) {
        if (!canceled) {
          setError(e instanceof Error ? e.message : "Erreur inconnue.");
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      canceled = true;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      return [p.playlistName, p.genreLabel, p.curatorName, p.curatorCountry]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [items, query]);

  if (loading) {
    return (
      <ViewState
        variant="loading"
        title="Chargement des playlists"
        description="Récupération de la liste en cours..."
      />
    );
  }

  if (error) {
    return (
      <ViewState
        variant="error"
        title="Erreur de chargement"
        description={error}
      />
    );
  }

  return (
    <section className="space-y-6 rounded-[var(--radius)] border border-border bg-card p-5 md:p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Toutes les playlists</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} affichées · {items.length} actives</p>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher playlist, genre, curator..."
          className="w-full max-w-xs rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {filtered.length === 0 ? (
        <ViewState
          variant="empty"
          title="Aucune playlist à afficher"
          description={query.trim() ? "Aucun résultat pour cette recherche." : "Aucune playlist active pour le moment."}
        />
      ) : null}

      <ol className="space-y-3">
        {filtered.map((item) => {
          const preferredContact = getPreferredCuratorContact(item);
          const isExpanded = expandedId === item.playlistId;
          
          return (
            <li key={item.playlistId} className="rounded-[var(--radius)] border border-border bg-card p-4">
              {/* Header: Playlist info + status badge */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {item.playlistName}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {item.genreLabel && (
                      <span className="rounded-full border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary">{item.genreLabel}</span>
                    )}
                    {item.contribution_status && (
                      <StatusBadge status={item.contribution_status} size="sm" />
                    )}
                    <TrustBadge item={item} />
                    <CommunitySignals signals={item.feedbackSignals} className="hidden md:inline-flex" />
                  </div>

                  {item.platforms.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <PlatformBadges
                        platforms={item.platforms}
                        platformUrls={item.platformUrls}
                        fallbackUrl={item.playlistUrl}
                        playlistId={item.playlistId}
                        onTrackClick={trackClickEvent}
                        maxVisible={3}
                      />
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.curatorName ?? "Curateur inconnu"}
                    {item.curatorCountry ? ` · ${item.curatorCountry}` : ""}
                    {item.followers != null ? ` · ${item.followers.toLocaleString("fr-FR")} abonnés` : ""}
                  </p>
                  {item.description && (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:line-clamp-2" title={item.description}>
                      {item.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {preferredContact ? (
                      <a
                        href={preferredContact.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackClickEvent(item.playlistId, preferredContact.href)}
                        className="inline-flex w-full items-center justify-center rounded-[var(--radius)] border border-border px-3 py-2 text-xs font-medium text-foreground hover:border-primary/50 transition-colors sm:w-auto sm:justify-start"
                      >
                        <span aria-hidden="true"><ContactIcon icon={preferredContact.icon} /></span>
                        <span className="ml-1">{preferredContact.actionLabel}</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground">
                        Aucun contact
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expandable: Community feedback & quality tickets */}
              <div className="border-t border-border pt-3">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.playlistId)}
                  className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <span>{isExpanded ? "Masquer" : "Avis & Signalements"}</span>
                </button>

                {isExpanded && (
                  <div className="space-y-4 mt-3">
                    {/* Community Feedback */}
                    <div className="border-l-2 border-primary/30 pl-4">
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        <span>Avis de la communauté</span>
                      </h4>
                      <CommunityFeedbackPanel
                        targetType="playlist"
                        targetId={item.playlistId}
                        curatorId={item.curatorId}
                        className="text-sm"
                      />
                    </div>

                    {/* Quality Report */}
                    <div className="border-l-2 border-orange-300 pl-4">
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                        <span>Signaler un problème</span>
                      </h4>
                      <ReportQualityIssueButton playlistId={item.playlistId} />
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
