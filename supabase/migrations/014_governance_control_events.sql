-- ============================================================
-- CURATOR MATCH — Migration 014 : governance control events
-- Scope: global audit log for suspend/resume controls
-- ============================================================

CREATE TABLE IF NOT EXISTS governance_control_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  control_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('suspend_contributions', 'resume_contributions')),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_control_events_control_key
  ON governance_control_events(control_key);

CREATE INDEX IF NOT EXISTS idx_governance_control_events_created_at
  ON governance_control_events(created_at DESC);