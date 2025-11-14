// models/Admin.js — versão sem mongoose (compat transitória)
// Usa Supabase quando disponível e mantém uma API parecida com mongoose.findOne()

const { supabase } = require("../lib/supabase");

// helper: adapta retorno para parecer um doc
const wrap = (row) => (row ? { ...row } : null);

async function findByEmail(email) {
  if (!supabase) return null; // ainda sem chaves na Vercel
  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) return null;
  return wrap(data);
}

// compat com código legado: Admin.findOne({ email })
async function findOne(query = {}) {
  if (query.email) {
    return findByEmail(query.email);
  }
  return null;
}

async function create({ email, password_hash, role = "admin" }) {
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("admins")
    .insert([{ email, password_hash, role }])
    .select()
    .maybeSingle();

  if (error) throw error;
  return wrap(data);
}

async function updateLastLogin(id) {
  if (!supabase) return;
  await supabase.from("admins").update({ last_login: new Date().toISOString() }).eq("id", id);
}

module.exports = {
  findByEmail,
  findOne,       // compat com mongoose.findOne
  create,
  updateLastLogin,
};
