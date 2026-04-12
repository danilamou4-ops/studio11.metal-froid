-- ============================================================
-- CURATOR MATCH — Migration 009 : governance action alignment
-- Scope: allow new action labels used by automated/admin transitions
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'playlist_governance_events_action_check'
  ) THEN
    ALTER TABLE playlist_governance_events
      DROP CONSTRAINT playlist_governance_events_action_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_playlist_governance_events_action'
  ) THEN
    ALTER TABLE playlist_governance_events
      DROP CONSTRAINT chk_playlist_governance_events_action;
  END IF;

  ALTER TABLE playlist_governance_events
    ADD CONSTRAINT chk_playlist_governance_events_action
    CHECK (
      action IN (
        -- Legacy actions kept for backward compatibility
        'auto_approve',
        'manual_approve',
        'reject',
        'archive',
        'restore',
        'rollback_suspend',
        'rollback_resume',
        -- New normalized actions
        'auto_approved',
        'sent_to_review',
        'admin_approved',
        'admin_rejected',
        'admin_archived',
        'admin_restored'
      )
    );
END $$;
