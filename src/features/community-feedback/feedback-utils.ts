import type { CommunityFeedback, FeedbackStats } from "./types";

export function calculateFeedbackStats(feedbackList: CommunityFeedback[]): FeedbackStats {
  const upvotes = feedbackList.filter((entry) => entry.vote === 1).length;
  const downvotes = feedbackList.filter((entry) => entry.vote === -1).length;
  const reviews = feedbackList.filter((entry) => Boolean(entry.review_text)).length;
  const total = upvotes + downvotes;

  return {
    upvotes,
    downvotes,
    reviews,
    sentimentScore: total > 0 ? (upvotes - downvotes) / total : 0,
  };
}

export function applyVoteStats(
  previous: FeedbackStats | null,
  currentVote: -1 | 1 | null,
  nextVote: -1 | 1 | null,
): FeedbackStats {
  const base = previous ?? {
    upvotes: currentVote === 1 ? 1 : 0,
    downvotes: currentVote === -1 ? 1 : 0,
    reviews: 0,
    sentimentScore: currentVote === 1 ? 1 : currentVote === -1 ? -1 : 0,
  };

  let upvotes = base.upvotes;
  let downvotes = base.downvotes;

  if (currentVote === 1) upvotes -= 1;
  if (currentVote === -1) downvotes -= 1;
  if (nextVote === 1) upvotes += 1;
  if (nextVote === -1) downvotes += 1;

  const total = upvotes + downvotes;

  return {
    ...base,
    upvotes,
    downvotes,
    sentimentScore: total > 0 ? (upvotes - downvotes) / total : 0,
  };
}

export type FeedbackSignalRow = {
  vote: number | null;
  review_text: string | null;
};

export function computeFeedbackSignals(rows: FeedbackSignalRow[]) {
  const upvotes = rows.filter((row) => row.vote === 1).length;
  const downvotes = rows.filter((row) => row.vote === -1).length;
  const reviews = rows.filter((row) => Boolean(row.review_text)).length;
  const totalVotes = upvotes + downvotes;
  const sentimentScore = totalVotes > 0 ? (upvotes - downvotes) / totalVotes : 0;

  return {
    upvotes,
    downvotes,
    reviews,
    total_votes: totalVotes,
    sentiment_score: Number(sentimentScore.toFixed(3)),
    last_synced_at: new Date().toISOString(),
  };
}
