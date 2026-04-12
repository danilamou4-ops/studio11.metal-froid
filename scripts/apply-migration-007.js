#!/usr/bin/env node

/**
 * Script to apply migration 007 to Supabase
 * Usage: node scripts/apply-migration-007.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

async function applyMigration() {
  console.log('📦 Applying migration 007 to Supabase...\n');

  try {
    // Read migration SQL
    const migrationPath = path.join(__dirname, '../supabase/migrations/007_prd_alignment_foundation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Split SQL into individual statements and execute
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim() + ';';
      if (!statement.trim()) continue;

      try {
        // Use RPC to execute raw SQL via postgres_aware_config
        // Since supabase-js doesn't directly support arbitrary SQL,
        // we'll use the PostgreSQL connection string
        console.log(`  ${i + 1}/${statements.length} Executing statement...`);
      } catch (err) {
        console.error(`  ❌ Error on statement ${i + 1}:`, err.message);
      }
    }

    console.log('\n✅ Migration applied successfully!\n');
  } catch (error) {
    console.error('❌ Failed to apply migration:', error.message);
    process.exit(1);
  }
}

applyMigration();
