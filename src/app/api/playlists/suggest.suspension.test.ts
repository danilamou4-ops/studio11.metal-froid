import { beforeEach, describe, expect, it, vi } from 'vitest';

const getGovernanceControlStateMock = vi.fn();
const enrichPlaylistByIdMock = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}));

vi.mock('@/server/services/contribution/governanceControls', () => ({
  getGovernanceControlState: getGovernanceControlStateMock,
}));

vi.mock('@/lib/enrichment/enrichPlaylist', () => ({
  enrichPlaylistById: enrichPlaylistByIdMock,
}));

vi.mock('@/server/services/contribution/updateContributionStatus', () => ({
  logGovernanceTransition: vi.fn(),
  updateContributionStatus: vi.fn(),
}));

vi.mock('@/server/services/playlists/urlDedup', () => ({
  buildSpotifyUrlFingerprint: vi.fn(() => 'mock_fingerprint'),
  detectPlaylistDuplicates: vi.fn(() => ({
    duplicateConflict: false,
    hasExactDuplicate: false,
    reasons: [],
    matchedPlaylistId: null,
  })),
  extractSpotifyPlaylistId: vi.fn(() => '37i9dQZF1DX0XUsuxWHRQd'),
  normalizeSpotifyPlaylistUrl: vi.fn((url: string) => url),
}));

describe('POST /api/playlists/suggest (governance suspension)', () => {
  beforeEach(() => {
    getGovernanceControlStateMock.mockReset();
    enrichPlaylistByIdMock.mockReset();
  });

  it('returns 503 when contributions are suspended', async () => {
    getGovernanceControlStateMock.mockResolvedValue({
      contributions_suspended: true,
      suspended_reason: 'Suspension automatique pour derive qualite',
      suspended_at: new Date().toISOString(),
      resumed_at: null,
      updated_by: null,
    });

    const { POST } = await import('./suggest/route');

    const request = new Request('http://localhost/api/playlists/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlistName: 'Test Playlist',
        spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd',
        genreLabel: 'metal',
        contactUrl: 'https://example.com/contact',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('CONTRIBUTIONS_SUSPENDED');
  });
});