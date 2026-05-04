import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────
const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: rpcMock,
    from: fromMock,
  })),
}));

// genrePresets runs fine without mocking (pure TS, no DB)

import {
  buildQueryVector,
  genreMismatchMultiplier,
  scorePlaylists,
  scoreOne,
  tagOverlapScore,
  type PlaylistRow,
} from './scorePlaylists';

// ── Helpers ────────────────────────────────────────────────────────────────────
function makePlaylist(overrides: Partial<PlaylistRow> = {}): PlaylistRow {
  return {
    id: 'pl-1',
    name: 'Test Playlist',
    platform_url: 'https://open.spotify.com/playlist/abc',
    platforms: ['spotify'],
    platform_urls: ['https://open.spotify.com/playlist/abc'],
    description: null,
    genre_label: 'rap conscient',
    followers: 1000,
    avg_bpm: 90,
    avg_energy: 0.7,
    avg_danceability: 0.65,
    avg_valence: 0.5,
    avg_acousticness: 0.2,
    avg_speechiness: 0.3,
    tags: ['rap', 'hip-hop', 'conscient'],
    artist_genres: ['rap français'],
    curator_name: 'Curator Test',
    curator_country: 'FR',
    curator_contact_url: 'https://example.com',
    curator_instagram_url: null,
    curator_email: null,
    ...overrides,
  };
}

// ── buildQueryVector ───────────────────────────────────────────────────────────
describe('buildQueryVector', () => {
  it('returns null when fewer than 4 features are defined', () => {
    const result = buildQueryVector({
      bpm: 120,
      energy: 0.8,
      danceability: null,
      valence: null,
      acousticness: null,
      speechiness: null,
      key: null,
      mode: null,
    });
    expect(result).toBeNull();
  });

  it('returns a 6-element vector when 4+ features are defined', () => {
    const result = buildQueryVector({
      bpm: 120,
      energy: 0.8,
      danceability: 0.6,
      valence: 0.5,
      acousticness: null,
      speechiness: null,
      key: null,
      mode: null,
    });
    expect(result).not.toBeNull();
    expect(result).toHaveLength(6);
  });

  it('normalizes BPM correctly: 60 → 0, 200 → 1', () => {
    const low = buildQueryVector({ bpm: 60, energy: 0.5, danceability: 0.5, valence: 0.5, acousticness: 0.5, speechiness: 0.5, key: null, mode: null });
    const high = buildQueryVector({ bpm: 200, energy: 0.5, danceability: 0.5, valence: 0.5, acousticness: 0.5, speechiness: 0.5, key: null, mode: null });
    const mid = buildQueryVector({ bpm: 130, energy: 0.5, danceability: 0.5, valence: 0.5, acousticness: 0.5, speechiness: 0.5, key: null, mode: null });

    expect(low![0]).toBe(0);
    expect(high![0]).toBe(1);
    expect(mid![0]).toBeCloseTo(0.5, 5);
  });

  it('replaces null features with 0.5 (neutral value)', () => {
    const result = buildQueryVector({
      bpm: null,
      energy: 0.8,
      danceability: 0.6,
      valence: 0.5,
      acousticness: 0.4,
      speechiness: null,
      key: null,
      mode: null,
    });
    // bpm dim = null → 0.5, speechiness dim = null → 0.5
    expect(result![0]).toBe(0.5);
    expect(result![5]).toBe(0.5);
  });
});

// ── tagOverlapScore ────────────────────────────────────────────────────────────
describe('tagOverlapScore', () => {
  it('returns 0 with empty user aliases', () => {
    expect(tagOverlapScore([], ['rap', 'hip-hop'])).toBe(0);
  });

  it('returns 0 with empty playlist tags', () => {
    expect(tagOverlapScore(['rap', 'trap'], [])).toBe(0);
  });

  it('returns a positive score when tags match', () => {
    const score = tagOverlapScore(['rap', 'trap', 'drill'], ['rap', 'hip-hop', 'trap']);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns 0 when no aliases match any playlist tag', () => {
    const score = tagOverlapScore(['classique', 'piano', 'orchestral'], ['rap', 'trap', 'drill']);
    expect(score).toBe(0);
  });
});

