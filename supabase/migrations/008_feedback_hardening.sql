-- ============================================================
-- CURATOR MATCH — Migration 008 : feedback hardening
-- Scope: vote uniqueness + own-row update/delete policies
-- ============================================================

-- Cleanup legacy duplicate vote rows before enforcing uniqueness.
-- We keep the most recent vote-only row for each user/target pair.
WITH ranked_playlist_votes AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY created_by, playlist_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM community_feedback
  WHERE playlist_id IS NOT NULL
    AND vote IS NOT NULL
    AND review_text IS NULL
)
DELETE FROM community_feedback
WHERE id IN (
  SELECT id
  FROM ranked_playlist_votes
  WHERE rn > 1
);

WITH ranked_curator_votes AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY created_by, curator_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM community_feedback
  WHERE curator_id IS NOT NULL
    AND vote IS NOT NULL
    AND review_text IS NULL
)
DELETE FROM community_feedback
WHERE id IN (
  SELECT id
  FROM ranked_curator_votes
  WHERE rn > 1
);

WITH ranked_contributor_votes AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY created_by, contributor_user_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM community_feedback
  WHERE contributor_user_id IS NOT NULL
    AND vote IS NOT NULL
    AND review_text IS NULL
)
DELETE FROM community_feedback
WHERE id IN (
  SELECT id
  FROM ranked_contributor_votes
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_feedback_unique_playlist_vote
  ON community_feedback(created_by, playlist_id)
  WHERE playlist_id IS NOT NULL AND vote IS NOT NULL AND review_text IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_feedback_unique_curator_vote
  ON community_feedback(created_by, curator_id)
  WHERE curator_id IS NOT NULL AND vote IS NOT NULL AND review_text IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_feedback_unique_contributor_vote
  ON community_feedback(created_by, contributor_user_id)
  WHERE contributor_user_id IS NOT NULL AND vote IS NOT NULL AND review_text IS NULL;

DROP POLICY IF EXISTS "community_feedback_update_own" ON community_feedback;
CREATE POLICY "community_feedback_update_own"
  ON community_feedback
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "community_feedback_delete_own" ON community_feedback;
CREATE POLICY "community_feedback_delete_own"
  ON community_feedback
  FOR DELETE
  USING (auth.uid() = created_by);