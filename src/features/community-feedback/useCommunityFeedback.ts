'use client';

import { useState, useCallback } from 'react';
import type { CommunityFeedback, FeedbackStats, FeedbackSubmission, FeedbackTarget } from './types';
import { applyVoteStats, calculateFeedbackStats } from './feedback-utils';

type FeedbackApiRow = {
  id: string;
  playlist_id: string | null;
  curator_id: string | null;
  contributor_user_id: string | null;
  vote: -1 | 1 | null;
  review_text: string | null;
  created_by: string | null;
  created_at: string;
};

interface UseCommunityFeedbackReturn {
  loading: boolean;
  error: string | null;
  feedback: CommunityFeedback[];
  stats: FeedbackStats | null;
  userVote: -1 | 1 | null;
  fetchFeedback: (targetType: string, targetId: string) => Promise<void>;
  submitFeedback: (submission: FeedbackSubmission) => Promise<boolean>;
  calculateStats: (feedbackList: CommunityFeedback[]) => FeedbackStats;
}

function normalizeFeedback(row: FeedbackApiRow): CommunityFeedback {
  const targetType: FeedbackTarget = row.playlist_id
    ? 'playlist'
    : row.curator_id
      ? 'curator'
      : 'contributor';

  return {
    id: row.id,
    target_type: targetType,
    target_id: row.playlist_id ?? row.curator_id ?? row.contributor_user_id ?? '',
    created_by: row.created_by,
    vote: row.vote,
    review_text: row.review_text,
    created_at: row.created_at,
  };
}

function getApiErrorMessage(errorPayload: unknown, fallback: string): string {
  if (typeof errorPayload === 'object' && errorPayload !== null) {
    const payload = errorPayload as { message?: string; error?: { message?: string } };
    return payload.error?.message ?? payload.message ?? fallback;
  }

  return fallback;
}

export function useCommunityFeedback(): UseCommunityFeedbackReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CommunityFeedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [userVote, setUserVote] = useState<-1 | 1 | null>(null);

  const calculateStats = useCallback((feedbackList: CommunityFeedback[]): FeedbackStats => calculateFeedbackStats(feedbackList), []);

  const fetchFeedback = useCallback(async (targetType: string, targetId: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        targetType,
        targetId,
      });

      const response = await fetch(`/api/community-feedback?${params}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feedback');
      }

      const data = await response.json();
      const normalized = Array.isArray(data.feedback)
        ? (data.feedback as FeedbackApiRow[]).map(normalizeFeedback)
        : [];

      setFeedback(normalized);
      setStats(calculateStats(normalized));

      if (typeof data.userVote === 'number' || data.userVote == null) {
        setUserVote((data.userVote as -1 | 1 | null) ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  const submitFeedback = useCallback(
    async (submission: FeedbackSubmission) => {
      const previousFeedback = feedback;
      const previousStats = stats;
      const previousUserVote = userVote;
      const trimmedReview = submission.review_text?.trim() ?? '';
      const nextVote = submission.vote == null
        ? userVote
        : userVote === submission.vote
          ? null
          : submission.vote;

      try {
        setError(null);

        if (submission.vote != null) {
          setUserVote(nextVote);
          setStats((current) => applyVoteStats(current, previousUserVote, nextVote));
        }

        if (trimmedReview) {
          const optimisticReview: CommunityFeedback = {
            id: `optimistic-${Date.now()}`,
            target_type: submission.target_type,
            target_id: submission.target_id,
            created_by: null,
            vote: null,
            review_text: trimmedReview,
            created_at: new Date().toISOString(),
            isOptimistic: true,
          };

          setFeedback((current) => [optimisticReview, ...current]);
          setStats((current) => {
            const base = current ?? { upvotes: 0, downvotes: 0, reviews: 0, sentimentScore: 0 };
            return { ...base, reviews: base.reviews + 1 };
          });
        }

        const response = await fetch('/api/community-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submission),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(getApiErrorMessage(errorData, 'Failed to submit feedback'));
        }

        await fetchFeedback(submission.target_type, submission.target_id);
        return true;
      } catch (err) {
        setFeedback(previousFeedback);
        setStats(previousStats);
        setUserVote(previousUserVote);

        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return false;
      }
    },
    [feedback, fetchFeedback, stats, userVote]
  );

  return {
    loading,
    error,
    feedback,
    stats,
    userVote,
    fetchFeedback,
    submitFeedback,
    calculateStats,
  };
}
