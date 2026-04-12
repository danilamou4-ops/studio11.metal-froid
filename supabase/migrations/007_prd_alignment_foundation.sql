-- ============================================================
-- CURATOR MATCH — Migration 007 : PRD source-of-truth alignment
-- Scope: data foundation only (RBAC, contribution workflow, feedback, quality tickets)
-- ============================================================

-- ------------------------------------------------------------------
-- 1) Teams + memberships (RBAC foundation)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS team_memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_memberships_user_id ON team_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_role ON team_memberships(role);
CREATE INDEX IF NOT EXISTS idx_team_memberships_active ON team_memberships(is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_team_memberships_updated_at ON team_memberships;
CREATE TRIGGER trg_team_memberships_updated_at
  BEFORE UPDATE ON team_memberships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed a default team for mono-organization operation.
INSERT INTO teams (slug, name)
VALUES ('metal-froid-core', 'Metal Froid Core')
ON CONFLICT (slug) DO NOTHING;

-- Backfill memberships from allowed_users when possible.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'allowed_users'
  ) THEN
    INSERT INTO team_memberships (team_id, user_id, role)
    SELECT
      t.id,
      u.id,
      CASE WHEN au.role = 'admin' THEN 'admin' ELSE 'member' END
    FROM allowed_users au
    JOIN auth.users u ON lower(u.email) = lower(au.email)
    JOIN teams t ON t.slug = 'metal-froid-core'
    WHERE coalesce(au.approved, false) = true
    ON CONFLICT (team_id, user_id)
    DO UPDATE SET
      role = EXCLUDED.role,
      is_active = true,
      updated_at = now();
  END IF;
END $$;


-- ------------------------------------------------------------------
-- 2) Playlist contribution workflow + quality gate fields
-- ------------------------------------------------------------------
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS contribution_status text,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS quality_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS quality_gate_snapshot jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_review_queue boolean NOT NULL DEFAULT false;

-- Backfill contribution status from existing is_active semantics.
UPDATE playlists
SET contribution_status = CASE WHEN is_active = true THEN 'active' ELSE 'draft' END
WHERE contribution_status IS NULL;

ALTER TABLE playlists
  ALTER COLUMN contribution_status SET NOT NULL,
  ALTER COLUMN contribution_status SET DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_playlists_contribution_status'
  ) THEN
    ALTER TABLE playlists
      ADD CONSTRAINT chk_playlists_contribution_status
      CHECK (contribution_status IN ('draft', 'active', 'rejected', 'archived'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_playlists_quality_confidence_range'
  ) THEN
    ALTER TABLE playlists
      ADD CONSTRAINT chk_playlists_quality_confidence_range
      CHECK (quality_confidence IS NULL OR (quality_confidence >= 0 AND quality_confidence <= 1));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_playlists_contribution_status ON playlists(contribution_status);
CREATE INDEX IF NOT EXISTS idx_playlists_review_queue ON playlists(quality_review_queue) WHERE quality_review_queue = true;
CREATE INDEX IF NOT EXISTS idx_playlists_quality_confidence ON playlists(quality_confidence DESC);


-- ------------------------------------------------------------------
-- 3) Governance audit log (approval/rejection/archive/rollback actions)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playlist_governance_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (
    action IN (
      'auto_approve',
      'manual_approve',
      'reject',
      'archive',
      'restore',
      'rollback_suspend',
      'rollback_resume'
    )
  ),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playlist_governance_events_playlist_id ON playlist_governance_events(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_governance_events_action ON playlist_governance_events(action);
CREATE INDEX IF NOT EXISTS idx_playlist_governance_events_created_at ON playlist_governance_events(created_at DESC);


-- ------------------------------------------------------------------
-- 4) Community feedback (upvote/downvote + written reviews)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id uuid REFERENCES playlists(id) ON DELETE CASCADE,
  curator_id uuid REFERENCES curators(id) ON DELETE CASCADE,
  contributor_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vote smallint CHECK (vote IN (-1, 1)),
  review_text text,
  search_run_id uuid REFERENCES search_runs(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_community_feedback_target
    CHECK (
      (CASE WHEN playlist_id IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN curator_id IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN contributor_user_id IS NULL THEN 0 ELSE 1 END)
      = 1
    ),
  CONSTRAINT chk_community_feedback_content
    CHECK (vote IS NOT NULL OR nullif(trim(coalesce(review_text, '')), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_community_feedback_playlist_id ON community_feedback(playlist_id);
CREATE INDEX IF NOT EXISTS idx_community_feedback_curator_id ON community_feedback(curator_id);
CREATE INDEX IF NOT EXISTS idx_community_feedback_contributor_user_id ON community_feedback(contributor_user_id);
CREATE INDEX IF NOT EXISTS idx_community_feedback_created_by ON community_feedback(created_by);
CREATE INDEX IF NOT EXISTS idx_community_feedback_created_at ON community_feedback(created_at DESC);


-- ------------------------------------------------------------------
-- 5) Quality tickets (support -> admin escalation)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quality_tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'escalated', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  title text NOT NULL DEFAULT 'Quality issue',
  description text,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  escalated_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  escalated_at timestamptz,
  resolution_note text,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_tickets_status ON quality_tickets(status);
CREATE INDEX IF NOT EXISTS idx_quality_tickets_priority ON quality_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_quality_tickets_playlist_id ON quality_tickets(playlist_id);
CREATE INDEX IF NOT EXISTS idx_quality_tickets_created_at ON quality_tickets(created_at DESC);

DROP TRIGGER IF EXISTS trg_quality_tickets_updated_at ON quality_tickets;
CREATE TRIGGER trg_quality_tickets_updated_at
  BEFORE UPDATE ON quality_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ------------------------------------------------------------------
-- 6) Optional RLS activation for new user-generated tables
--    (service_role continues to bypass; policies are intentionally minimal)
-- ------------------------------------------------------------------
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_memberships_select_own" ON team_memberships;
CREATE POLICY "team_memberships_select_own"
  ON team_memberships
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "community_feedback_select_authenticated" ON community_feedback;
CREATE POLICY "community_feedback_select_authenticated"
  ON community_feedback
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "community_feedback_insert_own" ON community_feedback;
CREATE POLICY "community_feedback_insert_own"
  ON community_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "quality_tickets_select_authenticated" ON quality_tickets;
CREATE POLICY "quality_tickets_select_authenticated"
  ON quality_tickets
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "quality_tickets_insert_reporter" ON quality_tickets;
CREATE POLICY "quality_tickets_insert_reporter"
  ON quality_tickets
  FOR INSERT
  WITH CHECK (reported_by IS NULL OR auth.uid() = reported_by);
