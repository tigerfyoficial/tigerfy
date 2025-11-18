// lib/supabase.js
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("[supabase] SUPABASE_URL ou SUPABASE_ANON_KEY ausentes.");
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,      // SSR: não tentamos manter sessão no cliente
    autoRefreshToken: false,    // SSR: não há token refresh do lado do browser
  },
});

module.exports = { supabase };
