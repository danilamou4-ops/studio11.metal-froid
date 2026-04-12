import { describe, expect, it, vi, beforeEach } from "vitest";

type QueryMock = {
  select: (...args: unknown[]) => QueryMock;
  eq: (column: string, value: unknown) => QueryMock;
  not: (...args: unknown[]) => QueryMock;
  is: (...args: unknown[]) => QueryMock;
  limit: (...args: unknown[]) => QueryMock;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  delete: () => QueryMock;
  insert: (...args: unknown[]) => QueryMock;
  update: (...args: unknown[]) => QueryMock;
  single: () => Promise<{ data: unknown; error: unknown }>;
};

const maybeSingleMock = vi.fn();
const deleteEqMock = vi.fn();
const singleMock = vi.fn();

const queryBuilder: QueryMock = {
  select: vi.fn(() => queryBuilder),
  eq: vi.fn((column: string, value: unknown) => {
    if (column === "id") {
      deleteEqMock(value);
    }
    return queryBuilder;
  }),
  not: vi.fn(() => queryBuilder),
  is: vi.fn(() => queryBuilder),
  limit: vi.fn(() => queryBuilder),
  maybeSingle: maybeSingleMock,
  delete: vi.fn(() => queryBuilder),
  insert: vi.fn(() => queryBuilder),
  update: vi.fn(() => queryBuilder),
  single: singleMock,
};

const fromMock = vi.fn(() => queryBuilder);

vi.mock("@/lib/auth/route-auth", () => ({
  getAuthenticatedUser: vi.fn(async () => ({
    user: { id: "905035d3-8315-4004-b8d1-64c84d183d3a" },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

vi.mock("@/features/community-feedback/feedback-utils", () => ({
  computeFeedbackSignals: vi.fn(() => ({
    upvotes: 0,
    downvotes: 0,
    reviews: 0,
    total_votes: 0,
    sentiment_score: 0,
    last_synced_at: new Date().toISOString(),
  })),
}));

describe("POST /api/community-feedback", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    singleMock.mockReset();
    deleteEqMock.mockReset();
    fromMock.mockClear();
  });

  it("toggles off an existing vote when same vote is submitted without review", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "vote-row-1", vote: 1, review_text: null },
      error: null,
    });

    const { POST } = await import("./route");

    const request = new Request("http://localhost/api/community-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_type: "curator",
        target_id: "198d77b8-dd21-4521-9d62-d036ffa27fa1",
        vote: 1,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(deleteEqMock).toHaveBeenCalledWith("vote-row-1");
  });
});
