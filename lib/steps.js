// lib/steps.js
const { supabase } = require("./supabase");

/* --- helpers internos --- */
function isPgUniqueViolation(err) {
  if (!err) return false;
  return err.code === "23505" || /duplicate key value/i.test(String(err.message || ""));
}
function coerceSettings(val) {
  if (!val) return undefined;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      const o = JSON.parse(val);
      return o && typeof o === "object" ? o : undefined;
    } catch (_) {
      return undefined;
    }
  }
  return undefined;
}

/* Próximo step_no da oferta (max+1) */
async function nextStepNo(offerId) {
  const { data, error } = await supabase
    .from("offer_steps")
    .select("step_no, created_at")
    .eq("offer_id", offerId)
    .order("step_no", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return { error };
  const max = (data && data[0] && Number(data[0].step_no)) || 0;
  return { data: max + 1 };
}

/* Inserção com stepNo específico */
async function _insertStep({ offerId, name, stepNo, settings = {}, duplicated = false, duplicated_from = null }) {
  return await supabase
    .from("offer_steps")
    .insert([{
      offer_id: offerId,
      name: name || `Etapa ${stepNo}`,
      step_no: stepNo,
      settings,
      duplicated: !!duplicated,
      duplicated_from
    }])
    .select("*")
    .single();
}

/* Mantida para compatibilidade (não é mais chamada automaticamente no painel) */
async function ensureFirstStep(offerId) {
  const { data: existing, error: e0 } = await supabase
    .from("offer_steps")
    .select("id")
    .eq("offer_id", offerId)
    .limit(1);
  if (e0) return { error: e0 };
  if (existing && existing.length) return { data: existing[0] };

  const ins = await _insertStep({ offerId, name: "Etapa 1", stepNo: 1, settings: {}, duplicated: false, duplicated_from: null });
  if (ins.error && isPgUniqueViolation(ins.error)) {
    const { data: n2, error: eN2 } = await nextStepNo(offerId);
    if (eN2) return { error: eN2 };
    const retry = await _insertStep({ offerId, name: "Etapa 1", stepNo: n2 || 1, settings: {} });
    if (retry.error) return { error: retry.error };
    return { data: retry.data };
  }
  if (ins.error) return { error: ins.error };
  return { data: ins.data };
}

/* SEMPRE cria nova etapa (nunca sobrescreve) */
async function createStep({ offerId, name, duplicate = false, fromStepId = null }) {
  const { data: n, error: eN } = await nextStepNo(offerId);
  if (eN) return { error: eN };

  let settings = {};
  let duplicated_from = null;

  if (duplicate && fromStepId) {
    const { data: from, error: eF } = await supabase
      .from("offer_steps")
      .select("id, settings")
      .eq("offer_id", offerId)
      .eq("id", fromStepId)
      .single();
    if (eF) return { error: eF };
    settings = from?.settings || {};
    duplicated_from = from?.id || null;
  }

  let ins = await _insertStep({
    offerId,
    name: name || `Etapa ${n}`,
    stepNo: n,
    settings,
    duplicated: !!duplicate,
    duplicated_from
  });

  if (ins.error && isPgUniqueViolation(ins.error)) {
    const { data: n2, error: eN2 } = await nextStepNo(offerId);
    if (eN2) return { error: eN2 };
    ins = await _insertStep({
      offerId,
      name: name || `Etapa ${n2}`,
      stepNo: n2,
      settings,
      duplicated: !!duplicate,
      duplicated_from
    });
  }

  if (ins.error) return { error: ins.error };
  return { data: ins.data };
}

/* Utils */
async function getOfferByIdForOwner(offerId, ownerId) {
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .eq("owner", ownerId)
    .single();
  if (error || !data) return { error: error || new Error("not_found") };
  return { data };
}

async function listSteps(offerId) {
  const { data, error } = await supabase
    .from("offer_steps")
    .select("*")
    .eq("offer_id", offerId)
    .order("step_no", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { error };
  return { data: data || [] };
}

async function getStepById({ offerId, stepId }) {
  const { data, error } = await supabase
    .from("offer_steps")
    .select("*")
    .eq("id", stepId)
    .eq("offer_id", offerId)
    .single();
  if (error) return { error };
  return { data };
}

/* ⚠️ AQUI ESTÁ A CORREÇÃO: se patch ficar vazio, não faz UPDATE */
async function updateStep({ offerId, stepId, name, settings }) {
  const patch = {};
  if (typeof name === "string" && name.trim() !== "") patch.name = name.trim();
  const parsed = coerceSettings(settings);
  if (parsed) patch.settings = parsed;

  // Nada pra atualizar? Só retorna o registro atual como sucesso.
  if (Object.keys(patch).length === 0) {
    const { data, error } = await supabase
      .from("offer_steps")
      .select("*")
      .eq("id", stepId)
      .eq("offer_id", offerId)
      .single();
    if (error) return { error };
    return { data };
  }

  const { data, error } = await supabase
    .from("offer_steps")
    .update(patch)
    .eq("id", stepId)
    .eq("offer_id", offerId)
    .select("*")
    .single();

  if (error) return { error };
  return { data };
}

module.exports = {
  nextStepNo,
  ensureFirstStep,
  createStep,
  getOfferByIdForOwner,
  listSteps,
  getStepById,
  updateStep
};
