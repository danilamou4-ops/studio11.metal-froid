-- ============================================================
-- CURATOR MATCH — Migration 002 : enrichissement Sprint 4
-- ============================================================

-- Prérequis : s'assurer que last_enriched_at existe (créé dans 001, garde de sécurité)
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;

-- Tags fins extraits via Last.fm + MusicBrainz + mots-clés
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]';
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS tags_source text; -- 'lastfm' | 'musicbrainz' | 'keywords' | 'manual'

-- Profil audio enrichi via artistes Spotify
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS avg_popularity numeric(5,2);
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS top_artists jsonb DEFAULT '[]';
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS artist_genres jsonb DEFAULT '[]';

-- Gestion enrichissement
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS pending_enrichment boolean DEFAULT true;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS added_by text;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS enrichment_error text;

-- Marquer les playlists seed existantes comme à enrichir
UPDATE playlists SET pending_enrichment = true WHERE last_enriched_at IS NULL;

-- Index pour le matching et l'enrichissement
CREATE INDEX IF NOT EXISTS idx_playlists_tags ON playlists USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_playlists_artist_genres ON playlists USING gin(artist_genres);
CREATE INDEX IF NOT EXISTS idx_playlists_pending ON playlists(pending_enrichment)
  WHERE pending_enrichment = true;
CREATE INDEX IF NOT EXISTS idx_playlists_popularity ON playlists(avg_popularity DESC);
