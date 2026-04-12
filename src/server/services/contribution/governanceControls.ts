import { createAdminClient } from '@/lib/supabase/admin';

const CONTROL_KEY = 'playlist_contribution';

export type GovernanceControlState = {
  contributions_suspended: boolean;
  suspended_reason: string | null;
  suspended_at: string | null;
  resumed_at: string | null;
  updated_by: string | null;
};

export async function getGovernanceControlState(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from('governance_controls')
    .select('contributions_suspended,suspended_reason,suspended_at,resumed_at,updated_by')
    .eq('key', CONTROL_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const { data: inserted, error: insertError } = await supabase
      .from('governance_controls')
      .insert({ key: CONTROL_KEY })
      .select('contributions_suspended,suspended_reason,suspended_at,resumed_at,updated_by')
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? 'Unable to initialize governance controls.');
    }

    return inserted as GovernanceControlState;
  }

  return data as GovernanceControlState;
}

export async function setContributionSuspension(
  supabase: ReturnType<typeof createAdminClient>,
  params: { suspended: boolean; reason?: string | null; userId: string },
) {
  const nowIso = new Date().toISOString();
  const payload = params.suspended
    ? {
        contributions_suspended: true,
        suspended_reason: params.reason?.trim() || null,
        suspended_at: nowIso,
        resumed_at: null,
        updated_by: params.userId,
      }
    : {
        contributions_suspended: false,
        suspended_reason: null,
        resumed_at: nowIso,
        updated_by: params.userId,
      };

  const { data, error } = await supabase
    .from('governance_controls')
    .upsert({ key: CONTROL_KEY, ...payload }, { onConflict: 'key' })
    .select('contributions_suspended,suspended_reason,suspended_at,resumed_at,updated_by')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { error: eventError } = await supabase.from('governance_control_events').insert({
    control_key: CONTROL_KEY,
    action: params.suspended ? 'suspend_contributions' : 'resume_contributions',
    actor_user_id: params.userId,
    reason: params.reason?.trim() || null,
    payload: {
      contributions_suspended: params.suspended,
      suspended_reason: params.reason?.trim() || null,
      governance_action_alias: params.suspended ? 'rollback_suspend' : 'rollback_resume',
    },
  });

  if (eventError) {
    throw new Error(eventError.message);
  }

  return data as GovernanceControlState;
}