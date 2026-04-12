import { describe, expect, it } from "vitest";

import {
  applyVoteStats,
  calculateFeedbackStats,
  computeFeedbackSignals,
} from "./feedback-utils";
import type { CommunityFeedback } from "./types";

function feedbackEntry(partial: Partial<CommunityFeedback>): CommunityFeedback {
  return {
    id: partial.id ?? "id-1",
    target_type: partial.target_type ?? "playlist",
    target_id: partial.target_id ?? "playlist-1",
    created_by: partial.created_by ?? "user-1",
    vote: partial.vote ?? null,
    review_text: partial.review_text ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
  };
}

describe("calculateFeedbackStats", () => {
  it("calculates upvotes, downvotes, reviews and sentiment score", () => {
    const entries = [
      feedbackEntry({ id: "1", vote: 1 }),
      feedbackEntry({ id: "2", vote: 1, review_text: "super" }),
      feedbackEntry({ id: "3", vote: -1 }),
      feedbackEntry({ id: "4", review_text: "pas convaincu" }),
    ];

    const stats = calculateFeedbackStats(entries);

    expect(stats.upvotes).toBe(2);
    expect(stats.downvotes).toBe(1);
    expect(stats.reviews).toBe(2);
    expect(stats.sentimentScore).toBeCloseTo(1 / 3, 3);
  });
});

describe("applyVoteStats", () => {
  it("supports toggling vote off", () => {
    const next = applyVoteStats(
      { upvotes: 3, downvotes: 1, reviews: 2, sentimentScore: 0.5 },
      1,
      null,
    );

    expect(next.upvotes).toBe(2);
    expect(next.downvotes).toBe(1);
    expect(next.sentimentScore).toBeCloseTo(1 / 3, 3);
  });

  it("supports switching vote direction", () => {
    const next = applyVoteStats(
      { upvotes: 2, downvotes: 2, reviews: 0, sentimentScore: 0 },
      -1,
      1,
    );

    expect(next.upvotes).toBe(3);
    expect(next.downvotes).toBe(1);
    expect(next.sentimentScore).toBeCloseTo(0.5, 3);
  });
});

describe("computeFeedbackSignals", () => {
  it("aggregates signals with rounded sentiment score", () => {
    const signals = computeFeedbackSignals([
      { vote: 1, review_text: null },
      { vote: 1, review_text: "great" },
      { vote: -1, review_text: null },
      { vote: null, review_text: "needs work" },
    ]);

    expect(signals.upvotes).toBe(2);
    expect(signals.downvotes).toBe(1);
    expect(signals.reviews).toBe(2);
    expect(signals.total_votes).toBe(3);
    expect(signals.sentiment_score).toBeCloseTo(0.333, 3);
    expect(typeof signals.last_synced_at).toBe("string");
  });
});
