#!/usr/bin/env node
/**
 * enrich-spotify-playlists.mjs
 * Enrichit les playlists Spotify en base avec :
 * 1. Artistes dominants via Spotify API
 * 2. Tags fins via Last.fm API
 * 3. Tags supplémentaires via MusicBrainz API
 * 4. Tags sémantiques via dictionnaire de mots-clés (nom + description)
 *
 * Usage :
 *   node --env-file=.env.local scripts/enrich-spotify-playlists.mjs
 *
 * Variables requises dans .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 *   LASTFM_API_KEY  (gratuit sur last.fm/api)
 */

import { createClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const SPOTIFY_CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const LASTFM_API_KEY        = process.env.LASTFM_API_KEY

const DELAY_MS        = 300  // délai entre requêtes pour éviter rate limit
const MAX_ARTISTS     = 10   // artistes analysés par playlist
const MAX_TRACKS      = 30   // tracks récupérées par playlist

// ─── Dictionnaire mots-clés sémantiques ───────────────────
const KEYWORD_TAGS = {
  // Valeurs / univers
  conscient:     ['conscient', 'engagé', 'conscious', 'militant', 'politique', 'social'],
  lyriciste:     ['lyriciste', 'lyrical', 'textes', 'punchlines', 'écriture', 'plume', 'lyrics'],
  underground:   ['underground', 'indé', 'indépendant', 'alternatif', 'alternative', 'souterrain'],
  introspectif:  ['introspectif', 'introspective', 'mélancolique', 'sad', 'triste', 'sombre', 'deep'],
  // Sous-genres
  boom_bap:      ['boom bap', 'boom-bap', 'old school', 'oldschool', 'classique', 'puriste'],
  trap:          ['trap', 'drill', 'dark trap', 'cloud trap'],
  new_wave:      ['new wave', 'nouvelle vague', 'new gen', 'nouvelle génération'],
  chill:         ['chill', 'lofi', 'lo-fi', 'relaxation', 'détente', 'study', 'concentration'],
  jazzy:         ['jazz', 'jazzy', 'nu jazz', 'acid jazz', 'jazztronica'],
  // Contexte
  decouverte:    ['découverte', 'découvertes', 'nouveautés', 'émergent', 'rookie', 'new artist'],
  francophone:   ['français', 'francophone', 'france', 'québec', 'belgique', 'suisse'],
}

// ─── Helpers ──────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

function extractTagsFromText(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  const found = []
  for (const [tag, keywords] of Object.entries(KEYWORD_TAGS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      found.push(tag)
    }
  }
  return found
}

// ─── Spotify Auth ─────────────────────────────────────────
let spotifyToken = null
let spotifyTokenExpiry = 0

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`)
  const data = await res.json()
  spotifyToken = data.access_token
  spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return spotifyToken
}

async function spotifyFetch(path) {
  const token = await getSpotifyToken()
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10)
    console.log(`  ⏳ Rate limited, attente ${retryAfter}s...`)
    await sleep(retryAfter * 1000)
    return spotifyFetch(path)
  }
  if (!res.ok) return null
  return res.json()
}

// ─── Last.fm ──────────────────────────────────────────────
async function getLastFmTags(artistName) {
  if (!LASTFM_API_KEY) return []
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json&limit=10`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const tags = data?.toptags?.tag || []
    return tags
      .filter(t => t.count > 20)
      .map(t => t.name.toLowerCase().trim())
      .filter(t => t.length > 2 && t.length < 30)
  } catch {
    return []
  }
}

// ─── MusicBrainz ──────────────────────────────────────────
async function getMusicBrainzTags(artistName) {
  try {
    await sleep(1100) // MusicBrainz : max 1 req/sec
    const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(artistName)}&fmt=json&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MetalFroid/0.1 (curator-match)' },
    })
    if (!res.ok) return []
    const data = await res.json()
    const artist = data?.artists?.[0]
    if (!artist) return []
    return (artist.tags || [])
      .filter(t => t.count > 0)
      .map(t => t.name.toLowerCase().trim())
  } catch {
    return []
  }
}