// ── genreMismatchMultiplier ────────────────────────────────────────────────────
describe('genreMismatchMultiplier', () => {
  it('returns 1 with no preset (no penalty)', () => {
    const result = genreMismatchMultiplier(null, ['rap'], ['rap', 'trap'], 0);
    expect(result).toBe(1);
  });

  it('returns 1 when playlist has fewer than 3 tags', () => {
    const result = genreMismatchMultiplier('rap-conscient', ['rap'], ['rap'], 0);
    expect(result).toBe(1);
  });

  it('returns 1 when tagScore > 0.05 (overlap prevents penalty)', () => {
    const result = genreMismatchMultiplier('rap-conscient', ['rap'], ['rap', 'trap', 'drill'], 0.2);
    expect(result).toBe(1);
  });

  it('returns 0.30 for a rap preset on a classical/instrumental playlist (tagScore = 0)', () => {
    const result = genreMismatchMultiplier(
      'rap-conscient',
      ['rap', 'hip-hop'],
      ['classical', 'piano', 'orchestral', 'acoustic'],
      0,
    );
    expect(result).toBe(0.30);
  });

  it('returns 0.30 for a classical preset on a rap playlist (tagScore = 0)', () => {
    const result = genreMismatchMultiplier(
      'classique',
      ['classique', 'piano'],
      ['rap', 'hip-hop', 'trap', 'drill'],
      0,
    );
    expect(result).toBe(0.30);
  });
});

