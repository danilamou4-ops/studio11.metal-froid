CREATE TABLE IF NOT EXISTS user_account_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_account_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_account_profiles_select_own" ON user_account_profiles;
CREATE POLICY "user_account_profiles_select_own"
  ON user_account_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_account_profiles_insert_own" ON user_account_profiles;
CREATE POLICY "user_account_profiles_insert_own"
  ON user_account_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_account_profiles_update_own" ON user_account_profiles;
CREATE POLICY "user_account_profiles_update_own"
  ON user_account_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_account_profiles_delete_own" ON user_account_profiles;
CREATE POLICY "user_account_profiles_delete_own"
  ON user_account_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_account_profiles_updated_at ON user_account_profiles;
CREATE TRIGGER trg_user_account_profiles_updated_at
  BEFORE UPDATE ON user_account_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
