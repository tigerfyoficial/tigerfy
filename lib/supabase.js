// lib/supabase.js
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('[supabase] Faltando SUPABASE_URL ou SUPABASE_*_KEY nas ENVs.');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
  global: { headers: { 'X-Client-Info': 'tigerfy-server' } }
});

module.exports = { supabase };