// ── scoreOne ──────────────────────────────────────────────────────────────────
describe('scoreOne', () => {
  const baseFeatures = {
    bpm: 90,
    energy: 0.7,
    danceability: 0.65,
    valence: 0.5,
    acousticness: 0.2,
    speechiness: 0.3,
    key: 'A',
    mode: 'minor' as const,
  };

  it('returns mode "direct" when playlist has avg_* data', () => {
    const playlist = makePlaylist();
    const result = scoreOne(baseFeatures, playlist, null, []);
    expect(result.mode).toBe('direct');
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('direct mode: score is higher for a well-matched playlist vs a mismatched one', () => {
    const matchedPlaylist = makePlaylist({ avg_bpm: 90, avg_energy: 0.7, avg_danceability: 0.65 });
    const mismatchedPlaylist = makePlaylist({ avg_bpm: 180, avg_energy: 0.1, avg_danceability: 0.1 });

    const matchedScore = scoreOne(baseFeatures, matchedPlaylist, null, []);
    const mismatchedScore = scoreOne(baseFeatures, mismatchedPlaylist, null, []);

    expect(matchedScore.score).toBeGreaterThan(mismatchedScore.score);
  });

  it('returns mode "genre-template" when no avg_* data but genre_label matches a preset', () => {
    const playlist = makePlaylist({
      avg_bpm: null, avg_energy: null, avg_danceability: null,
      avg_valence: null, avg_acousticness: null, avg_speechiness: null,
      genre_label: 'rap',
    });
    const result = scoreOne(baseFeatures, playlist, null, []);
    expect(result.mode).toBe('genre-template');
    expect(result.score).toBeGreaterThan(0);
  });

  it('returns mode "popularity" when no avg_* and no matching genre preset', () => {
    const playlist = makePlaylist({
      avg_bpm: null, avg_energy: null, avg_danceability: null,
      avg_valence: null, avg_acousticness: null, avg_speechiness: null,
      genre_label: 'genre-inexistant-xyz',
      tags: [],
      artist_genres: [],
    });
    const result = scoreOne(baseFeatures, playlist, null, []);
    expect(result.mode).toBe('popularity');
    expect(result.score).toBeLessThanOrEqual(0.12);
  });

  it('popularity mode: score is capped at 0.12', () => {
    const megaPopular = makePlaylist({
      avg_bpm: null, avg_energy: null, avg_danceability: null,
      avg_valence: null, avg_acousticness: null, avg_speechiness: null,
      genre_label: null,
      followers: 10_000_000,
      tags: [],
      artist_genres: [],
    });
    const result = scoreOne(baseFeatures, megaPopular, null, []);
    expect(result.mode).toBe('popularity');
    expect(result.score).toBeLessThanOrEqual(0.12);
  });
});

// ── scorePlaylists ─────────────────────────────────────────────────────────────
describe('scorePlaylists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeQueryBuilder(returnValue: unknown) {
    const builder = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(returnValue),
    };
    return builder;
  }

  it('returns results sorted by score descending', async () => {
    // No vector data (forces legacy branch with no queryVector for minimal features)
    const features = {
      bpm: null, energy: null, danceability: null, valence: null,
      acousticness: null, speechiness: null, key: null, mode: null,
    };

    const playlists = [
      {
        primary_playlist_id: 'pl-low',
        playlist_name: 'Low Pop',
        max_followers: 100,
        platforms: ['spotify'], platform_urls: ['https://open.spotify.com/playlist/low'],
        description: null, genre_label: null,
        avg_bpm: null, avg_energy: null, avg_danceability: null,
        avg_valence: null, avg_acousticness: null, avg_speechiness: null,
        audio_embedding: null,
        tags: null, artist_genres: null,
        curator_name: 'Curator A', curator_country: 'FR',
        curator_contact_url: 'https://a.com', curator_instagram_url: null, curator_email: null,
      },
      {
        primary_playlist_id: 'pl-high',
        playlist_name: 'High Pop',
        max_followers: 1_000_000,
        platforms: ['spotify'], platform_urls: ['https://open.spotify.com/playlist/high'],
        description: null, genre_label: 'rap',
        avg_bpm: null, avg_energy: null, avg_danceability: null,
        avg_valence: null, avg_acousticness: null, avg_speechiness: null,
        audio_embedding: null,
        tags: ['rap', 'hip-hop'], artist_genres: ['rap français'],
        curator_name: 'Curator B', curator_country: 'FR',
        curator_contact_url: 'https://b.com', curator_instagram_url: null, curator_email: null,
      },
    ];

    fromMock.mockImplementation((table: string) => {
      if (table === 'playlists_by_curator') return makeQueryBuilder({ data: playlists, error: null });
      if (table === 'playlists') return makeQueryBuilder({ data: [], error: null });
      return makeQueryBuilder({ data: [], error: null });
    });

    const result = await scorePlaylists(features, 20);

    expect(result.results.length).toBeGreaterThan(0);
    // Verify descending order
    for (let i = 1; i < result.results.length; i++) {
      expect(result.results[i - 1].score).toBeGreaterThanOrEqual(result.results[i].score);
    }
  });

  it('returns totalCandidates equal to rows fetched in legacy branch', async () => {
    const features = {
      bpm: null, energy: null, danceability: null, valence: null,
      acousticness: null, speechiness: null, key: null, mode: null,
    };

    const onePlaylists = [{
      primary_playlist_id: 'pl-1', playlist_name: 'Solo',
      max_followers: 500, platforms: ['spotify'],
      platform_urls: ['https://open.spotify.com/playlist/solo'],
      description: null, genre_label: null,
      avg_bpm: null, avg_energy: null, avg_danceability: null,
      avg_valence: null, avg_acousticness: null, avg_speechiness: null,
      audio_embedding: null, tags: null, artist_genres: null,
      curator_name: 'C', curator_country: null,
      curator_contact_url: null, curator_instagram_url: null, curator_email: null,
    }];

    fromMock.mockImplementation((table: string) => {
      if (table === 'playlists_by_curator') return makeQueryBuilder({ data: onePlaylists, error: null });
      if (table === 'playlists') return makeQueryBuilder({ data: [], error: null });
      return makeQueryBuilder({ data: [], error: null });
    });

    const result = await scorePlaylists(features, 20);
    expect(result.totalCandidates).toBe(1);
  });
});
