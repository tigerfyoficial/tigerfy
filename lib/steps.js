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
  const { data: existing, error: e0 } = await supabase
    .from("offer_steps")
    .select("id")
    .eq("offer_id", offerId)
    .limit(1);
  if (e0) return { error: e0 };
  if (existing && existing.length) return { data: existing[0] };

  const ins = await _insertStep({
    offerId,
    name: "Etapa 1",
    stepNo: 1,
    settings: {},
    duplicated: false,
    duplicated_from: null
  });

  if (ins.error && isPgUniqueViolation(ins.error)) {
    const { data: n2, error: eN2 } = await nextStepNo(offerId);
    if (eN2) return { error: eN2 };
    const retry = await _insertStep({
      offerId,
      name: "Etapa 1",
      stepNo: n2 || 1,
      settings: {}
    });
    if (retry.error) return { error: retry.error };
    return { data: retry.data };
  }

  if (ins.error) return { error: ins.error };
  return { data: ins.data };
}

/* SEMPRE INSERT (nunca sobrescreve) */
async function createStep({ offerId, name, duplicate = false, fromStepId = null }) {
  const { data: n, error: eN } = await nextStepNo(offerId);
  if (eN) return { error: eN };

  let settings = {};
  let duplicated_from = null;

  // compat: copiar configs se solicitado (UI atual não usa duplicar)
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

/* Renomear etapa */
async function renameStep({ offerId, stepId, name }) {
  const { data, error } = await supabase
    .from("offer_steps")
    .update({ name })
    .eq("id", stepId)
    .eq("offer_id", offerId)
    .select("*")
    .single();
  if (error) return { error };
  return { data };
}

/* Excluir etapa (protege Etapa 1) + recompacta numeração 1..n */
async function deleteStep({ offerId, stepId }) {
  const { data: cur, error: e0 } = await supabase
    .from("offer_steps")
    .select("id, step_no")
    .eq("id", stepId)
    .eq("offer_id", offerId)
    .single();
  if (e0) return { error: e0 };
  if (!cur) return { error: new Error("not_found") };
  if (Number(cur.step_no) === 1) return { error: new Error("cannot_delete_first_step") };

  const del = await supabase
    .from("offer_steps")
    .delete()
    .eq("id", stepId)
    .eq("offer_id", offerId);
  if (del.error) return { error: del.error };

  // Reindexar restante: step_no = 1..n na ordem atual
  const { data: rest, error: e1 } = await supabase
    .from("offer_steps")
    .select("id")
    .eq("offer_id", offerId)
    .order("step_no", { ascending: true })
    .order("created_at", { ascending: true });
  if (e1) return { error: e1 };

  for (let i = 0; i < rest.length; i++) {
    const id = rest[i].id;
    const u = await supabase
      .from("offer_steps")
      .update({ step_no: i + 1 })
      .eq("id", id)
      .eq("offer_id", offerId);
    if (u.error) return { error: u.error };
  }

  return { data: { id: stepId } };
}

/* Reordenar etapas: order = [stepId1, stepId2, ...] => step_no = 1..n */
async function reorderSteps({ offerId, order }) {
  if (!Array.isArray(order) || !order.length) return { error: new Error("invalid_order") };

  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const u = await supabase
      .from("offer_steps")
      .update({ step_no: i + 1 })
      .eq("id", id)
      .eq("offer_id", offerId);
    if (u.error) return { error: u.error };
  }
  return { data: { ok: true } };
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
  renameStep,
  deleteStep,
  reorderSteps,
  getOfferByIdForOwner,
  listSteps,
  getStepById,
  updateStep
};
