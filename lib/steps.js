const { supabase } = require("./supabase");

/* Próximo step_no da oferta */
async function nextStepNo(offerId) {
  const { data, error } = await supabase
    .from("offer_steps")
    .select("step_no")
    .eq("offer_id", offerId)
    .order("step_no", { ascending: false })
    .limit(1);
  if (error) return { error };
  const max = (data && data[0] && Number(data[0].step_no)) || 0;
  return { data: max + 1 };
}

/* Garante Etapa 1 se ainda não existir nenhuma */
async function ensureFirstStep(offerId) {
  const { data: existing, error: e0 } = await supabase
    .from("offer_steps")
    .select("id")
    .eq("offer_id", offerId)
    .limit(1);
  if (e0) return { error: e0 };
  if (existing && existing.length) return { data: existing[0] };

  const { data: n, error: e1 } = await nextStepNo(offerId);
  if (e1) return { error: e1 };

  const ins = await supabase
    .from("offer_steps")
    .insert([{
      offer_id: offerId,
      name: "Etapa 1",
      step_no: n || 1,
      settings: {},
      duplicated: false,
      duplicated_from: null
    }])
    .select("*")
    .single();

  if (ins.error) return { error: ins.error };
  return { data: ins.data };
}

/* SEMPRE INSERT (nunca sobrescreve) */
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

  const ins = await supabase
    .from("offer_steps")
    .insert([{
      offer_id: offerId,
      name: name || `Etapa ${n}`,
      step_no: n,
      settings,
      duplicated: !!duplicate,
      duplicated_from
    }])
    .select("*")
    .single();

  if (ins.error) return { error: ins.error };
  return { data: ins.data };
}

/* Utilidades (mantenha se já tiver iguais) */
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
