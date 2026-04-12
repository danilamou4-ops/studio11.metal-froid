-- ============================================================
-- CURATOR MATCH — Migration 003 : pgvector similarity search
-- ============================================================
-- Ordre des dimensions dans audio_embedding vector(6) :
--   [0] bpm_norm        = (avg_bpm - 60) / 140   → [0, 1]
--   [1] energy          = avg_energy              → [0, 1]
--   [2] danceability    = avg_danceability        → [0, 1]
--   [3] valence         = avg_valence             → [0, 1]
--   [4] acousticness    = avg_acousticness        → [0, 1]
--   [5] speechiness     = avg_speechiness         → [0, 1]
-- ============================================================

-- 1 — Activer pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2 — Ajouter la colonne embedding
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS audio_embedding vector(6);

-- 3 — Peupler depuis les colonnes avg_* existantes
--     On skip les lignes avec n'importe quelle valeur audio NULL
UPDATE playlists
SET audio_embedding = ARRAY[
  GREATEST(0.0, LEAST(1.0, (avg_bpm::float8 - 60.0) / 140.0)),
  avg_energy::float8,
  avg_danceability::float8,
  avg_valence::float8,
  avg_acousticness::float8,
  avg_speechiness::float8
]::vector(6)
WHERE avg_bpm          IS NOT NULL
  AND avg_energy       IS NOT NULL
  AND avg_danceability IS NOT NULL
  AND avg_valence      IS NOT NULL
  AND avg_acousticness IS NOT NULL
  AND avg_speechiness  IS NOT NULL
  AND audio_embedding  IS NULL;

-- 4 — Index HNSW (cosine distance)
CREATE INDEX IF NOT EXISTS playlists_audio_embedding_hnsw_idx
  ON playlists USING hnsw (audio_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5 — Trigger : maintenir audio_embedding à jour quand les avg_* changent
CREATE OR REPLACE FUNCTION sync_audio_embedding()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.avg_bpm          IS NOT NULL
  AND NEW.avg_energy       IS NOT NULL
  AND NEW.avg_danceability IS NOT NULL
  AND NEW.avg_valence      IS NOT NULL
  AND NEW.avg_acousticness IS NOT NULL
  AND NEW.avg_speechiness  IS NOT NULL
  THEN
    NEW.audio_embedding := ARRAY[
      GREATEST(0.0, LEAST(1.0, (NEW.avg_bpm::float8 - 60.0) / 140.0)),
      NEW.avg_energy::float8,
      NEW.avg_danceability::float8,
      NEW.avg_valence::float8,
      NEW.avg_acousticness::float8,
      NEW.avg_speechiness::float8
    ]::vector(6);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_audio_embedding ON playlists;
CREATE TRIGGER trg_sync_audio_embedding
  BEFORE INSERT OR UPDATE OF avg_bpm, avg_energy, avg_danceability,
                              avg_valence, avg_acousticness, avg_speechiness
  ON playlists
  FOR EACH ROW EXECUTE FUNCTION sync_audio_embedding();

-- 6 — Fonction RPC : recherche vectorielle avec JOIN curator
--     Retourne les playlists triées par distance cosine (la plus proche en premier).
--     query_vector : tableau de 6 floats normalisés (même ordre que audio_embedding).
--     match_count  : nombre max de résultats (défaut 500).
CREATE OR REPLACE FUNCTION match_playlists_by_embedding(
  query_vector  vector(6),
  match_count   int DEFAULT 500
)
RETURNS TABLE (
  id                   uuid,
  name                 text,
  spotify_url          text,
  description          text,
  genre_label          text,
  followers            integer,
  avg_bpm              float8,
  avg_energy           float8,
  avg_danceability     float8,
  avg_valence          float8,
  avg_acousticness     float8,
  avg_speechiness      float8,
  tags                 jsonb,
  artist_genres        jsonb,
  curator_name         text,
  curator_country      text,
  curator_contact_url  text,
  curator_instagram_url text,
  curator_email        text,
  cosine_distance      float8
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    p.id,
    p.name,
    p.spotify_url,
    p.description,
    p.genre_label,
    p.followers,
    p.avg_bpm::float8,
    p.avg_energy::float8,
    p.avg_danceability::float8,
    p.avg_valence::float8,
    p.avg_acousticness::float8,
    p.avg_speechiness::float8,
    p.tags,
    p.artist_genres,
    c.name          AS curator_name,
    c.country       AS curator_country,
    c.contact_url   AS curator_contact_url,
    c.instagram_url AS curator_instagram_url,
    c.email         AS curator_email,
    (p.audio_embedding <=> query_vector)::float8 AS cosine_distance
  FROM playlists p
  LEFT JOIN curators c ON c.id = p.curator_id
  WHERE p.is_active = true
    AND p.audio_embedding IS NOT NULL
  ORDER BY p.audio_embedding <=> query_vector
  LIMIT match_count;
$$;
