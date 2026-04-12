import { createAdminClient } from "@/lib/supabase/admin";

import { computeManualReviewDueAt } from '@/server/services/contribution/manualReviewSla';

export type ContributionStatus = "draft" | "active" | "rejected" | "archived";

type GovernanceAction =
  | "auto_approved"
  | "sent_to_review"
  | "admin_approved"
  | "admin_rejected"
  | "admin_archived"
  | "admin_restored";

const STATUS_TO_IS_ACTIVE: Record<ContributionStatus, boolean> = {
  draft: false,
  active: true,
  rejected: false,
  archived: false,
};

type UpdateContributionStatusParams = {
  supabase: ReturnType<typeof createAdminClient>;
  playlistId: string;
  status: ContributionStatus;
  reviewedBy?: string | null;
  reviewReason?: string | null;
  extraUpdates?: Record<string, unknown>;
};

type LogGovernanceTransitionParams = {
  supabase: ReturnType<typeof createAdminClient>;
  playlistId: string;
  action: GovernanceAction;
  status: ContributionStatus;
  triggeredBy: "system" | string;
  actorUserId?: string | null;
  reasons?: string[];
  note?: string | null;
};

export async function updateContributionStatus({
  supabase,
  playlistId,
  status,
  reviewedBy = null,
  reviewReason = null,
  extraUpdates = {},
}: UpdateContributionStatusParams) {
  const reviewTimingUpdates = status === 'draft'
    ? {
        manual_review_due_at: computeManualReviewDueAt(),
        manual_review_alerted_at: null,
      }
    : {
        manual_review_due_at: null,
        manual_review_alerted_at: null,
      };

  const { data, error } = await supabase
    .from("playlists")
    .update({
      contribution_status: status,
      is_active: STATUS_TO_IS_ACTIVE[status],
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_reason: reviewReason,
      ...reviewTimingUpdates,
      ...extraUpdates,
    })
    .eq("id", playlistId)
    .select("id,contribution_status,is_active,reviewed_by,reviewed_at,review_reason,quality_confidence,quality_review_queue,quality_gate_snapshot,manual_review_due_at,manual_review_alerted_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function logGovernanceTransition({
  supabase,
  playlistId,
  action,
  status,
  triggeredBy,
  actorUserId = null,
  reasons = [],
  note = null,
}: LogGovernanceTransitionParams) {
  const { error } = await supabase.from("playlist_governance_events").insert({
    playlist_id: playlistId,
    action,
    actor_user_id: actorUserId,
    reason: note ?? reasons[0] ?? null,
    payload: {
      status,
      triggered_by: triggeredBy,
      reasons,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}
