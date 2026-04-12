export type ContributionStatus = 'draft' | 'active' | 'rejected' | 'archived';

export type GovernanceAction = 
  | 'auto_approved'
  | 'sent_to_review'
  | 'admin_approved'
  | 'admin_rejected'
  | 'admin_archived'
  | 'admin_restored'
  | 'rollback_suspend'
  | 'rollback_resume';

export interface PlaylistContributionState {
  playlistId: string;
  name?: string;
  spotify_url?: string;
  spotify_playlist_id?: string;
  genre_label?: string | null;
  followers?: number | null;
  description?: string | null;
  contribution_status: ContributionStatus;
  submitted_by: string | null;
  reviewed_by: string | null;
  quality_confidence: number | null;
  quality_gate_snapshot: Record<string, unknown> | null;
  quality_review_queue: boolean;
  is_active: boolean;
  review_reason?: string | null;
  updated_at?: string;
  manual_review_due_at?: string | null;
  manual_review_alerted_at?: string | null;
  open_ticket_count?: number;
}

export interface ContributionStatusTransition {
  playlistId: string;
  newStatus: ContributionStatus;
  notes?: string;
}

export interface GovernanceEvent {
  id: string;
  playlist_id: string;
  action: GovernanceAction;
  triggered_by: string | null;
  changes: Record<string, unknown>;
  created_at: string;
}
