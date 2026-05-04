-- Migration 018: Missing indexes for frequent query patterns
-- Applied: 2026-05-04

-- Filtre combiné fréquent dans scorePlaylists (is_active + contribution_status)
CREATE INDEX IF NOT EXISTS idx_playlists_active_status
  ON playlists(is_active, contribution_status)
  WHERE is_active = true AND contribution_status = 'active';

-- Agrégation fréquente community_feedback (vote counts par playlist)
CREATE INDEX IF NOT EXISTS idx_community_feedback_playlist_vote
  ON community_feedback(playlist_id, vote);

-- Lecture ordonnée click_events (tri chronologique)
CREATE INDEX IF NOT EXISTS idx_click_events_created_at
  ON click_events(created_at DESC);
