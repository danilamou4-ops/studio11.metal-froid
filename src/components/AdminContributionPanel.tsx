'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList, ShieldAlert, ShieldCheck } from 'lucide-react';

import { StatusBadge, StatusTransition } from '@/components/ContributionStatusDisplay';
import { ViewState } from '@/components/ui/view-state';
import type { ContributionStatus } from '@/features/contribution-workflow/types';
import { useContributionWorkflow } from '@/features/contribution-workflow/useContributionWorkflow';

const FILTERS: Array<{ value?: ContributionStatus; label: string; queue?: 'borderline' | 'overdue' }> = [
  { label: 'Tous' },
  { label: 'Borderline', queue: 'borderline' },
  { label: 'En retard', queue: 'overdue' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'active', label: 'Actives' },
  { value: 'rejected', label: 'Rejetees' },
  { value: 'archived', label: 'Archivees' },
];

function getDueState(manualReviewDueAt?: string | null) {
  if (!manualReviewDueAt) return null;

  const dueAt = new Date(manualReviewDueAt);
  const now = new Date();
  const overdue = dueAt.getTime() < now.getTime();

  return {
    overdue,
    label: overdue ? 'SLA depassee' : `Echeance ${dueAt.toLocaleDateString('fr-FR')}`,
    tone: overdue
      ? 'border-red-300 bg-red-50 text-red-700'
      : 'border-amber-300 bg-amber-50 text-amber-700',
  };
}

