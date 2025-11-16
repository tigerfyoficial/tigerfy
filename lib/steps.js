// lib/steps.js
const { supabase } = require("./supabase");

/* --------- helpers internos --------- */
function isPgUniqueViolation(err) {
  if (!err) return false;
  return err.code === "23505" || /duplicate key value/i.test(String(err.message || ""));
}

/* Pega o próximo step_no da oferta (max(step_no)+1) */
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

/* Cria uma etapa com número específico (uso interno) */
async function _insertStep({ offerId, name, stepNo, settings = {}, duplicated = false, duplicated_from = null }) {
  return await supabase
    .from("offer_steps")
    .insert([
      {
        offer_id: offerId,
        name: name || `Etapa ${stepNo}`,
        step_no: stepNo,
        settings,
        duplicated: !!duplicated,
        duplicated_from
      }
    ])
    .select("*")
    .single();
}

/* --------- API pública usada nas rotas --------- */

/* Garante Etapa 1 se ainda não existir nenhuma */
async function ensureFirstStep(offerId) {
  // já existe alguma?
  const { data: existing, error: e0 } = await supabase
    .from("offer_steps")
    .select("id")
    .eq("offer_id", offerId)
    .limit(1);
  if (e0) return { error: e0 };
  if (existing && existing.length) return { data: existing[0] };

  // cria Etapa 1
  const ins = await _insertStep({ offerId, name: "Etapa 1", stepNo: 1, settings: {}, duplicated: false, duplicated_from: null });

  // se bater colisão (raro), tenta com o próximo número
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

/* SEMPRE INSERT (nunca sobrescreve) */
async function createStep({ offerId, name, duplicate = false, fromStepId = null }) {
  // calcula próximo número
  const { data: n, error: eN } = await nextStepNo(offerId);
  if (eN) return { error: eN };

  let settings = {};
  let duplicated_from = null;

  // copiar configs da etapa atual, se solicitado
  if (duplicate && fromStepId) {
    const { data: from, error: eF } = await supabase
      .from("offer_steps")
      .select("id, settings")
      .eq("offer_id", offerId)
      .eq("id", fromStepId)
      .single();
    if (eF) return { error: eF };
    settings = (from && from.settings) ? from.settings : {};
    duplicated_from = from ? from.id : null;
  }

  // tenta inserir com o número calculado
  let ins = await _insertStep({
    offerId,
    name: name || `Etapa ${n}`,
    stepNo: n,
    settings,
    duplicated: !!duplicate,
    duplicated_from
  });

  // se colidir (ex.: índice único + concorrência), recalcula e tenta 1x
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

/* Utilidades */
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

async function updateStep({ offerId, stepId, name, settings }) {
  const patch = {};
  if (typeof name === "string") patch.name = name;
  if (settings && typeof settings === "object") patch.settings = settings;

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
