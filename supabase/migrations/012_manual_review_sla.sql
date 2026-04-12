-- ============================================================
-- CURATOR MATCH — Migration 012 : manual review SLA tracking
-- Scope: admin review deadlines + overdue alert tracking
-- ============================================================

ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS manual_review_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_review_alerted_at timestamptz;

UPDATE playlists
SET manual_review_due_at = created_at + interval '48 hours'
WHERE contribution_status = 'draft'
  AND quality_review_queue = true
  AND manual_review_due_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_playlists_manual_review_due_at
  ON playlists(manual_review_due_at)
  WHERE contribution_status = 'draft' AND quality_review_queue = true;

CREATE INDEX IF NOT EXISTS idx_playlists_manual_review_alerted_at
  ON playlists(manual_review_alerted_at)
  WHERE contribution_status = 'draft' AND quality_review_queue = true;