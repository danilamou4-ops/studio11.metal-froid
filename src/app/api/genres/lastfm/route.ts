import { NextResponse } from "next/server";

type LastfmTagMatch = {
  name?: string;
};

const NOISY_LASTFM_TAGS = new Set([
  "seen live",
  "female vocalists",
  "male vocalists",
  "favorites",
  "favourite",
  "favorite",
  "british",
  "german",
  "japanese",
  "french",
  "american",
  "swedish",
  "80s",
  "90s",
  "00s",
  "10s",
  "2020s",
  "2010s",
  "2000s",
  "bookmark",
  "under 2000 listeners",
]);

function isGenreLikeTag(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length < 2 || normalized.length > 50) return false;
  if (NOISY_LASTFM_TAGS.has(normalized)) return false;
  if (/^\d{2,4}s?$/.test(normalized)) return false;
  if (/\b(listener|vocalist|country|language|favorites?)\b/.test(normalized)) return false;
  return true;
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function GET(request: Request) {
  const key = process.env.LASTFM_API_KEY;
  if (!key) {
    return NextResponse.json({ genres: [] }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  if (q.length >= 2) {
    url.searchParams.set("method", "tag.search");
    url.searchParams.set("tag", q);
    url.searchParams.set("limit", "50");
  } else {
    url.searchParams.set("method", "tag.getTopTags");
  }
  url.searchParams.set("api_key", key);
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ genres: [] }, { status: 200 });
    }

    const data = await res.json();
    const rawTags = q.length >= 2
      ? toArray<LastfmTagMatch>(data?.results?.tagmatches?.tag)
      : toArray<LastfmTagMatch>(data?.toptags?.tag);

    const genres = Array.from(
      new Set(
        rawTags
          .map((tag) => (tag.name ?? "").trim())
          .filter(isGenreLikeTag),
      ),
    ).slice(0, q.length >= 2 ? 30 : 18);

    return NextResponse.json({ genres }, { status: 200 });
  } catch {
    return NextResponse.json({ genres: [] }, { status: 200 });
  }
}
