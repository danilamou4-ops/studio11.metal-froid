-- ============================================================
-- CURATOR MATCH — Migration 013 : governance controls
-- Scope: global batch suspend/resume controls for contributions
-- ============================================================

CREATE TABLE IF NOT EXISTS governance_controls (
  key text PRIMARY KEY,
  contributions_suspended boolean NOT NULL DEFAULT false,
  suspended_reason text,
  suspended_at timestamptz,
  resumed_at timestamptz,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO governance_controls (key)
VALUES ('playlist_contribution')
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS trg_governance_controls_updated_at ON governance_controls;
CREATE TRIGGER trg_governance_controls_updated_at
  BEFORE UPDATE ON governance_controls
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();