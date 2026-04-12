'use client';

import { useState, useCallback } from 'react';
import type { ContributionStatus, PlaylistContributionState, GovernanceEvent } from './types';

interface UseContributionWorkflowReturn {
  loading: boolean;
  error: string | null;
  playlists: PlaylistContributionState[];
  userRole: 'admin' | 'member' | null;
  fetchPlaylists: (status?: ContributionStatus, queue?: 'borderline' | 'overdue') => Promise<void>;
  updateStatus: (playlistId: string, newStatus: ContributionStatus, notes?: string) => Promise<boolean>;
  updatePlaylistDetails: (payload: {
    playlistId: string;
    name?: string;
    spotifyUrl?: string;
    genreLabel?: string | null;
    followers?: number | null;
    description?: string | null;
  }) => Promise<boolean>;
  fetchGovernanceLog: (playlistId: string) => Promise<GovernanceEvent[]>;
  isAdmin: boolean;
}

export function useContributionWorkflow(): UseContributionWorkflowReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistContributionState[]>([]);
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);

  const fetchPlaylists = useCallback(async (status?: ContributionStatus, queue?: 'borderline' | 'overdue') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (queue) params.append('queue', queue);

      const response = await fetch(`/api/playlists/contribution-status?${params}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch playlists');
      }

      const data = await response.json();
      if (data.playlists) {
        setPlaylists(
          data.playlists.map((playlist: Record<string, unknown>) => ({
            playlistId: String(playlist.id),
            name: typeof playlist.name === 'string' ? playlist.name : undefined,
            spotify_url: typeof playlist.spotify_url === 'string' ? playlist.spotify_url : undefined,
            spotify_playlist_id: typeof playlist.spotify_playlist_id === 'string' ? playlist.spotify_playlist_id : undefined,
            genre_label: (playlist.genre_label as string | null | undefined) ?? null,
            followers: (playlist.followers as number | null | undefined) ?? null,
            description: (playlist.description as string | null | undefined) ?? null,
            contribution_status: playlist.contribution_status as ContributionStatus,
            submitted_by: (playlist.submitted_by as string | null | undefined) ?? null,
            reviewed_by: (playlist.reviewed_by as string | null | undefined) ?? null,
            quality_confidence: (playlist.quality_confidence as number | null | undefined) ?? null,
            quality_gate_snapshot: (playlist.quality_gate_snapshot as Record<string, unknown> | null | undefined) ?? null,
            quality_review_queue: Boolean(playlist.quality_review_queue),
            is_active: Boolean(playlist.is_active),
            review_reason: (playlist.review_reason as string | null | undefined) ?? null,
            updated_at: (playlist.updated_at as string | undefined) ?? undefined,
            manual_review_due_at: (playlist.manual_review_due_at as string | null | undefined) ?? null,
            manual_review_alerted_at: (playlist.manual_review_alerted_at as string | null | undefined) ?? null,
            open_ticket_count: (playlist.open_ticket_count as number | undefined) ?? 0,
          })),
        );
      }
      if (data.userRole) {
        setUserRole(data.userRole);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = useCallback(
    async (playlistId: string, newStatus: ContributionStatus, notes?: string) => {
      try {
        setError(null);
        const response = await fetch('/api/playlists/contribution-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playlistId,
            newStatus,
            notes,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData?.error?.message || errorData?.message || 'Failed to update status');
        }

        // Refetch to get updated state
        await fetchPlaylists();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return false;
      }
    },
    [fetchPlaylists]
  );

  const updatePlaylistDetails = useCallback(
    async (payload: {
      playlistId: string;
      name?: string;
      spotifyUrl?: string;
      genreLabel?: string | null;
      followers?: number | null;
      description?: string | null;
    }) => {
      try {
        setError(null);
        const response = await fetch('/api/playlists/contribution-status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData?.error?.message || errorData?.message || 'Failed to update playlist details');
        }

        await fetchPlaylists();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return false;
      }
    },
    [fetchPlaylists]
  );

  const fetchGovernanceLog = useCallback(async (playlistId: string): Promise<GovernanceEvent[]> => {
    try {
      const response = await fetch(
        `/api/playlists/contribution-status?playlistId=${playlistId}&includeEvents=true`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch governance log');
      }

      const data = await response.json();
      return data.events || [];
    } catch (err) {
      console.error('Error fetching governance log:', err);
      return [];
    }
  }, []);

  return {
    loading,
    error,
    playlists,
    userRole,
    fetchPlaylists,
    updateStatus,
    updatePlaylistDetails,
    fetchGovernanceLog,
    isAdmin: userRole === 'admin',
  };
}
