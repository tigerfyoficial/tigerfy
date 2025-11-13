const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase: faltando SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY (ok por enquanto).');
}

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: { headers: { 'X-Client-Info': 'tigerfy-backend' } }
    })
  : null;

module.exports = { supabase };
