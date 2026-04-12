-- ============================================================
-- CURATOR MATCH — Migration 011 : playlist URL normalization + dedup
-- Scope: exact dedup foundation on normalized Spotify URLs
-- ============================================================

ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS spotify_url_normalized text,
  ADD COLUMN IF NOT EXISTS spotify_url_fingerprint text;

UPDATE playlists
SET spotify_url_normalized = CONCAT('https://open.spotify.com/playlist/', spotify_playlist_id)
WHERE spotify_playlist_id IS NOT NULL
  AND (spotify_url_normalized IS NULL OR spotify_url_normalized = '');

UPDATE playlists
SET spotify_url_fingerprint = md5(spotify_url_normalized)
WHERE spotify_url_normalized IS NOT NULL
  AND (spotify_url_fingerprint IS NULL OR spotify_url_fingerprint = '');

CREATE INDEX IF NOT EXISTS idx_playlists_spotify_url_normalized
  ON playlists(spotify_url_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_spotify_url_fingerprint_unique
  ON playlists(spotify_url_fingerprint)
  WHERE spotify_url_fingerprint IS NOT NULL;