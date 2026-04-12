/**
 * db-cleanup.mjs — nettoyage base Métal Froid
 * Usage : node scripts/db-cleanup.mjs
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

let ok = 0;
let fail = 0;

async function run(label, fn) {
  try {
    const result = await fn();
    if (result.error) {
      console.error(`✗ ${label}: ${result.error.message}`);
      fail++;
    } else {
      const count = result.count ?? result.data?.length ?? "—";
      console.log(`✓ ${label} (rows: ${count})`);
      ok++;
    }
  } catch (e) {
    console.error(`✗ ${label}: ${e.message}`);
    fail++;
  }
}

console.log("\n════════════════════════════════════════");
console.log("  DB Cleanup — Métal Froid");
console.log("════════════════════════════════════════\n");

// ── 0. Note : emails orphelins à préserver ─────────────────────────────────
// dirtyswift@gmail.com   → Fresh Rap FR Découvertes  (id: ac0fa3b1-...)
// justmakehit.pr@gmail.com → Hits of the Week        (id: 8d762126-...)
// Ces curateurs sont supprimés → leurs emails sont perdus. Ils sont loggés ici.
console.log("ℹ Emails à conserver avant suppression :");
const { data: orphanEmails } = await sb
  .from("curators")
  .select("id,name,email,contact_url,instagram_url")
  .in("id", [
    "ac0fa3b1-d04e-44ff-a463-bc6bab76bfbb",
    "8d762126-b4a4-4089-9946-e236d568bbd1",
  ]);
for (const c of orphanEmails ?? []) {
  console.log(`   ${c.name} | email: ${c.email} | instagram: ${c.instagram_url} | contact: ${c.contact_url}`);
}
console.log();

// ── 1. Désactiver les playlists de test ──────────────────────────────────────
await run("1. Désactiver playlists de test", () =>
  sb
    .from("playlists")
    .update({ is_active: false })
    .in("id", [
      "ef83ddf5-6243-49d3-ad1c-944c783be524",
      "af20efcc-7d65-43fd-a9a0-17cdda190c48",
      "2e2bbbf7-fa57-45e0-b452-e4270a762bcb",
      "eb36db70-8200-4623-baf2-cb7914b95e3f",
      "31292361-8ef9-4d0b-b932-eb454116f8b0",
      "adcaac02-b35d-4c03-80aa-56fbf2ee550c",
      "9e28fff5-3cc1-4856-8303-577b23053747",
    ])
    .select("id"),
);

// ── 2. Corriger instagram mal parsé (Le Carré VIP) ──────────────────────────
await run("2. Le Carré VIP : instagram_url → null, contact_url corrigé", () =>
  sb
    .from("curators")
    .update({
      instagram_url: null,
      contact_url: "https://www.instagram.com/vipzone/",
    })
    .eq("id", "618dd399-522d-439f-ab5d-7d3ff40becab")
    .select("id"),
);

// ── 3. Corriger instagram douteux (Le Rap en Mieux) ─────────────────────────
await run("3. Le Rap en Mieux : instagram_url + contact_url → null", () =>
  sb
    .from("curators")
    .update({ instagram_url: null, contact_url: null })
    .eq("id", "73cdeed2-0206-42b7-aa69-0fd7ded899f1")
    .select("id"),
);

// ── 4a. Corriger contact_url texte libre avant suppression (Adanah Records) ─
await run("4a. Adanah Records : contact_url → null, instagram corrigé", () =>
  sb
    .from("curators")
    .update({
      contact_url: null,
      instagram_url: "https://www.instagram.com/adanahrecords/",
    })
    .eq("id", "22d5e095-9d72-4ace-88eb-70874dac7ac0")
    .select("id"),
);

// ── 4b. Corriger contact_url texte libre (Digster) – sera supprimé ensuite ──
await run("4b. Digster : contact_url → null", () =>
  sb
    .from("curators")
    .update({ contact_url: null })
    .eq("id", "aebfc8df-7be3-4350-b9b0-98155dd5b5f7")
    .select("id"),
);

// ── 5. Supprimer les curateurs orphelins ────────────────────────────────────
await run("5. Supprimer curateurs orphelins (13)", () =>
  sb
    .from("curators")
    .delete()
    .in("id", [
      "4498120b-d4e7-414b-ab20-e63c0117e872",
      "00e7a487-6906-4bc0-af71-08bb0ed23156",
      "4b5720ed-f6fc-48f6-9ed7-a6343d44c489",
      "ac0fa3b1-d04e-44ff-a463-bc6bab76bfbb",
      "8d762126-b4a4-4089-9946-e236d568bbd1",
      "aebfc8df-7be3-4350-b9b0-98155dd5b5f7",
      "22d5e095-9d72-4ace-88eb-70874dac7ac0",
      "5af485bc-8bfe-453c-ac72-52d0eabb80e3",
      "85c37267-cdc7-47c6-a43e-143037b2c80d",
      "dc07e51a-ca4e-46f5-b57f-90ed5a1739e2",
      "15ea5eae-04c8-4049-8750-c8b432720852",
      "ebad4803-6f3f-494a-8e90-bedadc82d6ba",
      "4ff6e85b-4ee7-4c29-87b7-cac9d5bda966",
    ])
    .select("id"),
);

// ── Vérification post-nettoyage ─────────────────────────────────────────────
console.log("\n── Vérification post-nettoyage ─────────────────────────────");

const { data: activePlaylists } = await sb
  .from("playlists")
  .select("id")
  .eq("is_active", true);
console.log(`   Playlists actives : ${activePlaylists?.length ?? "?"}`);

const { data: activeCurators } = await sb
  .from("curators")
  .select("id, playlists!inner(id)")
  .eq("playlists.is_active", true);
console.log(`   Curateurs avec playlists actives : ${activeCurators?.length ?? "?"}`);

const { data: allCurators } = await sb.from("curators").select("id");
console.log(`   Curateurs total en DB : ${allCurators?.length ?? "?"}`);

console.log(`\n════════════════════════════════════════`);
console.log(`  Résultat : ${ok} OK / ${fail} erreur(s)`);
console.log(`════════════════════════════════════════\n`);
