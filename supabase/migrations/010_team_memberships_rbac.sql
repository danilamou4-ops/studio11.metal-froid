-- ============================================================
-- CURATOR MATCH — Migration 010 : team memberships RBAC hardening
-- Scope: admin-aware RLS policies for membership governance
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_team_admin(target_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_memberships membership
    WHERE membership.team_id = target_team_id
      AND membership.user_id = auth.uid()
      AND membership.role = 'admin'
      AND membership.is_active = true
  );
$$;

DROP POLICY IF EXISTS "team_memberships_select_team_admin" ON team_memberships;
CREATE POLICY "team_memberships_select_team_admin"
  ON team_memberships
  FOR SELECT
  USING (public.is_team_admin(team_id));

DROP POLICY IF EXISTS "team_memberships_insert_team_admin" ON team_memberships;
CREATE POLICY "team_memberships_insert_team_admin"
  ON team_memberships
  FOR INSERT
  WITH CHECK (public.is_team_admin(team_id));

DROP POLICY IF EXISTS "team_memberships_update_team_admin" ON team_memberships;
CREATE POLICY "team_memberships_update_team_admin"
  ON team_memberships
  FOR UPDATE
  USING (public.is_team_admin(team_id))
  WITH CHECK (public.is_team_admin(team_id));

DROP POLICY IF EXISTS "team_memberships_delete_team_admin" ON team_memberships;
CREATE POLICY "team_memberships_delete_team_admin"
  ON team_memberships
  FOR DELETE
  USING (public.is_team_admin(team_id));