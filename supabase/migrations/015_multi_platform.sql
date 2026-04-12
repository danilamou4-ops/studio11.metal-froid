-- ============================================================
-- CURATOR MATCH — Migration 015 : multi-platform playlist support
-- Scope: generic platform_url + platform column, backward-compatible
--        with all existing Spotify data
-- ============================================================

-- 1 — Ajouter la colonne platform (enum via check constraint)
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'spotify'
    CHECK (platform IN ('spotify', 'deezer', 'apple_music', 'youtube_music', 'soundcloud', 'other'));

-- 2 — Colonne URL générique (remplacera spotify_url comme champ canonique)
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS platform_url text;

-- Backfill depuis spotify_url pour toutes les lignes existantes
UPDATE playlists
SET platform_url = spotify_url
WHERE platform_url IS NULL;

-- 3 — Rendre spotify_playlist_id nullable pour accueillir les playlists non-Spotify
--     (Postgres UNIQUE sur nullable = NULLs non conflictuels entre eux)
ALTER TABLE playlists
  ALTER COLUMN spotify_playlist_id DROP NOT NULL;

-- 4 — Fingerprint générique multi-platform (md5 de l'URL normalisée)
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS platform_url_fingerprint text;

-- Backfill depuis spotify_url_fingerprint pour les lignes déjà fingerprintées
UPDATE playlists
SET platform_url_fingerprint = spotify_url_fingerprint
WHERE platform_url_fingerprint IS NULL
  AND spotify_url_fingerprint IS NOT NULL;

-- Backfill md5 pour les lignes avec platform_url mais sans fingerprint
UPDATE playlists
SET platform_url_fingerprint = md5(platform_url)
WHERE platform_url_fingerprint IS NULL
  AND platform_url IS NOT NULL;

-- 5 — Index et contrainte de dédup multi-platform
CREATE INDEX IF NOT EXISTS idx_playlists_platform
  ON playlists(platform);

CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_platform_url_fingerprint_unique
  ON playlists(platform_url_fingerprint)
  WHERE platform_url_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playlists_platform_url
  ON playlists(platform_url);

-- 6 — Trigger : maintenir platform_url_fingerprint à jour
CREATE OR REPLACE FUNCTION sync_platform_url_fingerprint()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.platform_url IS NOT NULL THEN
    NEW.platform_url_fingerprint := md5(NEW.platform_url);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_platform_url_fingerprint ON playlists;
CREATE TRIGGER trg_sync_platform_url_fingerprint
  BEFORE INSERT OR UPDATE OF platform_url
  ON playlists
  FOR EACH ROW EXECUTE FUNCTION sync_platform_url_fingerprint();

-- 7 — View: playlists grouped by (curator + normalized title)
--     Une fiche par couple (curateur, titre normalisé) pour que la même playlist
--     sur plusieurs plateformes soit présentée en une seule entrée avec tous ses badges.
CREATE OR REPLACE VIEW playlists_by_curator AS
SELECT
  c.id                          AS curator_id,
  c.name                        AS curator_name,
  c.country                     AS curator_country,
  c.contact_url                 AS curator_contact_url,
  c.instagram_url               AS curator_instagram_url,
  c.email                       AS curator_email,
  -- Playlist principale (Spotify préféré, sinon plus d'abonnés)
  (ARRAY_AGG(p.id ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    COALESCE(p.followers, 0) DESC
  ))[1]                         AS primary_playlist_id,
  (ARRAY_AGG(p.name ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    COALESCE(p.followers, 0) DESC
  ))[1]                         AS playlist_name,
  MAX(COALESCE(p.followers, 0)) AS max_followers,
  -- Toutes les plateformes pour CE titre chez CE curateur (sans NULL)
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.platform), NULL)      AS platforms,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.platform_url), NULL)  AS platform_urls,
  -- Données audio : préférer Spotify, fallback première disponible
  (ARRAY_AGG(p.genre_label ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    p.genre_label NULLS LAST
  ))[1]                         AS genre_label,
  (ARRAY_AGG(p.avg_bpm ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    p.avg_bpm NULLS LAST
  ))[1]                         AS avg_bpm,
  (ARRAY_AGG(p.avg_energy ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    p.avg_energy NULLS LAST
  ))[1]                         AS avg_energy,
  (ARRAY_AGG(p.avg_danceability ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    p.avg_danceability NULLS LAST
  ))[1]                         AS avg_danceability,
  (ARRAY_AGG(p.avg_valence ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    p.avg_valence NULLS LAST
  ))[1]                         AS avg_valence,
  (ARRAY_AGG(p.avg_acousticness ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    p.avg_acousticness NULLS LAST
  ))[1]                         AS avg_acousticness,
  (ARRAY_AGG(p.avg_speechiness ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    p.avg_speechiness NULLS LAST
  ))[1]                         AS avg_speechiness,
  (ARRAY_AGG(p.audio_embedding ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    p.audio_embedding NULLS LAST
  ))[1]                         AS audio_embedding,
  (ARRAY_AGG(p.tags ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    p.tags NULLS LAST
  ))[1]                         AS tags,
  (ARRAY_AGG(p.artist_genres ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    p.artist_genres NULLS LAST
  ))[1]                         AS artist_genres,
  (ARRAY_AGG(p.description ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    p.description NULLS LAST
  ))[1]                         AS description
FROM playlists p
JOIN curators c ON c.id = p.curator_id
WHERE p.is_active = true
-- Clé de groupement : même curateur + même titre (insensible à la casse)
GROUP BY
  c.id, c.name, c.country, c.contact_url, c.instagram_url, c.email,
  LOWER(TRIM(p.name));
