#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import pkg from "papaparse";
const { parse } = pkg;
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, "data", "curator_seed.csv");

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

console.log("Using key type:", serviceRoleKey.length > 200 ? "service_role (long ✅)" : "possibly anon (short ⚠️)");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function extractSpotifyPlaylistId(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function normalizeGenres(label) {
  if (!label) return [];

  return label
    .split(/[\/,]/)
    .map((genre) =>
      genre
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    )
    .filter(Boolean);
}

function sanitizeToken(value) {
  return value.replace(/[),.;]+$/g, "").trim();
}

function parseContactChannels(rawValue) {
  const raw = (rawValue ?? "").trim();
  if (!raw) {
    return {
      contactUrl: null,
      instagramUrl: null,
      email: null,
    };
  }

  const urls = (raw.match(/https?:\/\/[^\s]+/gi) ?? []).map(sanitizeToken);
  const emails = (raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((e) =>
    e.toLowerCase(),
  );

  const instagramHandleMatch = raw.match(/(?:instagram\s*[:\-]?\s*)?@([a-zA-Z0-9._]+)/i);
  const instagramFromHandle = instagramHandleMatch
    ? `https://www.instagram.com/${instagramHandleMatch[1]}/`
    : null;

  const instagramFromUrl = urls.find((url) => /instagram\.com/i.test(url)) ?? null;
  const instagramUrl = instagramFromUrl ?? instagramFromHandle;

  const nonInstagramUrl = urls.find((url) => !/instagram\.com/i.test(url)) ?? null;
  const contactUrl = nonInstagramUrl ?? instagramUrl;
  const email = emails[0] ?? null;

  return {
    contactUrl,
    instagramUrl,
    email,
  };
}

async function findExistingCurator({ contactUrl, instagramUrl, email }) {
  if (contactUrl) {
    const { data } = await supabase
      .from("curators")
      .select("id")
      .eq("contact_url", contactUrl)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  if (instagramUrl) {
    const { data } = await supabase
      .from("curators")
      .select("id")
      .eq("instagram_url", instagramUrl)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  if (email) {
    const { data } = await supabase
      .from("curators")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}

async function run() {
  const csvRaw = readFileSync(csvPath, "utf-8");
  const { data, errors } = parse(csvRaw, {
    header: true,
    skipEmptyLines: true,
    delimiter: ";",
    transformHeader: (header) => header.trim(),
  });

  if (errors.length) {
    console.error("CSV parsing errors:", errors);
    process.exit(1);
  }

  let inserted = 0;

  for (const row of data) {
    const playlistUrl = row["URL Spotify"]?.trim();
    const playlistId = extractSpotifyPlaylistId(playlistUrl);

    if (!playlistId) continue;

    const followersRaw = row["Followers"] ?? row["Nombre de followers"];
    const followers = followersRaw
      ? Number.parseInt(String(followersRaw).replace(/[^0-9]/g, ""), 10) || null
      : null;

    const contactRaw = row["Lien de contact"]?.trim() || null;
    const { contactUrl, instagramUrl, email } = parseContactChannels(contactRaw);
    const curatorName = `${row["Nom de la playlist"]?.trim() ?? "Curator"} (curateur)`;

    let curatorId = null;

    if (contactUrl || instagramUrl || email) {
      const existingCuratorId = await findExistingCurator({ contactUrl, instagramUrl, email });

      if (existingCuratorId) {
        const { data: updatedCurator, error: updateError } = await supabase
          .from("curators")
          .update({
            name: curatorName,
            country: row["Pays"]?.trim() || null,
            contact_url: contactUrl,
            instagram_url: instagramUrl,
            email,
          })
          .eq("id", existingCuratorId)
          .select("id")
          .single();

        if (updateError) {
          console.error("Curator update error:", updateError.message);
        } else {
          curatorId = updatedCurator?.id ?? existingCuratorId;
        }
      } else {
        const { data: insertedCurator, error: insertError } = await supabase
          .from("curators")
          .insert({
            name: curatorName,
            country: row["Pays"]?.trim() || null,
            contact_url: contactUrl,
            instagram_url: instagramUrl,
            email,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Curator insert error:", insertError.message);
        } else {
          curatorId = insertedCurator?.id ?? null;
        }
      }
    }

    const genreLabel = row["Genre dominant"]?.trim() || null;

    const { error: playlistError } = await supabase.from("playlists").upsert(
      {
        curator_id: curatorId,
        spotify_playlist_id: playlistId,
        name: row["Nom de la playlist"]?.trim(),
        spotify_url: playlistUrl,
        followers,
        description: row["Description"]?.trim() || null,
        genre_label: genreLabel,
        genres_normalized: normalizeGenres(genreLabel),
        is_active: true,
      },
      { onConflict: "spotify_playlist_id" },
    );

    if (playlistError) console.error("Playlist error:", playlistError.message, row["Nom de la playlist"]);
    else console.log("✅", row["Nom de la playlist"]);

    if (!playlistError) {
      inserted += 1;
    }
  }

  console.log(`Seed import completed. Rows upserted: ${inserted}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
