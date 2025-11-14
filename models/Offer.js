// models/Offer.js — versão sem mongoose (compat transitória com Supabase)
const { supabase } = require("../lib/supabase");

const wrap = (row) => (row ? { ...row } : null);

function applyFilters(q, filter = {}) {
  if (filter.id) q = q.eq("id", filter.id);
  if (filter.is_active === true || filter.ativo === true) q = q.eq("is_active", true);
  if (filter.is_active === false || filter.ativo === false) q = q.eq("is_active", false);
  if (filter.title) q = q.ilike("title", `%${filter.title}%`);
  if (filter.name) q = q.ilike("title", `%${filter.name}%`);
  return q;
}

// Offer.find(filter)
async function find(filter = {}) {
  if (!supabase) return [];
  let q = supabase.from("offers").select("*").order("created_at", { ascending: false });
  q = applyFilters(q, filter);
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

// Offer.findOne(filter)
async function findOne(filter = {}) {
  const list = await find(filter);
  return wrap(list[0] || null);
}

// Offer.findById(id)
async function findById(id) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("offers").select("*").eq("id", id).maybeSingle();
  if (error) return null;
  return wrap(data);
}

// Offer.create(doc)
async function create(doc = {}) {
  if (!supabase) throw new Error("Supabase não configurado");
  const payload = {
    title: doc.title ?? doc.nome ?? "Sem título",
    description: doc.description ?? null,
    price: doc.price ?? doc.valor ?? 0,
    is_active: doc.is_active ?? doc.ativo ?? true,
    image_url: doc.image_url ?? doc.img ?? null,
    taxa: doc.taxa ?? null,
    temToken: doc.temToken ?? null,
    top: doc.top ?? null
  };
  const { data, error } = await supabase.from("offers").insert([payload]).select().maybeSingle();
  if (error) throw error;
  return wrap(data);
}

// Offer.updateById(id, patch)
async function updateById(id, patch = {}) {
  if (!supabase) throw new Error("Supabase não configurado");
  const payload = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.nome !== undefined) payload.title = patch.nome;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.price !== undefined) payload.price = patch.price;
  if (patch.valor !== undefined) payload.price = patch.valor;
  if (patch.is_active !== undefined) payload.is_active = patch.is_active;
  if (patch.ativo !== undefined) payload.is_active = patch.ativo;
  if (patch.image_url !== undefined) payload.image_url = patch.image_url;
  if (patch.img !== undefined) payload.image_url = patch.img;
  if (patch.taxa !== undefined) payload.taxa = patch.taxa;
  if (patch.temToken !== undefined) payload.temToken = patch.temToken;
  if (patch.top !== undefined) payload.top = patch.top;

  const { data, error } = await supabase.from("offers").update(payload).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return wrap(data);
}

// Offer.removeById(id)
async function removeById(id) {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase.from("offers").delete().eq("id", id);
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
