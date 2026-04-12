-- ============================================================
-- CURATOR MATCH — Migration 015b : RPC vector search by curator
-- Scope: use playlists_by_curator view to return one result per curator
-- ============================================================

-- PostgreSQL ne permet pas de changer le type de retour d'une fonction via
-- CREATE OR REPLACE quand la signature OUT change.
DROP FUNCTION IF EXISTS match_playlists_by_embedding(vector(6), integer);

CREATE OR REPLACE FUNCTION match_playlists_by_embedding(
  query_vector  vector(6),
  match_count   int DEFAULT 500
)
RETURNS TABLE (
  id                    uuid,
  name                  text,
  platform_url          text,
  platforms             text[],
  platform_urls         text[],
  description           text,
  genre_label           text,
  followers             integer,
  avg_bpm               float8,
  avg_energy            float8,
  avg_danceability      float8,
  avg_valence           float8,
  avg_acousticness      float8,
  avg_speechiness       float8,
  tags                  jsonb,
  artist_genres         jsonb,
  curator_name          text,
  curator_country       text,
  curator_contact_url   text,
  curator_instagram_url text,
  curator_email         text,
  cosine_distance       float8
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    pbc.primary_playlist_id     AS id,
    pbc.playlist_name           AS name,
    pbc.platform_urls[1]        AS platform_url,
    pbc.platforms,
    pbc.platform_urls,
    pbc.description,
    pbc.genre_label,
    pbc.max_followers::integer  AS followers,
    pbc.avg_bpm::float8,
    pbc.avg_energy::float8,
    pbc.avg_danceability::float8,
    pbc.avg_valence::float8,
    pbc.avg_acousticness::float8,
    pbc.avg_speechiness::float8,
    pbc.tags,
    pbc.artist_genres,
    pbc.curator_name,
    pbc.curator_country,
    pbc.curator_contact_url,
    pbc.curator_instagram_url,
    pbc.curator_email,
    (p.audio_embedding <=> query_vector)::float8 AS cosine_distance
  FROM playlists_by_curator pbc
  JOIN playlists p ON p.id = pbc.primary_playlist_id
  WHERE p.audio_embedding IS NOT NULL
  ORDER BY p.audio_embedding <=> query_vector
  LIMIT match_count;
$$;
