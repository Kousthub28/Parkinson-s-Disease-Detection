// Simple script to apply Supabase migration
// Run with: node apply-migration.js

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // You need the service role key for this

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  try {
    console.log('📦 Reading migration file...');
    const migrationSQL = readFileSync(
      join(__dirname, 'supabase', 'migrations', '0002_add_appointments_table.sql'),
      'utf8'
    );

    console.log('🚀 Applying migration...');
    
    // Note: This requires the service role key and direct database access
    // For production, use Supabase Dashboard SQL Editor instead
    console.log('\n⚠️  This script requires the Supabase Service Role Key.');
    console.log('For security reasons, it\'s recommended to apply migrations via:');
    console.log('1. Supabase Dashboard → SQL Editor');
    console.log('2. Copy the SQL from supabase/migrations/0002_add_appointments_table.sql');
    console.log('3. Run it there\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

applyMigration();
