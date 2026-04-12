import { describe, expect, it } from 'vitest';

import {
  buildSpotifyUrlFingerprint,
  detectPlaylistDuplicates,
  normalizeSpotifyPlaylistUrl,
} from './urlDedup';

describe('urlDedup', () => {
  it('normalizes Spotify playlist URLs to a canonical form', () => {
    expect(
      normalizeSpotifyPlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd?si=abc123'),
    ).toBe('https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd');
  });

  it('builds a stable fingerprint for the normalized URL', () => {
    const normalizedUrl = 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd';
    expect(buildSpotifyUrlFingerprint(normalizedUrl)).toBe(buildSpotifyUrlFingerprint(normalizedUrl));
  });

  it('detects exact duplicates by normalized URL and fingerprint', () => {
    const normalizedUrl = 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd';
    const fingerprint = buildSpotifyUrlFingerprint(normalizedUrl);

    const result = detectPlaylistDuplicates({
      spotifyPlaylistId: '37i9dQZF1DX0XUsuxWHRQd',
      normalizedUrl,
      fingerprint,
      candidates: [
        {
          id: 'playlist-1',
          name: 'Metal Froid Core',
          spotify_playlist_id: '37i9dQZF1DX0XUsuxWHRQd',
          spotify_url: normalizedUrl,
          spotify_url_normalized: normalizedUrl,
          spotify_url_fingerprint: fingerprint,
          contribution_status: 'active',
          is_active: true,
        },
      ],
    });

    expect(result.hasExactDuplicate).toBe(true);
    expect(result.duplicateConflict).toBe(true);
  });

  it('detects near duplicates by normalized edit distance', () => {
    const normalizedUrl = 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd';
    const fingerprint = buildSpotifyUrlFingerprint(normalizedUrl);

    const result = detectPlaylistDuplicates({
      spotifyPlaylistId: '37i9dQZF1DX0XUsuxWHRQd',
      normalizedUrl,
      fingerprint,
      candidates: [
        {
          id: 'playlist-2',
          name: 'Metal Froid Variant',
          spotify_playlist_id: '37i9dQZF1DX0XUsuxWHRQs',
          spotify_url: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQs',
          spotify_url_normalized: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQs',
          spotify_url_fingerprint: buildSpotifyUrlFingerprint('https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQs'),
          contribution_status: 'draft',
          is_active: false,
        },
      ],
    });

    expect(result.hasNearDuplicate).toBe(true);
    expect(result.duplicateConflict).toBe(true);
  });
});