export function AdminContributionPanel() {
  const { playlists, loading, error, fetchPlaylists, updateStatus, updatePlaylistDetails, isAdmin } = useContributionWorkflow();
  const [filter, setFilter] = useState<ContributionStatus | undefined>('draft');
  const [queue, setQueue] = useState<'borderline' | 'overdue' | undefined>(undefined);
  const [suspended, setSuspended] = useState(false);
  const [suspendedReason, setSuspendedReason] = useState('');
  const [controlLoading, setControlLoading] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    spotifyUrl: string;
    genreLabel: string;
    followers: string;
    description: string;
  }>({
    name: '',
    spotifyUrl: '',
    genreLabel: '',
    followers: '',
    description: '',
  });

  useEffect(() => {
    void fetchPlaylists(filter, queue);
  }, [fetchPlaylists, filter, queue]);

  useEffect(() => {
    let active = true;

    async function loadControl() {
      try {
        setControlLoading(true);
        setControlError(null);
        const response = await fetch('/api/governance/controls', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Impossible de charger le controle de gouvernance.');
        }

        const payload = (await response.json()) as {
          data?: { contributions_suspended?: boolean; suspended_reason?: string | null };
        };

        if (!active) return;

        setSuspended(Boolean(payload.data?.contributions_suspended));
        setSuspendedReason(payload.data?.suspended_reason ?? '');
      } catch (loadError) {
        if (active) {
          setControlError(loadError instanceof Error ? loadError.message : 'Erreur de controle gouvernance.');
        }
      } finally {
        if (active) {
          setControlLoading(false);
        }
      }
    }

    void loadControl();

    return () => {
      active = false;
    };
  }, []);

  async function toggleContributionSuspension(nextState: boolean) {
    try {
      setControlLoading(true);
      setControlError(null);

      const response = await fetch('/api/governance/controls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suspendContributions: nextState,
          reason: nextState ? suspendedReason : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? 'Mise a jour impossible.');
      }

      const payload = (await response.json()) as {
        data?: { contributions_suspended?: boolean; suspended_reason?: string | null };
      };

      setSuspended(Boolean(payload.data?.contributions_suspended));
      setSuspendedReason(payload.data?.suspended_reason ?? '');
    } catch (toggleError) {
      setControlError(toggleError instanceof Error ? toggleError.message : 'Mise a jour impossible.');
    } finally {
      setControlLoading(false);
    }
  }

  function startEditing(playlist: {
    playlistId: string;
    name?: string;
    spotify_url?: string;
    genre_label?: string | null;
    followers?: number | null;
    description?: string | null;
  }) {
    setEditingPlaylistId(playlist.playlistId);
    setEditError(null);
    setEditForm({
      name: playlist.name ?? '',
      spotifyUrl: playlist.spotify_url ?? '',
      genreLabel: playlist.genre_label ?? '',
      followers: playlist.followers != null ? String(playlist.followers) : '',
      description: playlist.description ?? '',
    });
  }

  function cancelEditing() {
    setEditingPlaylistId(null);
    setEditError(null);
  }

  async function savePlaylistDetails(playlistId: string) {
    try {
      setEditLoading(true);
      setEditError(null);

      const success = await updatePlaylistDetails({
        playlistId,
        name: editForm.name.trim(),
        spotifyUrl: editForm.spotifyUrl.trim(),
        genreLabel: editForm.genreLabel.trim() ? editForm.genreLabel.trim() : null,
        followers: editForm.followers.trim() ? Number(editForm.followers) : null,
        description: editForm.description.trim() ? editForm.description.trim() : null,
      });

      if (!success) {
        throw new Error('Impossible de modifier les informations de la playlist.');
      }

      setEditingPlaylistId(null);
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : 'Mise a jour impossible.');
    } finally {
      setEditLoading(false);
    }
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-[var(--radius)] border border-border bg-card p-5 md:p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Console admin</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Revue des playlists en file de contribution et validation manuelle des cas limites.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setFilter(item.value);
                  setQueue(item.queue);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active && queue === item.queue
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary text-foreground hover:border-primary/50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {suspended ? (
        <div className="rounded-[var(--radius)] border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            <span>Contributions suspendues</span>
          </div>
          <p className="mt-1 text-xs text-red-700">
            {suspendedReason || 'La soumission de nouvelles playlists est temporairement desactivee.'}
          </p>
        </div>
      ) : null}

      <div className="rounded-[var(--radius)] border border-border bg-secondary/40 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 text-xs text-muted-foreground">
            Motif de suspension (optionnel)
            <input
              type="text"
              value={suspendedReason}
              onChange={(event) => setSuspendedReason(event.target.value)}
              placeholder="Ex: hausse de faux positifs sur 7 jours"
              className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </label>
          <button
            type="button"
            disabled={controlLoading}
            onClick={() => void toggleContributionSuspension(!suspended)}
            className={`rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors ${
              suspended
                ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {controlLoading
              ? 'Mise a jour...'
              : suspended
                ? 'Reprendre les contributions'
                : 'Suspendre les contributions'}
          </button>
        </div>
        {controlError ? (
          <ViewState
            variant="error"
            className="mt-2"
            title="Contrôle de gouvernance indisponible"
            description={controlError}
          />
        ) : null}
      </div>

      {loading ? (
        <ViewState
          variant="loading"
          title="Chargement de la file admin"
          description="Récupération des playlists en cours..."
        />
      ) : null}
      {error ? (
        <ViewState
          variant="error"
          title="Erreur de chargement"
          description={error}
        />
      ) : null}

      {!loading && !error && playlists.length === 0 ? (
        <ViewState
          variant="empty"
          title="Aucune playlist à réviser"
          description="Aucune playlist dans cette vue pour le moment."
        />
      ) : null}

      {!loading && playlists.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4" />
              <span>File borderline</span>
            </div>
            <p className="mt-1 text-xs text-amber-700">
              {playlists.filter((playlist) => playlist.quality_review_queue).length} playlist(s) demandent une revue manuelle.
            </p>
          </div>
          <div className="rounded-[var(--radius)] border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              <span>Alertes SLA</span>
            </div>
            <p className="mt-1 text-xs text-red-700">
              {playlists.filter((playlist) => getDueState(playlist.manual_review_due_at)?.overdue).length} playlist(s) ont depasse la fenetre de 48h.
            </p>
          </div>
          <div className="rounded-[var(--radius)] border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800 md:col-span-2">
            <div className="flex items-center gap-2 font-medium">
              <ClipboardList className="h-4 w-4" />
              <span>Priorite tickets qualite</span>
            </div>
            <p className="mt-1 text-xs text-orange-700">
              {playlists.filter((playlist) => (playlist.open_ticket_count ?? 0) > 0).length} playlist(s) de la file ont au moins un ticket ouvert.
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {playlists.map((playlist) => (
          <article key={playlist.playlistId} className="rounded-[var(--radius)] border border-border bg-background/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <ClipboardList className="h-3.5 w-3.5 text-primary" />
                    <span>{playlist.name ?? playlist.playlistId}</span>
                  </div>
                  <StatusBadge status={playlist.contribution_status} size="sm" />
                  {playlist.quality_review_queue ? (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Revue requise
                    </span>
                  ) : null}
                  {getDueState(playlist.manual_review_due_at) ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getDueState(playlist.manual_review_due_at)?.tone}`}>
                      {getDueState(playlist.manual_review_due_at)?.label}
                    </span>
                  ) : null}
                  {(playlist.open_ticket_count ?? 0) > 0 ? (
                    <span className="rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                      {playlist.open_ticket_count} ticket(s) ouvert(s)
                    </span>
                  ) : null}
                </div>
                {playlist.spotify_url ? (
                  <a
                    href={playlist.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-primary hover:underline"
                  >
                    {playlist.spotify_url}
                  </a>
                ) : null}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {playlist.genre_label ? (
                    <span>
                      Genre: <span className="font-medium text-foreground">{playlist.genre_label}</span>
                    </span>
                  ) : null}
                  {playlist.followers != null ? (
                    <span>
                      Followers: <span className="font-medium text-foreground">{playlist.followers}</span>
                    </span>
                  ) : null}
                  <span>
                    Confiance: <span className="font-medium text-foreground">{playlist.quality_confidence != null ? `${Math.round(playlist.quality_confidence * 100)}%` : 'n/a'}</span>
                  </span>
                  {playlist.updated_at ? (
                    <span>
                      Maj: <span className="font-medium text-foreground">{new Date(playlist.updated_at).toLocaleDateString('fr-FR')}</span>
                    </span>
                  ) : null}
                  {playlist.manual_review_due_at ? (
                    <span>
                      SLA: <span className="font-medium text-foreground">{new Date(playlist.manual_review_due_at).toLocaleString('fr-FR')}</span>
                    </span>
                  ) : null}
                </div>
                {playlist.description ? (
                  <p className="rounded-[var(--radius)] bg-secondary px-3 py-2 text-xs text-muted-foreground">
                    {playlist.description}
                  </p>
                ) : null}
                {playlist.review_reason ? (
                  <p className="rounded-[var(--radius)] bg-secondary px-3 py-2 text-xs text-muted-foreground">
                    {playlist.review_reason}
                  </p>
                ) : null}
              </div>
              {playlist.contribution_status === 'draft' ? (
                <button
                  type="button"
                  onClick={() => startEditing(playlist)}
                  className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50"
                >
                  Verifier / modifier
                </button>
              ) : null}
            </div>

            {editingPlaylistId === playlist.playlistId ? (
              <div className="mt-3 space-y-3 rounded-[var(--radius)] border border-border bg-secondary/40 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-xs text-muted-foreground">
                    Nom playlist
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                      className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    URL Spotify
                    <input
                      type="url"
                      value={editForm.spotifyUrl}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, spotifyUrl: event.target.value }))}
                      className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Genre
                    <input
                      type="text"
                      value={editForm.genreLabel}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, genreLabel: event.target.value }))}
                      className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Followers
                    <input
                      type="number"
                      min={0}
                      value={editForm.followers}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, followers: event.target.value }))}
                      className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground md:col-span-2">
                    Description
                    <textarea
                      rows={3}
                      value={editForm.description}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                      className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </label>
                </div>

                {editError ? (
                  <ViewState
                    variant="error"
                    title="Modification impossible"
                    description={editError}
                  />
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void savePlaylistDetails(playlist.playlistId)}
                    disabled={editLoading}
                    className="rounded-[var(--radius)] border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {editLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={editLoading}
                    className="rounded-[var(--radius)] border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-3">
              <StatusTransition
                currentStatus={playlist.contribution_status}
                isAdmin
                onTransition={async (nextStatus) => {
                  await updateStatus(playlist.playlistId, nextStatus);
                }}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}