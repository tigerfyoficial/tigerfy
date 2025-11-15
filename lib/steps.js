// lib/steps.js
const { supabase } = require("./supabase");

/* --- leitura --- */
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

/* --- util interno --- */
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

/* --- garante Etapa 1 se vazio --- */
async function ensureFirstStep(offerId) {
  const { data, error } = await listSteps(offerId);
  if (error) return { error };
  if (data && data.length) return { data: data[0] };
  const { data: n } = await nextStepNo(offerId);
  const ins = await supabase.from("offer_steps").insert([{
    offer_id: offerId, owner: null, name: "Etapa 1", step_no: n || 1, settings: {}
  }]).select("*").single();
  if (ins.error) return { error: ins.error };
  return { data: ins.data };
}

/* --- createStep legado (sempre INSERT) --- */
async function createStep({ offerId, name, duplicate = false, fromStepId = null, ownerId = null }) {
  const { data: n, error: eN } = await nextStepNo(offerId);
  if (eN) return { error: eN };
  let settings = {};
  let duplicated_from = null;
  if (duplicate && fromStepId) {
    const { data: from, error: eF } = await supabase
      .from("offer_steps").select("id, settings")
      .eq("offer_id", offerId).eq("id", fromStepId).single();
    if (eF) return { error: eF };
    settings = from?.settings || {}; duplicated_from = from?.id || null;
  }
  const row = {
    offer_id: offerId, owner: ownerId, name: name || `Etapa ${n}`, step_no: n,
    settings, duplicated_from
  };
  let ins = await supabase.from("offer_steps").insert([row]).select("*").single();
  if (ins.error && ins.error.code === "23505") {
    const { data: fresh } = await nextStepNo(offerId);
    row.step_no = fresh; ins = await supabase.from("offer_steps").insert([row]).select("*").single();
  }
  if (ins.error) return { error: ins.error };
  return { data: ins.data };
}

/* --- helper único enxuto --- */
async function mutateStep({ mode, offerId, ownerId, stepId, name, fromStepId, payloadConfig }) {
  if (mode === "update") {
    const patch = {};
    if (name) patch.name = name;
    if (payloadConfig && typeof payloadConfig === "object") patch.settings = payloadConfig;
    patch.updated_at = new Date().toISOString();
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
  // create / duplicate → sempre INSERT
  return createStep({
    offerId,
    ownerId,
    name,
    duplicate: mode === "duplicateFromCurrent",
    fromStepId: mode === "duplicateFromCurrent" ? fromStepId : null,
  });
}

module.exports = {
  getOfferByIdForOwner,
  listSteps,
  getStepById,
  ensureFirstStep,
  createStep,    // legado
  mutateStep,    // novo helper único
};
