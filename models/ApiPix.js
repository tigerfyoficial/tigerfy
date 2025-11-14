// models/ApiPix.js — versão sem mongoose (compat transitória com Supabase)
const { supabase } = require("../lib/supabase");

const wrap = (row) => (row ? { ...row } : null);

function applyFilters(q, filter = {}) {
  if (filter.id) q = q.eq("id", filter.id);
  if (filter.is_active === true || filter.ativo === true) q = q.eq("is_active", true);
  if (filter.is_active === false || filter.ativo === false) q = q.eq("is_active", false);
  if (filter.name) q = q.ilike("name", `%${filter.name}%`);
  if (filter.provider) q = q.ilike("provider", `%${filter.provider}%`);
  return q;
}

// Lista configs
async function find(filter = {}) {
  if (!supabase) return [];
  let q = supabase.from("api_pix").select("*").order("created_at", { ascending: false });
  q = applyFilters(q, filter);
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

// Uma config
async function findOne(filter = {}) {
  const list = await find(filter);
  return wrap(list[0] || null);
}

// Por id
async function findById(id) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("api_pix")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return wrap(data);
}

// Criar config
async function create(doc = {}) {
  if (!supabase) throw new Error("Supabase não configurado");
  const payload = {
    name: doc.name ?? doc.nome ?? "Sem nome",
    provider: doc.provider ?? doc.provedor ?? null, // ex: 'WiinPay', 'ParadisePag'
    token: doc.token ?? doc.apiKey ?? doc.chave ?? null,
    webhook_secret: doc.webhook_secret ?? doc.webhookSecret ?? null,
    endpoint: doc.endpoint ?? null,
    is_active: doc.is_active ?? doc.ativo ?? true,
    extra: doc.extra ?? null // JSON livre (se a tabela permitir jsonb)
  };
  const { data, error } = await supabase
    .from("api_pix")
    .insert([payload])
    .select()
    .maybeSingle();
  if (error) throw error;
  return wrap(data);
}

// Atualizar por id
async function updateById(id, patch = {}) {
  if (!supabase) throw new Error("Supabase não configurado");
  const payload = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.nome !== undefined) payload.name = patch.nome;
  if (patch.provider !== undefined) payload.provider = patch.provider;
  if (patch.provedor !== undefined) payload.provider = patch.provedor;
  if (patch.token !== undefined) payload.token = patch.token;
  if (patch.apiKey !== undefined) payload.token = patch.apiKey;
  if (patch.chave !== undefined) payload.token = patch.chave;
  if (patch.webhook_secret !== undefined) payload.webhook_secret = patch.webhook_secret;
  if (patch.webhookSecret !== undefined) payload.webhook_secret = patch.webhookSecret;
  if (patch.endpoint !== undefined) payload.endpoint = patch.endpoint;
  if (patch.is_active !== undefined) payload.is_active = patch.is_active;
  if (patch.ativo !== undefined) payload.is_active = patch.ativo;
  if (patch.extra !== undefined) payload.extra = patch.extra;

  const { data, error } = await supabase
    .from("api_pix")
    .update(payload)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return wrap(data);
}

// Remover
async function removeById(id) {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase.from("api_pix").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

// Upsert por nome (conveniência para telas simples)
async function upsertByName(name, patch = {}) {
  if (!supabase) throw new Error("Supabase não configurado");
  // tenta pegar existente
  const existing = await findOne({ name });
  if (!existing) {
    return create({ name, ...patch });
  }
  return updateById(existing.id, patch);
}

module.exports = {
  find,
  findOne,
  findById,
  create,
  updateById,
  removeById,
  upsertByName,
};
