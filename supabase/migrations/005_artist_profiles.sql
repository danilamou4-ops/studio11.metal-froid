CREATE TABLE IF NOT EXISTS artist_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE artist_profiles ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur lit/écrit uniquement son propre profil.
DROP POLICY IF EXISTS "artist_profiles_select_own" ON artist_profiles;
CREATE POLICY "artist_profiles_select_own"
  ON artist_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "artist_profiles_insert_own" ON artist_profiles;
CREATE POLICY "artist_profiles_insert_own"
  ON artist_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "artist_profiles_update_own" ON artist_profiles;
CREATE POLICY "artist_profiles_update_own"
  ON artist_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "artist_profiles_delete_own" ON artist_profiles;
CREATE POLICY "artist_profiles_delete_own"
  ON artist_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_artist_profiles_updated_at
  BEFORE UPDATE ON artist_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
