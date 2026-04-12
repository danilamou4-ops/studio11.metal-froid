import { createAdminClient } from '@/lib/supabase/admin';

const MANUAL_REVIEW_SLA_HOURS = 48;

export function computeManualReviewDueAt(baseDate = new Date()) {
  return new Date(baseDate.getTime() + MANUAL_REVIEW_SLA_HOURS * 60 * 60 * 1000).toISOString();
}

export async function markOverdueReviewAlerts(supabase: ReturnType<typeof createAdminClient>) {
  const nowIso = new Date().toISOString();

  const { data: overdueRows, error } = await supabase
    .from('playlists')
    .select('id')
    .eq('contribution_status', 'draft')
    .eq('quality_review_queue', true)
    .lt('manual_review_due_at', nowIso)
    .is('manual_review_alerted_at', null)
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  if (!overdueRows?.length) {
    return { alertedCount: 0 };
  }

  const overdueIds = overdueRows.map((row) => row.id);
  const { error: updateError } = await supabase
    .from('playlists')
    .update({ manual_review_alerted_at: nowIso })
    .in('id', overdueIds);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { alertedCount: overdueIds.length };
}