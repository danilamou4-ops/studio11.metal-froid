import { createAdminClient } from "@/lib/supabase/admin";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function lastfm(method: string, params: Record<string, string | number>) {
  const key = process.env.LASTFM_API_KEY;
  if (!key) throw new Error("LASTFM_API_KEY non défini");

  const url = new URL("https://ws.audioscrobbler.com/2.0");
  url.searchParams.set("method", method);
  url.searchParams.set("api_key", key);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Last.fm ${method} HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Last.fm ${method}: ${data.message}`);
  return data;
}

function extractKeywords(name: string | null, description: string | null): string[] {
  const text = `${name ?? ""} ${description ?? ""}`.toLowerCase();
  const PATTERNS = [
    /\b(hip.?hop|rap|trap|drill|boom.?bap|r&b|rnb|soul|funk|jazz|blues|rock|metal|pop|electro(?:nic)?|house|techno|ambient|folk|country|reggae|afrobeats?|latin|world)\b/gi,
    /\b(conscient|lyriciste|underground|ind[eé]pendant|indie|alternatif|alternative|exp[eé]rimental|old.?school|new.?school)\b/gi,
    /\b(fr(?:ench|an[cç]ais?|ancophone))\b/gi,
    /\b(introspect(?:if|ive)|sombre|dark|festif|chill|relax|danse|dance|nocturne)\b/gi,
  ];
  const found = new Set<string>();
  for (const p of PATTERNS) {
    Array.from(text.matchAll(p)).forEach((m) => {
      found.add(m[0].toLowerCase().replace(/[\s.-]+/g, " ").trim());
    });
  }
  return Array.from(found);
}

const GENRE_RE =
  /hip.?hop|rap|r&b|soul|funk|trap|drill|boom.?bap|jazz|rock|pop|electr|house|techno|metal|folk|reggae|afro|latin|rnb|grime|cloud/i;

export async function enrichPlaylistById(playlistDbId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: playlist, error } = await supabase
    .from("playlists")
    .select("id, name, genre_label, description")
    .eq("id", playlistDbId)
    .single();

  if (error || !playlist) return;

  const topArtists: string[] = [];
  const tagCounts = new Map<string, number>();
  let tagsSource = "keywords";

  if (playlist.genre_label) {
    const tagQuery = playlist.genre_label
      .toLowerCase()
      .trim()
      .replace(/\s*[/,]\s*/g, " ")
      .split(" ")[0];
    try {
      const data = await lastfm("tag.gettopartists", { tag: tagQuery, limit: 10 });
      await sleep(300);
      const artists: Array<{ name: string }> = data?.topartists?.artist ?? [];
      for (const artist of artists.slice(0, 8)) {
        topArtists.push(artist.name);
        try {
          const tagData = await lastfm("artist.gettoptags", { artist: artist.name, limit: 12 });
          await sleep(250);
          for (const tag of ((tagData?.toptags?.tag ?? []) as Array<{ name: string }>).slice(0, 10)) {
            const t = tag.name.toLowerCase().trim();
            if (t.length > 2 && t.length < 40 && !/^\d+$/.test(t)) {
              tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
            }
          }
          tagsSource = "lastfm";
        } catch {
          // tag d'artiste indisponible — on continue
        }
      }
    } catch {
      // genre inconnu de Last.fm — on tombe sur les mots-clés
    }
  }

  for (const kw of extractKeywords(playlist.name as string, playlist.description as string)) {
    tagCounts.set(kw, (tagCounts.get(kw) ?? 0) + 0.5);
  }

  if (playlist.genre_label) {
    for (const part of (playlist.genre_label as string).toLowerCase().split(/[/,\s]+/).filter(Boolean)) {
      tagCounts.set(part, (tagCounts.get(part) ?? 0) + 2);
    }
  }

  const sortedTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([t]) => t);

  const artistGenres = sortedTags.filter((t) => GENRE_RE.test(t)).slice(0, 10);

  await supabase
    .from("playlists")
    .update({
      tags: sortedTags,
      tags_source: tagsSource,
      top_artists: topArtists,
      artist_genres: artistGenres,
      pending_enrichment: false,
      last_enriched_at: new Date().toISOString(),
      enrichment_error: null,
    })
    .eq("id", playlistDbId);
}
