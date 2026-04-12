export type FeedbackTarget = 'playlist' | 'curator' | 'contributor';
export type VoteType = -1 | 1;

export interface CommunityFeedback {
  id: string;
  target_type: FeedbackTarget;
  target_id: string;
  created_by: string | null;
  vote: VoteType | null;
  review_text: string | null;
  created_at: string;
  isOptimistic?: boolean;
}

export interface FeedbackStats {
  upvotes: number;
  downvotes: number;
  reviews: number;
  sentimentScore: number; // -1 to 1
}

export interface FeedbackSubmission {
  target_type: FeedbackTarget;
  target_id: string;
  vote?: VoteType;
  review_text?: string;
  search_run_id?: string;
}
