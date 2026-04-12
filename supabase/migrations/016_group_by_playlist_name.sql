-- ============================================================
-- CURATOR MATCH — Migration 016 : groupement par (curateur + titre)
-- Scope: la vue playlists_by_curator groupait uniquement par curator_id,
--        ce qui fusionnait toutes les playlists d'un curateur (titres différents)
--        en une seule fiche. On corrige en ajoutant LOWER(TRIM(p.name))
--        au GROUP BY pour n'agréger que les playlists de même titre.
-- ============================================================

CREATE OR REPLACE VIEW playlists_by_curator AS
SELECT
  c.id                          AS curator_id,
  c.name                        AS curator_name,
  c.country                     AS curator_country,
  c.contact_url                 AS curator_contact_url,
  c.instagram_url               AS curator_instagram_url,
  c.email                       AS curator_email,
  -- Playlist principale (Spotify préféré, puis celle avec le plus d'abonnés)
  (ARRAY_AGG(p.id ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    COALESCE(p.followers, 0) DESC
  ))[1]                         AS primary_playlist_id,
  (ARRAY_AGG(p.name ORDER BY
    CASE p.platform WHEN 'spotify' THEN 0 ELSE 1 END,
    COALESCE(p.followers, 0) DESC
  ))[1]                         AS playlist_name,
  MAX(COALESCE(p.followers, 0)) AS max_followers,
  -- Toutes les plateformes disponibles pour CE titre chez CE curateur
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.platform), NULL)      AS platforms,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.platform_url), NULL)  AS platform_urls,
  -- Données audio : préférer la ligne Spotify, fallback première disponible
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
-- Grouper par curateur ET par titre normalisé → une fiche par playlist unique
GROUP BY
  c.id, c.name, c.country, c.contact_url, c.instagram_url, c.email,
  LOWER(TRIM(p.name));
