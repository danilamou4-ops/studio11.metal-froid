/**
 * Vérification post-migration 003_pgvector
 * Usage : node scripts/verify-pgvector.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const lines = readFileSync(".env.local", "utf8").split("\n");
const env = {};
for (const l of lines) {
  const eq = l.indexOf("=");
  if (eq > 0) env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log("\n=== 1. Extension pgvector ===");
const { data: ext, error: extErr } = await sb
  .from("pg_extension")
  .select("extname,extversion")
  .eq("extname", "vector");

if (extErr) {
  // pg_extension n'est pas exposé via REST — on vérifie de façon indirecte via l'embedding
  console.log("(pg_extension non accessible via REST — vérif indirecte ci-dessous)");
} else {
  console.log(ext?.length ? `✓ vector ${ext[0].extversion} installé` : "✗ vector NON trouvé");
}

console.log("\n=== 2. Playlists avec audio_embedding ===");
const { count, error: cntErr } = await sb
  .from("playlists")
  .select("id", { count: "exact", head: true })
  .not("audio_embedding", "is", null);

if (cntErr) {
  console.log("✗ Erreur :", cntErr.message, "(colonne audio_embedding absente — migration non appliquée ?)");
} else {
  console.log(`✓ ${count} playlist(s) avec embedding`);
}

console.log("\n=== 3. RPC match_playlists_by_embedding (vecteur de test) ===");
const testVector = [0.7, 0.6, 0.5, 0.4, 0.2, 0.25];
const { data: rpcData, error: rpcErr } = await sb.rpc("match_playlists_by_embedding", {
  query_vector: testVector,
  match_count: 5,
});

if (rpcErr) {
  console.log("✗ RPC erreur :", rpcErr.message);
} else if (!rpcData || rpcData.length === 0) {
  console.log("⚠ RPC OK mais 0 résultats (aucune playlist avec embedding ?)");
} else {
  console.log(`✓ RPC OK — ${rpcData.length} résultat(s), triés par cosine_distance ASC :`);
  for (const row of rpcData) {
    console.log(
      `  ${row.name?.slice(0, 40).padEnd(40)} | dist=${row.cosine_distance?.toFixed(4)}`,
    );
  }
  const sorted = rpcData.every(
    (r, i) => i === 0 || r.cosine_distance >= rpcData[i - 1].cosine_distance,
  );
  console.log(sorted ? "✓ Tri ASC confirmé" : "✗ Tri ASC NON respecté");
}

console.log("\nDone.");
