export type TicketStatus = 'open' | 'in_review' | 'escalated' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'critical';

export interface QualityTicket {
  id: string;
  playlist_id: string;
  reported_by: string;
  category: string;
  description: string;
  evidence_snapshot: Record<string, unknown> | null;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to: string | null;
  escalation_reason: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketCreation {
  playlist_id: string;
  category: string;
  description: string;
  evidence_snapshot?: Record<string, unknown>;
}

export interface TicketUpdate {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigned_to?: string | null;
  escalation_reason?: string | null;
  resolution_notes?: string | null;
}
