// models/Plan.js — versão sem mongoose (compat com Supabase)
const { supabase } = require("../lib/supabase");

const wrap = (row) => (row ? { ...row } : null);

// aplica filtros simples usados no código legado
function applyFilters(q, filter = {}) {
  if (filter.ativo === true || filter.is_active === true) q = q.eq("is_active", true);
  if (filter.ativo === false || filter.is_active === false) q = q.eq("is_active", false);
  if (filter.id) q = q.eq("id", filter.id);
  if (filter.name) q = q.ilike("name", `%${filter.name}%`);
  return q;
}

// Plan.find(filter)
async function find(filter = {}) {
  if (!supabase) return [];
  let q = supabase.from("plans").select("*").order("created_at", { ascending: false });
  q = applyFilters(q, filter);
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

// Plan.findOne(filter)
async function findOne(filter = {}) {
  const list = await find(filter);
  return wrap(list[0] || null);
}

// Plan.findById(id)
async function findById(id) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("plans").select("*").eq("id", id).maybeSingle();
  if (error) return null;
  return wrap(data);
}

// Plan.create(doc)
async function create(doc = {}) {
  if (!supabase) throw new Error("Supabase não configurado");
  const payload = {
    name: doc.name ?? doc.titulo ?? "Sem nome",
    price: doc.price ?? doc.valor ?? 0,
    is_active: doc.is_active ?? doc.ativo ?? true,
    description: doc.description ?? null,
  };
  const { data, error } = await supabase.from("plans").insert([payload]).select().maybeSingle();
  if (error) throw error;
  return wrap(data);
}

// Plan.updateById(id, patch)
async function updateById(id, patch = {}) {
  if (!supabase) throw new Error("Supabase não configurado");
  const payload = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.titulo !== undefined) payload.name = patch.titulo;
  if (patch.price !== undefined) payload.price = patch.price;
  if (patch.valor !== undefined) payload.price = patch.valor;
  if (patch.is_active !== undefined) payload.is_active = patch.is_active;
  if (patch.ativo !== undefined) payload.is_active = patch.ativo;
  if (patch.description !== undefined) payload.description = patch.description;

  const { data, error } = await supabase.from("plans").update(payload).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return wrap(data);
}

// Plan.removeById(id)
async function removeById(id) {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

module.exports = {
  find,
  findOne,
  findById,
  create,
  updateById,
  removeById,
};
