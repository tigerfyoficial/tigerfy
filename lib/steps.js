// lib/steps.js
const { supabase } = require("./supabase");

/** Carrega oferta garantindo owner */
async function getOfferByIdForOwner(offerId, ownerId) {
  const { data, error } = await supabase
    .from("offers")
    .select("id, owner, name, bot_type, tracking_type, status, telegram_username, bot_token, created_at")
    .eq("id", offerId)
    .eq("owner", ownerId)
    .single();
  if (error || !data) return { error: error || new Error("not_found") };
  return { data };
}

/** Lista steps de uma oferta (ordenados) */
async function listSteps(offerId) {
  const { data, error } = await supabase
    .from("offer_steps")
    .select("*")
    .eq("offer_id", offerId)
    .order("step_no", { ascending: true });
  if (error) return { error };
  return { data };
}

/** Retorna próximo step_no (1 se vazio) */
async function getNextStepNo(offerId) {
  const { data, error } = await supabase
    .from("offer_steps")
    .select("step_no")
    .eq("offer_id", offerId)
    .order("step_no", { ascending: false })
    .limit(1);
  if (error) return { error };
  const next = data && data.length ? Number(data[0].step_no) + 1 : 1;
  return { data: next };
}

/** Garante a Etapa 1 se não existir nenhuma */
async function ensureFirstStep(offerId) {
  const { data, error } = await supabase
    .from("offer_steps")
    .select("id")
    .eq("offer_id", offerId)
    .limit(1);
  if (error) return { error };
  if (data && data.length) return { data: null };

  const insert = {
    offer_id: offerId,
    name: "Etapa 1",
    step_no: 1,
    duplicated: false,
    settings: {},
  };
  const { data: created, error: insErr } = await supabase
    .from("offer_steps")
    .insert([insert])
    .select("*")
    .single();
  if (insErr) return { error: insErr };
  return { data: created };
}

/** Cria step (zero ou duplicado) — nunca sobrescreve */
async function createStep({ offerId, name, duplicate = false, fromStepId = null }) {
  const { data: nextNo, error: nextErr } = await getNextStepNo(offerId);
  if (nextErr) return { error: nextErr };

  let settings = {};
  let duplicated_from = null;

  if (duplicate && fromStepId) {
    // Carrega settings do step origem (apenas configs; nunca relatórios)
    const { data: from, error: fromErr } = await supabase
      .from("offer_steps")
      .select("id, settings")
      .eq("offer_id", offerId)
      .eq("id", fromStepId)
      .single();
    if (fromErr) return { error: fromErr };
    settings = from?.settings || {};
    duplicated_from = from.id;
  }

  const payload = {
    offer_id: offerId,
    name: (name || "").trim() || `Etapa ${nextNo}`,
    step_no: nextNo,
    duplicated: !!duplicate,
    duplicated_from,
    settings,
  };

  const { data: created, error: insErr } = await supabase
    .from("offer_steps")
    .insert([payload])
    .select("*")
    .single();

  if (insErr) return { error: insErr };
  return { data: created };
}

/** Atualiza settings (ou nome) do step */
async function updateStep({ offerId, stepId, name, settings }) {
  const patch = { updated_at: new Date().toISOString() };
  if (typeof name === "string") patch.name = name;
  if (settings && typeof settings === "object") patch.settings = settings;

  const { data, error } = await supabase
    .from("offer_steps")
    .update(patch)
    .eq("offer_id", offerId)
    .eq("id", stepId)
    .select("*")
    .single();

  if (error) return { error };
  return { data };
}

/** Busca step específico por id garantindo offer */
async function getStepById({ offerId, stepId }) {
  const { data, error } = await supabase
    .from("offer_steps")
    .select("*")
    .eq("offer_id", offerId)
    .eq("id", stepId)
    .single();
  if (error) return { error };
  return { data };
}

module.exports = {
  getOfferByIdForOwner,
  listSteps,
  getNextStepNo,
  ensureFirstStep,
  createStep,
  updateStep,
  getStepById,
};
