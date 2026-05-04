-- ============================================================
-- CURATOR MATCH — Migration 017 : secure playlists_by_curator view
-- Scope: remove SECURITY DEFINER behavior for public.playlists_by_curator
-- ============================================================

ALTER VIEW IF EXISTS public.playlists_by_curator
  SET (security_invoker = true);
