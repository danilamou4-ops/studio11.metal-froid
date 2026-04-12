import { NextResponse } from "next/server";
import { z } from "zod";

import { scorePlaylists } from "@/server/services/search/scorePlaylists";

const nullableUnit = z.number().min(0).max(1).nullable();

const requestSchema = z.object({
  features: z.object({
    bpm: z.number().positive().nullable(),
    energy: nullableUnit,
    danceability: nullableUnit,
    valence: nullableUnit,
    acousticness: nullableUnit,
    speechiness: nullableUnit,
    key: z.string().nullable(),
    mode: z.enum(["major", "minor"]).nullable(),
  }),
  limit: z.number().int().min(1).max(50).optional(),
});

function hasAtLeastOneSignal(features: z.infer<typeof requestSchema>["features"]) {
  return [
    features.bpm,
    features.energy,
    features.danceability,
    features.valence,
    features.acousticness,
    features.speechiness,
  ].some((value) => typeof value === "number");
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "Invalid payload",
          },
        },
        { status: 400 },
      );
    }

    if (!hasAtLeastOneSignal(parsed.data.features)) {
      return NextResponse.json(
        {
          error: {
            code: "NO_AUDIO_SIGNALS",
            message: "At least one numeric feature is required to score playlists.",
          },
        },
        { status: 400 },
      );
    }

    const search = await scorePlaylists(parsed.data.features, parsed.data.limit ?? 20);

    return NextResponse.json({
      data: {
        sourceType: "feature-search",
        totalCandidates: search.totalCandidates,
        results: search.results,
      },
      meta: {
        partial: false,
        scoreModeSummary: search.scoreModeSummary,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "SEARCH_FAILED",
          message: error instanceof Error ? error.message : "Unknown search error",
        },
      },
      { status: 500 },
    );
  }
}