// ─── Enrichissement d'une playlist ────────────────────────
async function enrichPlaylist(playlist) {
  console.log(`\n🎵 ${playlist.name}`)

  const allTags = new Set()
  const tagSource = []

  // 1. Tags sémantiques depuis nom + description
  const keywordTags = extractTagsFromText(`${playlist.name} ${playlist.description || ''}`)
  keywordTags.forEach(t => allTags.add(t))
  if (keywordTags.length) {
    console.log(`  📝 Keywords: ${keywordTags.join(', ')}`)
    tagSource.push('keywords')
  }

  // 2. Si Spotify → enrichissement via tracks + artistes
  let topArtists = []
  let artistGenres = []
  let avgPopularity = null

  if (playlist.platform === 'spotify' && playlist.spotify_playlist_id) {
    const tracksData = await spotifyFetch(
      `/playlists/${playlist.spotify_playlist_id}/tracks?limit=${MAX_TRACKS}&fields=items(track(artists,popularity))`
    )
    await sleep(DELAY_MS)

    if (tracksData?.items) {
      // Collecter artistes uniques
      const artistMap = new Map()
      const popularities = []

      for (const item of tracksData.items) {
        const track = item?.track
        if (!track) continue
        if (track.popularity) popularities.push(track.popularity)
        for (const artist of track.artists || []) {
          if (artist.id && !artistMap.has(artist.id)) {
            artistMap.set(artist.id, artist.name)
          }
        }
      }

      avgPopularity = popularities.length
        ? Math.round(popularities.reduce((a, b) => a + b, 0) / popularities.length)
        : null

      // Récupérer genres des top artistes
      const artistIds = [...artistMap.keys()].slice(0, MAX_ARTISTS)
      topArtists = [...artistMap.values()].slice(0, MAX_ARTISTS)

      if (artistIds.length) {
        const artistsData = await spotifyFetch(`/artists?ids=${artistIds.join(',')}`)
        await sleep(DELAY_MS)

        if (artistsData?.artists) {
          const genreSet = new Set()
          for (const artist of artistsData.artists) {
            for (const genre of artist.genres || []) {
              genreSet.add(genre.toLowerCase())
            }
          }
          artistGenres = [...genreSet]
          console.log(`  🎤 Artistes: ${topArtists.slice(0, 3).join(', ')}...`)
          console.log(`  🎸 Genres Spotify: ${artistGenres.slice(0, 5).join(', ')}`)
        }
      }
    }
  }

  // 3. Last.fm tags sur les top artistes
  const lastfmTags = new Set()
  for (const artistName of topArtists.slice(0, 5)) {
    const tags = await getLastFmTags(artistName)
    tags.forEach(t => lastfmTags.add(t))
    await sleep(DELAY_MS)
  }
  if (lastfmTags.size) {
    lastfmTags.forEach(t => allTags.add(t))
    tagSource.push('lastfm')
    console.log(`  🎧 Last.fm: ${[...lastfmTags].slice(0, 5).join(', ')}`)
  }

  // 4. MusicBrainz sur le premier artiste uniquement (rate limit strict)
  if (topArtists[0]) {
    const mbTags = await getMusicBrainzTags(topArtists[0])
    if (mbTags.length) {
      mbTags.forEach(t => allTags.add(t))
      tagSource.push('musicbrainz')
      console.log(`  🧠 MusicBrainz: ${mbTags.slice(0, 5).join(', ')}`)
    }
  }

  // 5. Mise à jour en base
  const { error } = await supabase
    .from('playlists')
    .update({
      tags:               [...allTags],
      tags_source:        tagSource.join(','),
      top_artists:        topArtists,
      artist_genres:      artistGenres,
      avg_popularity:     avgPopularity,
      pending_enrichment: false,
      last_enriched_at:   new Date().toISOString(),
      enrichment_error:   null,
    })
    .eq('id', playlist.id)

  if (error) {
    console.error(`  ❌ Erreur update: ${error.message}`)
    await supabase
      .from('playlists')
      .update({ enrichment_error: error.message })
      .eq('id', playlist.id)
  } else {
    console.log(`  ✅ ${allTags.size} tags — popularité: ${avgPopularity ?? '?'}`)
  }
}

// ─── Main ─────────────────────────────────────────────────
async function run() {
  console.log('🚀 Enrichissement des playlists — Métal Froid\n')

  if (!LASTFM_API_KEY) {
    console.warn('⚠️  LASTFM_API_KEY manquante — tags Last.fm désactivés')
    console.warn('   Créer une clé gratuite sur https://www.last.fm/api/account/create\n')
  }

  // Récupérer les playlists à enrichir
  const { data: playlists, error } = await supabase
    .from('playlists')
    .select('id, name, description, platform, spotify_playlist_id')
    .eq('pending_enrichment', true)
    .eq('is_active', true)
    .order('followers', { ascending: false })

  if (error) {
    console.error('Erreur lecture Supabase:', error.message)
    process.exit(1)
  }

  if (!playlists?.length) {
    console.log('✅ Aucune playlist à enrichir.')
    process.exit(0)
  }

  console.log(`📋 ${playlists.length} playlists à enrichir\n`)

  let success = 0
  let failed = 0

  for (const playlist of playlists) {
    try {
      await enrichPlaylist(playlist)
      success++
    } catch (err) {
      console.error(`  ❌ Erreur inattendue: ${err.message}`)
      failed++
    }
    await sleep(DELAY_MS)
  }

  console.log('\n─────────────────────────────────')
  console.log(`✅ Enrichies : ${success}`)
  console.log(`❌ Erreurs   : ${failed}`)
  console.log('─────────────────────────────────')
}

run().catch(err => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
