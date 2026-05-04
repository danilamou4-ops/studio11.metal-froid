import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────
const getAuthenticatedUserMock = vi.fn();
const getGovernanceControlStateMock = vi.fn();
const enrichPlaylistByIdMock = vi.fn();
const updateContributionStatusMock = vi.fn();
const logGovernanceTransitionMock = vi.fn();

vi.mock('@/lib/auth/route-auth', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock('@/server/services/contribution/governanceControls', () => ({
  getGovernanceControlState: getGovernanceControlStateMock,
}));

vi.mock('@/lib/enrichment/enrichPlaylist', () => ({
  enrichPlaylistById: enrichPlaylistByIdMock,
}));

vi.mock('@/server/services/contribution/updateContributionStatus', () => ({
  updateContributionStatus: updateContributionStatusMock,
  logGovernanceTransition: logGovernanceTransitionMock,
}));

vi.mock('@/server/services/playlists/urlDedup', () => ({
  buildPlatformUrlFingerprint: vi.fn(() => 'mock_fingerprint'),
  buildSpotifyUrlFingerprint: vi.fn(() => 'mock_spotify_fingerprint'),
  detectPlatform: vi.fn(() => 'spotify'),
  detectPlaylistDuplicates: vi.fn(() => ({
    duplicateConflict: false,
    hasExactDuplicate: false,
    reasons: [],
    matchedPlaylistId: null,
  })),
  extractSpotifyPlaylistId: vi.fn(() => '37i9dQZF1DX0XUsuxWHRQd'),
  normalizePlatformUrl: vi.fn((url: string) => url),
  normalizeSpotifyPlaylistUrl: vi.fn((url: string) => url),
}));

// ── Supabase mock factory ──────────────────────────────────────────────────────
/**
 * Builds a chainable Supabase client mock.
 * `tableResponses` maps table name → response for the final awaited call.
 * Every builder method returns `this`, so chains like
 * .from('x').select().eq().maybeSingle() resolve to the provided response.
 */
function makeSupabaseMock(tableResponses: Record<string, unknown> = {}) {
  const makeBuilder = (tableName: string) => {
    const resolve = tableResponses[tableName] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    const chainMethods = ['select', 'eq', 'in', 'not', 'is', 'limit', 'order', 'neq', 'gt', 'lt'];
    for (const m of chainMethods) {
      builder[m] = vi.fn().mockReturnThis();
    }
    builder['maybeSingle'] = vi.fn().mockResolvedValue(resolve);
    builder['single'] = vi.fn().mockResolvedValue(resolve);
    builder['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(tableResponses[`${tableName}:insert`] ?? { data: null, error: null }),
      }),
    });
    builder['upsert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(tableResponses[`${tableName}:upsert`] ?? { data: null, error: null }),
      }),
    });
    // Allow builder itself to be awaited (for queries without final method)
    (builder as { then?: unknown }).then = undefined;
    return builder;
  };

  return {
    from: vi.fn((table: string) => makeBuilder(table)),
  };
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => makeSupabaseMock()),
}));

// Import after all mocks are set up
import { createAdminClient } from '@/lib/supabase/admin';
import { detectPlaylistDuplicates } from '@/server/services/playlists/urlDedup';

// ── Helpers ────────────────────────────────────────────────────────────────────
const VALID_BODY = {
  playlistName: 'Test Playlist',
  spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd',
  genreLabel: 'rap',
  contactUrl: 'https://example.com/contact',
};

