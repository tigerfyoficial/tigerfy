let supabase = null;
try {
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (url && key) supabase = createClient(url, key);
} catch (e) {
  // pacote não instalado ou sem env — segue em memória
}
module.exports = { supabase };
