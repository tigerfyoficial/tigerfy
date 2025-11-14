// lib/supabase.js
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[supabase] SUPABASE_URL ou SUPABASE_ANON_KEY ausentes. Configure nas ENVs da Vercel."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // servidor: não persistimos sessão do supabase; usamos nosso cookie
    persistSession: false
  }
});

module.exports = { supabase };