function makeRequest(body: Record<string, unknown> = VALID_BODY) {
  return new Request('http://localhost/api/playlists/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setupDefaultMocks(options: {
  qualityConfidence?: number | null;
  supabaseMock?: ReturnType<typeof makeSupabaseMock>;
} = {}) {
  const { qualityConfidence = null } = options;

  getAuthenticatedUserMock.mockResolvedValue({ user: { id: 'user-123', email: 'user@test.com' } });

  getGovernanceControlStateMock.mockResolvedValue({
    contributions_suspended: false,
    suspended_reason: null,
    suspended_at: null,
    resumed_at: null,
    updated_by: null,
  });

  enrichPlaylistByIdMock.mockResolvedValue(undefined);

  updateContributionStatusMock.mockResolvedValue({
    id: 'pl-new',
    contribution_status: qualityConfidence !== null && qualityConfidence >= 0.6 ? 'active' : 'draft',
  });

  logGovernanceTransitionMock.mockResolvedValue(undefined);

  const supabaseMock = options.supabaseMock ?? makeSupabaseMock({
    // No existing playlist by fingerprint
    playlists: { data: null, error: null },
    // No duplicate candidates
    'playlists:limit': { data: [], error: null },
    // No existing curator
    curators: { data: null, error: null },
    // Curator insert succeeds
    'curators:insert': { data: { id: 'curator-new' }, error: null },
    // Playlist upsert succeeds
    'playlists:upsert': {
      data: {
        id: 'pl-new',
        spotify_playlist_id: '37i9dQZF1DX0XUsuxWHRQd',
        quality_confidence: qualityConfidence,
        quality_gate_snapshot: null,
        spotify_url_normalized: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd',
        spotify_url_fingerprint: 'mock_spotify_fingerprint',
        platform_url_fingerprint: 'mock_fingerprint',
      },
      error: null,
    },
  });

  vi.mocked(createAdminClient).mockReturnValue(supabaseMock as ReturnType<typeof createAdminClient>);

  return supabaseMock;
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('POST /api/playlists/suggest (quality gate)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated requests', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: null });

    const { POST } = await import('./suggest/route');
    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for missing required fields (no genreLabel)', async () => {
    setupDefaultMocks();

    const { POST } = await import('./suggest/route');
    const response = await POST(makeRequest({
      playlistName: 'Test',
      spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd',
      // genreLabel missing
      contactUrl: 'https://example.com',
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing contact (no contactUrl/instagramUrl/email)', async () => {
    setupDefaultMocks();

    const { POST } = await import('./suggest/route');
    const response = await POST(makeRequest({
      playlistName: 'Test',
      spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd',
      genreLabel: 'rap',
      // no contact fields
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 when duplicate playlist is detected', async () => {
    setupDefaultMocks();
    vi.mocked(detectPlaylistDuplicates).mockReturnValueOnce({
      duplicateConflict: true,
      hasExactDuplicate: true,
      reasons: ['URL identique à une playlist existante.'],
      matchedPlaylistId: 'pl-existing',
    });

    const { POST } = await import('./suggest/route');
    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('DUPLICATE_PLAYLIST');
  });

  it('inserts playlist with contribution_status "draft" initially', async () => {
    setupDefaultMocks({ qualityConfidence: null });

    const { POST } = await import('./suggest/route');
    await POST(makeRequest());

    // Verify updateContributionStatus was called with draft (quality_confidence null → gate fails)
    expect(updateContributionStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' }),
    );
  });

  it('auto-approves to "active" when quality_confidence >= 0.60', async () => {
    setupDefaultMocks({ qualityConfidence: 0.75 });

    const { POST } = await import('./suggest/route');
    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe('active');
    expect(updateContributionStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
    );
    expect(logGovernanceTransitionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auto_approved' }),
    );
  });

  it('sends to review (stays draft) when quality_confidence < 0.60', async () => {
    setupDefaultMocks({ qualityConfidence: 0.45 });

    const { POST } = await import('./suggest/route');
    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe('pending_review');
    expect(updateContributionStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' }),
    );
    expect(logGovernanceTransitionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'sent_to_review' }),
    );
  });

  it('sends to review when quality_confidence is null (awaiting enrichment)', async () => {
    setupDefaultMocks({ qualityConfidence: null });

    const { POST } = await import('./suggest/route');
    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('pending_review');
    expect(updateContributionStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' }),
    );
  });
});
