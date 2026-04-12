#!/usr/bin/env node
// enrich-spotify-playlists.mjs — Enrichissement via Last.fm (pas de Spotify requis)

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ─── Chargement .env.local ────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envLines = readFileSync(join(__dirname, "..", ".env.local"), "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const eq = line.indexOf("=");
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const LASTFM_KEY = env.LASTFM_API_KEY;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!LASTFM_KEY) { console.error("❌ LASTFM_API_KEY manquant dans .env.local"); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error("❌ Variables Supabase manquantes"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function evaluateQualityGate(playlist, curator) {
  const reasons = [];

  const hasContact = isNonEmpty(curator?.contact_url) || isNonEmpty(curator?.instagram_url) || isNonEmpty(curator?.email);
  const complete = isNonEmpty(playlist.spotify_url) && isNonEmpty(playlist.genre_label) && hasContact;
  if (!complete) {
    reasons.push("Completu de insuffisante: URL playlist, genre et au moins un contact sont obligatoires.");
  }

  if (curator?.contact_url && !isValidUrl(curator.contact_url)) {
    reasons.push("contactUrl invalide: URL non exploitable.");
  }
  if (curator?.instagram_url && !isValidUrl(curator.instagram_url)) {
    reasons.push("instagramUrl invalide: URL non exploitable.");
  }
  if (curator?.email && !isValidEmail(curator.email)) {
    reasons.push("email invalide: format non exploitable.");
  }

  if (playlist.quality_confidence == null) {
    reasons.push("quality_confidence indisponible: enrichissement en attente.");
  } else if (playlist.quality_confidence < 0.6) {
    reasons.push("quality_confidence inferieur au seuil minimum (0.60).");
  }

  return { pass: reasons.length === 0, reasons, awaitingEnrichment: playlist.quality_confidence == null };
}

async function lastfm(method, params) {
  const url = new URL("https://ws.audioscrobbler.com/2.0");
  url.searchParams.set("method", method);
  url.searchParams.set("api_key", LASTFM_KEY);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Last.fm ${method} HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Last.fm ${method}: ${data.message}`);
  return data;
}

/** Extrait des mots-clés pertinents depuis le nom + la description d'une playlist */
function extractKeywords(name, description) {
  const text = `${name ?? ""} ${description ?? ""}`.toLowerCase();
  const PATTERNS = [
    /\b(hip.?hop|rap|trap|drill|boom.?bap|r&b|rnb|soul|funk|jazz|blues|rock|metal|pop|electro(?:nic)?|house|techno|ambient|folk|country|reggae|afrobeats?|latin|world)\b/gi,
    /\b(conscient|lyriciste|underground|ind[eé]pendant|indie|alternatif|alternative|exp[eé]rimental|old.?school|new.?school)\b/gi,
    /\b(fr(?:ench|an[cç]ais?|ancophone))\b/gi,
    /\b(introspect(?:if|ive)|sombre|dark|festif|chill|relax|danse|dance|nocturne)\b/gi,
  ];
  const found = new Set();
  for (const p of PATTERNS) {
    for (const m of text.matchAll(p)) {
      found.add(m[0].toLowerCase().replace(/[\s.-]+/g, " ").trim());
    }
  }
  return [...found];
}

// ─── Enrichissement d'une playlist ───────────────────────────────────────────
async function enrichPlaylist(playlist) {
  const { id, name, genre_label, description } = playlist;
  console.log(`\n  📋 "${name}"  (genre: ${genre_label ?? "n/a"})`);

  const topArtists = [];
  const tagCounts = new Map(); // tag → score cumulé
  let tagsSource = "keywords";

  // 1. Artistes Last.fm pour le genre_label
  if (genre_label) {
    const tagQuery = genre_label.toLowerCase().trim().replace(/\s*[\/,]\s*/g, " ").split(" ")[0];
    try {
      const data = await lastfm("tag.gettopartists", { tag: tagQuery, limit: 10 });
      await sleep(300);
      const artists = data?.topartists?.artist ?? [];

      for (const artist of artists.slice(0, 8)) {
        topArtists.push(artist.name);

        // 2. Tags communautaires pour chaque artiste
        try {
          const tagData = await lastfm("artist.gettoptags", { artist: artist.name, limit: 12 });
          await sleep(250);
          for (const tag of (tagData?.toptags?.tag ?? []).slice(0, 10)) {
            const t = tag.name.toLowerCase().trim();
            if (t.length > 2 && t.length < 40 && !/^\d+$/.test(t)) {
              tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
            }
          }
          tagsSource = "lastfm";
        } catch (e) {
          console.warn(`    ⚠️  Tags pour "${artist.name}": ${e.message}`);
        }
      }

      if (topArtists.length === 0) console.warn(`    ⚠️  Aucun artiste pour le tag "${tagQuery}"`);
    } catch (e) {
      console.warn(`    ⚠️  tag.gettopartists "${tagQuery}": ${e.message}`);
    }
  }

  // 3. Mots-clés extraits du nom + description (fallback / complément)
  for (const kw of extractKeywords(name, description)) {
    tagCounts.set(kw, (tagCounts.get(kw) ?? 0) + 0.5);
  }

  // 4. Ajouter le genre_label lui-même comme tag de référence
  if (genre_label) {
    for (const part of genre_label.toLowerCase().split(/[\/,\s]+/).filter(Boolean)) {
      tagCounts.set(part, (tagCounts.get(part) ?? 0) + 2);
    }
  }

  // 5. Sélectionner top 20 tags par score
  const sortedTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([t]) => t);

  // 6. Extraire sous-ensemble genre pour artist_genres
  const GENRE_RE = /hip.?hop|rap|r&b|soul|funk|trap|drill|boom.?bap|jazz|rock|pop|electr|house|techno|metal|folk|reggae|afro|latin|rnb|grime|cloud/i;
  const artistGenres = sortedTags.filter((t) => GENRE_RE.test(t)).slice(0, 10);

  console.log(`    ✓ ${topArtists.length} artistes · ${sortedTags.length} tags (source: ${tagsSource})`);
  if (sortedTags.length > 0) console.log(`    → ${sortedTags.slice(0, 6).join(", ")}…`);

  return {
    tags: sortedTags,
    tags_source: tagsSource,
    top_artists: topArtists,
    artist_genres: artistGenres,
    pending_enrichment: false,
    last_enriched_at: new Date().toISOString(),
    enrichment_error: null,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🎵 Enrichissement des playlists via Last.fm\n");

  const { data: playlists, error } = await supabase
    .from("playlists")
    .select("id, name, genre_label, description, spotify_url, contribution_status, quality_confidence, quality_gate_snapshot, curator:curators(contact_url,instagram_url,email)")
    .eq("pending_enrichment", true)
    .in("contribution_status", ["draft", "active"])
    .order("followers", { ascending: false });

  if (error) { console.error("❌ Supabase:", error.message); process.exit(1); }
  console.log(`📊 ${playlists.length} playlist(s) à enrichir`);

  let success = 0;
  let failed = 0;

  for (const playlist of playlists) {
    try {
      const enriched = await enrichPlaylist(playlist);
      const { error: updateError } = await supabase
        .from("playlists")
        .update(enriched)
        .eq("id", playlist.id);
      if (updateError) throw new Error(updateError.message);

      const { data: refreshedPlaylist, error: refreshedError } = await supabase
        .from("playlists")
        .select("quality_confidence")
        .eq("id", playlist.id)
        .maybeSingle();

      if (refreshedError) throw new Error(refreshedError.message);

      const curator = Array.isArray(playlist.curator) ? (playlist.curator[0] ?? null) : (playlist.curator ?? null);
      const gate = evaluateQualityGate(
        {
          spotify_url: playlist.spotify_url,
          genre_label: playlist.genre_label,
          quality_confidence: refreshedPlaylist?.quality_confidence ?? playlist.quality_confidence,
        },
        curator,
      );

      const currentSnapshot =
        playlist.quality_gate_snapshot && typeof playlist.quality_gate_snapshot === "object"
          ? playlist.quality_gate_snapshot
          : {};

      const nextSnapshot = {
        ...currentSnapshot,
        quality_gate: {
          pass: gate.pass,
          reasons: gate.reasons,
          awaiting_enrichment: gate.awaitingEnrichment,
          evaluated_at: new Date().toISOString(),
        },
      };

      const statusUpdate = gate.pass
        ? {
            contribution_status: "active",
            is_active: true,
            quality_review_queue: false,
            review_reason: null,
            quality_gate_snapshot: nextSnapshot,
          }
        : {
            contribution_status: "draft",
            is_active: false,
            quality_review_queue: true,
            review_reason: gate.reasons.join(" | "),
            quality_gate_snapshot: nextSnapshot,
          };

      const { error: transitionError } = await supabase
        .from("playlists")
        .update(statusUpdate)
        .eq("id", playlist.id);

      if (transitionError) throw new Error(transitionError.message);

      const governanceAction = gate.pass ? "auto_approved" : "sent_to_review";
      await supabase.from("playlist_governance_events").insert({
        playlist_id: playlist.id,
        action: governanceAction,
        actor_user_id: null,
        reason: gate.reasons[0] ?? null,
        payload: {
          status: gate.pass ? "active" : "draft",
          triggered_by: "system",
          reasons: gate.reasons,
        },
      });

      success++;
      await sleep(500);
    } catch (e) {
      console.error(`  ❌ "${playlist.name}": ${e.message}`);
      await supabase.from("playlists").update({
        enrichment_error: e.message,
        pending_enrichment: false,
      }).eq("id", playlist.id);
      failed++;
    }
  }

  console.log(`\n✅ Terminé — ${success} enrichie(s), ${failed} erreur(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
