'use client';

// CONVENTION PROJET : icons over emojis — utiliser lucide-react systématiquement

import { useState, useEffect } from 'react';
import { Loader2, MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useCommunityFeedback } from '@/features/community-feedback/useCommunityFeedback';
import type { FeedbackTarget } from '@/features/community-feedback/types';
import { ViewState } from '@/components/ui/view-state';

interface CommunityFeedbackPanelProps {
  targetType: FeedbackTarget;
  targetId: string;
  curatorId?: string | null;
  className?: string;
}

type FeedbackSectionProps = {
  title: string;
  targetType: FeedbackTarget;
  targetId: string;
  placeholder: string;
  recentTitle: string;
  showRecentReviews?: boolean;
};

const MAX_REVIEW_LENGTH = 500;

function FeedbackSection({
  title,
  targetType,
  targetId,
  placeholder,
  recentTitle,
  showRecentReviews = true,
}: FeedbackSectionProps) {
  const { loading, error, feedback, stats, userVote, fetchFeedback, submitFeedback } = useCommunityFeedback();
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetchFeedback(targetType, targetId);
  }, [fetchFeedback, targetId, targetType]);

  const remainingCharacters = MAX_REVIEW_LENGTH - reviewText.length;

  async function handleVote(vote: -1 | 1) {
    setSuccessMessage(null);
    setIsSubmittingVote(true);

    try {
      const removed = userVote === vote;
      const success = await submitFeedback({
        target_type: targetType,
        target_id: targetId,
        vote,
      });

      if (success) {
        setSuccessMessage(removed ? 'Vote retiré.' : 'Vote enregistré.');
      }
    } finally {
      setIsSubmittingVote(false);
    }
  }

  async function handleSubmitReview() {
    if (!reviewText.trim() || userVote == null) {
      return;
    }

    setSuccessMessage(null);
    setIsSubmittingReview(true);

    try {
      const success = await submitFeedback({
        target_type: targetType,
        target_id: targetId,
        vote: userVote,
        review_text: reviewText.trim(),
      });

      if (success) {
        setReviewText('');
        setSuccessMessage('Avis soumis avec succès.');
      }
    } finally {
      setIsSubmittingReview(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span>{title}</span>
        </h3>

        {stats && (
          <div className="mb-4 flex gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{stats.upvotes}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>Positif</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">{stats.downvotes}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ThumbsDown className="h-3.5 w-3.5" />
                <span>Critique</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{stats.reviews}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Avis</span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => void handleVote(1)}
            disabled={isSubmittingVote || isSubmittingReview}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
              userVote === 1
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-border bg-card text-foreground hover:border-green-300'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isSubmittingVote && userVote !== -1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
            <span>Positif</span>
          </button>
          <button
            type="button"
            onClick={() => void handleVote(-1)}
            disabled={isSubmittingVote || isSubmittingReview}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
              userVote === -1
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-border bg-card text-foreground hover:border-red-300'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isSubmittingVote && userVote !== 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
            <span>Critique</span>
          </button>
        </div>

        <div className="space-y-2">
          <textarea
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value.slice(0, MAX_REVIEW_LENGTH))}
            placeholder={placeholder}
            className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={3}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Le vote positif ou critique est requis pour envoyer un avis.</span>
            <span>{remainingCharacters} caractères restants</span>
          </div>
          <button
            type="button"
            onClick={() => void handleSubmitReview()}
            disabled={isSubmittingVote || isSubmittingReview || !reviewText.trim() || userVote == null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            <span>{isSubmittingReview ? 'Envoi en cours...' : 'Soumettre l’avis'}</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <ViewState
          variant="success"
          title="Action enregistrée"
          description={successMessage}
        />
      )}

      {error && (
        <ViewState
          variant="error"
          title="Feedback indisponible"
          description={error}
        />
      )}

      {showRecentReviews && feedback.some((entry) => entry.review_text) && (
        <div className="border-t border-border pt-3">
          <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{recentTitle}</h4>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {feedback
              .filter((entry) => entry.review_text)
              .slice(0, 5)
              .map((entry) => (
                <div key={entry.id} className="rounded-lg bg-muted/50 p-2">
                  <p className="break-words text-xs text-foreground">{entry.review_text}</p>
                  <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {loading ? (
        <ViewState
          variant="loading"
          title="Chargement du feedback"
          description="Récupération des votes et avis en cours..."
        />
      ) : null}
    </div>
  );
}

export function CommunityFeedbackPanel({
  targetType,
  targetId,
  curatorId,
  className = '',
}: CommunityFeedbackPanelProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <FeedbackSection
        title="Avis sur la playlist"
        targetType={targetType}
        targetId={targetId}
        placeholder="Partagez votre avis sur cette playlist..."
        recentTitle="Avis récents sur la playlist"
      />
      {curatorId && (
        <FeedbackSection
          title="Avis sur le curateur"
          targetType="curator"
          targetId={curatorId}
          placeholder="Partagez votre avis sur le curateur..."
          recentTitle="Avis récents sur le curateur"
          showRecentReviews={false}
        />
      )}
    </div>
  );
}
