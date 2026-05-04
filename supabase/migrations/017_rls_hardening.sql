-- ============================================================
-- CURATOR MATCH — Migration 017 : RLS hardening
-- Scope: activer RLS sur les tables jusqu'ici non protégées.
--        Toutes les écritures sur ces tables passent par le
--        service_role (routes API server-side) et ne sont
--        donc pas affectées. Les lectures via anon key sont
--        désormais bloquées sauf politique explicite.
-- ============================================================

-- ------------------------------------------------------------------
-- 1) curators — lecture authentifiée, écriture service_role only
-- ------------------------------------------------------------------
ALTER TABLE curators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curators_select_authenticated" ON curators;
CREATE POLICY "curators_select_authenticated"
  ON curators
  FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------------
-- 2) playlists — lecture authentifiée (actives uniquement),
--               écriture service_role only
-- ------------------------------------------------------------------
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playlists_select_authenticated" ON playlists;
CREATE POLICY "playlists_select_authenticated"
  ON playlists
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ------------------------------------------------------------------
-- 3) search_runs — own only
--    Note : user_id est TEXT (non-FK) hérité de migration 001.
-- ------------------------------------------------------------------
ALTER TABLE search_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_runs_own" ON search_runs;
CREATE POLICY "search_runs_own"
  ON search_runs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ------------------------------------------------------------------
-- 4) search_results — lecture authentifiée
--    (liées aux search_runs, pas de user_id direct)
-- ------------------------------------------------------------------
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_results_select" ON search_results;
CREATE POLICY "search_results_select"
  ON search_results
  FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------------
-- 5) click_events — insert own (user_id nullable pour les anon),
--                   lecture own
-- ------------------------------------------------------------------
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "click_events_insert" ON click_events;
CREATE POLICY "click_events_insert"
  ON click_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text OR user_id IS NULL);

DROP POLICY IF EXISTS "click_events_select_own" ON click_events;
CREATE POLICY "click_events_select_own"
  ON click_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text OR user_id IS NULL);

-- ------------------------------------------------------------------
-- 6) playlist_governance_events — lecture authentifiée,
--    écriture service_role only
-- ------------------------------------------------------------------
ALTER TABLE playlist_governance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governance_events_select_authenticated" ON playlist_governance_events;
CREATE POLICY "governance_events_select_authenticated"
  ON playlist_governance_events
  FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------------
-- 7) governance_controls — service_role only
--    (aucune policy = accès bloqué pour authenticated et anon)
-- ------------------------------------------------------------------
ALTER TABLE governance_controls ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- 8) governance_control_events — service_role only
-- ------------------------------------------------------------------
ALTER TABLE governance_control_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- 9) teams — lecture authentifiée, écriture service_role only
-- ------------------------------------------------------------------
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select_authenticated" ON teams;
CREATE POLICY "teams_select_authenticated"
  ON teams
  FOR SELECT
  TO authenticated
  USING (true);
