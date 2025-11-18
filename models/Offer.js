// models/Offer.js
// Versão Supabase do antigo Offer (Mongoose).
// Mantém os mesmos campos/validações por código e uma API simples.

const { supabase } = require("../lib/supabase");

const TABLE = "offers";

const ENUMS = {
  botType: ["bot_padrao", "bot_fluxo_wiin", "bot_fluxo_manychat"],
  trackingType: ["fb_pixel", "utmify_utmify_pixel", "utmify_fb_pixel", "track_proprio"],
  status: ["incompleto", "ativo", "erro"],
};

function assertEnum(field, value, allowed) {
  if (value == null) return; // permitido ficar null/undefined antes de defaults
  if (!allowed.includes(value)) {
    throw new Error(`Valor inválido para ${field}: "${value}". Permitidos: ${allowed.join(", ")}`);
  }
}

function applyDefaults(doc = {}) {
  const out = { ...doc };

  // defaults (equivalentes ao schema Mongoose)
  if (out.botType == null) out.botType = "bot_padrao";
  if (out.trackingType == null) out.trackingType = "fb_pixel";
  if (out.status == null) out.status = "incompleto";
  if (out.createdAt == null) out.createdAt = new Date().toISOString();

  // validações de required (equivalentes)
  if (!out.owner) throw new Error('Campo obrigatório "owner" ausente.');
  if (!out.name || String(out.name).trim() === "") throw new Error('Campo obrigatório "name" ausente.');

  // trims
  out.name = String(out.name).trim();

  // enums
  assertEnum("botType", out.botType, ENUMS.botType);
  assertEnum("trackingType", out.trackingType, ENUMS.trackingType);
  assertEnum("status", out.status, ENUMS.status);

  // campos opcionais padronizados
  if (out.botToken == null) out.botToken = null;
  if (out.telegramUsername == null) out.telegramUsername = null;

  return out;
}

function mapFilters(query = {}) {
  // Converte { campo: valor } para uma lista de filtros equality.
  // (Se precisar de operadores avançados depois, a gente expande.)
  return Object.entries(query).filter(([_, v]) => v !== undefined);
}

async function sbInsert(row) {
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return data;
}

async function sbSelect(filters = [], order = null) {
  let q = supabase.from(TABLE).select("*");
  for (const [k, v] of filters) q = q.eq(k, v);
  if (order && order.key) {
    // dir: 1 asc, -1 desc (compat mental)
    q = q.order(order.key, { ascending: (order.dir || 1) > 0 });
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function sbSelectOne(filters = []) {
  let q = supabase.from(TABLE).select("*");
  for (const [k, v] of filters) q = q.eq(k, v);
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function sbUpdateById(id, patch) {
  const { data, error } = await supabase.from(TABLE).update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function sbDeleteById(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

// API pública similar ao “modelo”
const Offer = {
  // cria uma oferta (equivalente ao mongoose.model('Offer').create)
  async create(doc) {
    if (!supabase) throw new Error("Supabase não inicializado (verifique SUPABASE_URL e KEY).");
    const row = applyDefaults(doc);
    return await sbInsert(row);
  },

  // retorna um item (ou null)
  async findOne(query = {}) {
    if (!supabase) throw new Error("Supabase não inicializado (verifique SUPABASE_URL e KEY).");
    const filters = mapFilters(query);
    return await sbSelectOne(filters);
  },

  // retorna um “query builder” minimalista com .sort() -> Promise<rows>
  find(query = {}) {
    if (!supabase) throw new Error("Supabase não inicializado (verifique SUPABASE_URL e KEY).");
    const filters = mapFilters(query);

    return {
      async sort(sortObj = {}) {
        // aceita ex.: { createdAt: -1 } ou { name: 1 }
        const [[key, dir]] = Object.entries(sortObj || { createdAt: -1 });
        const rows = await sbSelect(filters, { key, dir });
        return rows;
      },

      // se você usava .exec() no mongoose:
      async exec() {
        const rows = await sbSelect(filters, null);
        return rows;
      }
    };
  },

  // utilitários comuns
  async updateById(id, patch = {}) {
    if (!supabase) throw new Error("Supabase não inicializado (verifique SUPABASE_URL e KEY).");
    // valida e normaliza apenas se patch muda enums/required
    if ("botType" in patch) assertEnum("botType", patch.botType, ENUMS.botType);
    if ("trackingType" in patch) assertEnum("trackingType", patch.trackingType, ENUMS.trackingType);
    if ("status" in patch) assertEnum("status", patch.status, ENUMS.status);
    if ("name" in patch) patch.name = String(patch.name || "").trim();
    return await sbUpdateById(id, patch);
  },

  async deleteById(id) {
    if (!supabase) throw new Error("Supabase não inicializado (verifique SUPABASE_URL e KEY).");
    return await sbDeleteById(id);
  }
};

module.exports = Offer;
