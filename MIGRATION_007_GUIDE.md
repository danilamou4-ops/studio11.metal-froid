# Migration 007: PRD Alignment Foundation

**Date:** 6 avril 2026  
**Purpose:** Apply data foundation for contribution workflow, community feedback, and quality tickets  
**Status:** Ready to apply

## Prerequisites

- Supabase project active
- Database credentials available
- PostgreSQL client (optional, can use Supabase console)

## Option 1: Apply via Supabase Console (Recommended for Manual Application)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select project: `olefrtwdelumsjfycdgd` (metal-froid)
3. Navigate to **SQL Editor**
4. Create new query
5. Copy and paste the entire contents of `supabase/migrations/007_prd_alignment_foundation.sql`
6. Click **Run** to execute

**⏱️ Execution time:** ~2-5 seconds for all operations

## Option 2: Apply via CLI (If Docker is available)

```bash
cd curator-match

# Link CLI to your project
supabase link --project-ref olefrtwdelumsjfycdgd

# Push migrations
supabase db push

# Verify
supabase db pull
```

## Option 3: Apply via psql (If PostgreSQL client available)

```bash
# Get connection string from Supabase console
# Dashboard → Settings → Database → Connection string → PostgreSQL

psql "postgresql://postgres:PASSWORD@db.olefrtwdelumsjfycdgd.supabase.co:5432/postgres" < supabase/migrations/007_prd_alignment_foundation.sql
```

## Option 4: Apply via API Endpoint (Development Only)

```bash
# Requires MIGRATION_SECRET environment variable
curl -X POST http://localhost:3000/api/migrations/apply-007 \
  -H "X-Migration-Secret: your-secret" \
  -H "Content-Type: application/json"
```

## Verification

After applying the migration, verify the new tables:

**Via Supabase Console:**
1. Go to **Table Editor**
2. Verify these tables exist:
   - ✅ `teams`
   - ✅ `team_memberships`
   - ✅ `playlist_governance_events`
   - ✅ `community_feedback`
   - ✅ `quality_tickets`

3. Verify new columns on `playlists` table:
   - `contribution_status`
   - `submitted_by`
   - `reviewed_by`
   - `quality_confidence`
   - `quality_gate_snapshot`
   - `quality_review_queue`

**Via SQL Query:**
```sql
-- Verify tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('teams', 'team_memberships', 'playlist_governance_events', 'community_feedback', 'quality_tickets');

-- Verify columns on playlists
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'playlists' 
AND column_name IN ('contribution_status', 'submitted_by', 'reviewed_by');
```

## Rollback (If Needed)

If you need to rollback this migration, a corresponding rollback file will be provided. Contact support for assistance.

## Next Steps After Migration

1. ✅ Migration 007 applied → Database schema ready
2. ⏭️ Next: Integrate frontend components (see `src/features/` modules)
3. ⏭️ Then: Test contribution workflow endpoints
4. ⏭️ Finally: Test community feedback and quality tickets

---

**Support:** For issues, check migration logs in Supabase Settings → Audit Logs
