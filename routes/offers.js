// routes/offers.js
const express = require("express");
const router = express.Router();

const authGuard = require("../middleware/authGuard");
const { supabase } = require("../lib/supabase");
const Steps = require("../lib/steps");

/* ---------- Mappers ---------- */
function mapOffer(row) {
  return {
    _id: row.id,
    id: row.id,
    owner: row.owner,
    name: row.name,
    botType: row.bot_type,
    trackingType: row.tracking_type,
    status: row.status,
    telegramUsername: row.telegram_username || null,
    botToken: row.bot_token || null,
    createdAt: row.created_at,
  };
}
function mapStep(row) {
  return {
    id: row.id,
    offerId: row.offer_id,
    name: row.name,
    stepNo: row.step_no,
    duplicated: row.duplicated,
    duplicatedFrom: row.duplicated_from || null,
    settings: row.settings || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ---------- /ofertas (lista) ---------- */
router.get("/ofertas", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { data, error } = await supabase
      .from("offers")
      .select("id, owner, name, bot_type, tracking_type, status, telegram_username, bot_token, created_at")
      .eq("owner", owner)
      .order("created_at", { ascending: false });

    if (error) console.warn("[ofertas] select error:", error.message);
    const offers = (data || []).map(mapOffer);

    return res.render("offers_list", {
      title: "Minhas Ofertas - TigerFy",
      offers,
      active: "ofertas",
    });
  } catch (err) {
    console.error("Erro carregar ofertas:", err);
    return res.render("offers_list", {
      title: "Minhas Ofertas - TigerFy",
      offers: [],
      active: "ofertas",
    });
  }
});

/* ---------- Criar oferta (GET/POST) ---------- */
router.get("/ofertas/criar", authGuard, (_req, res) => {
  return res.render("bots_create", { title: "Criar Oferta - TigerFy", active: "ofertas" });
});

router.post("/ofertas/criar", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { name, botType, trackingType } = req.body;

    const payload = {
      owner,
      name: name || "",
      bot_type: botType || "bot_padrao",
      tracking_type: trackingType || "fb_pixel",
      status: "incompleto",
    };

    const { data, error } = await supabase
      .from("offers")
      .insert([payload])
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("[ofertas] insert error:", error?.message);
      return res.redirect("/ofertas");
    }

    return res.redirect(`/ofertas/painel/${data.id}`);
  } catch (err) {
    console.error("Erro criar oferta:", err);
    return res.redirect("/ofertas");
  }
});

/* ---------- Compat: /ofertas/gerenciar → painel ---------- */
router.get("/ofertas/gerenciar", authGuard, (req, res) => {
  const id = req.query.id;
  if (!id) return res.redirect("/ofertas");
  return res.redirect(`/ofertas/painel/${id}`);
});

/* ---------- Painel da oferta ---------- */
router.get("/ofertas/painel/:id", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;
    const stepId = req.query.stepId || null;
    const etapaNum = req.query.etapa ? parseInt(req.query.etapa, 10) : null;

    // Oferta do usuário
    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) return res.redirect("/ofertas");
    const offer = mapOffer(offerRes.data);

    // Garante Etapa 1
    if (typeof Steps.ensureFirstStep === "function") {
      await Steps.ensureFirstStep(offer.id);
    }

    // Todas as etapas
    const stepsRes = await Steps.listSteps(offer.id);
    const steps = (stepsRes.data || []).map(mapStep);

    // Etapa atual (prioriza filtro por stepId + offerId)
    let currentStep = null;
    if (stepId) {
      const got = await Steps.getStepById({ offerId: offer.id, stepId });
      if (!got.error && got.data) currentStep = mapStep(got.data);
    } else if (etapaNum && !isNaN(etapaNum)) {
      currentStep = steps.find(s => s.stepNo === etapaNum) || null;
    }
    if (!currentStep) currentStep = steps.length ? steps[0] : null;

    return res.render("offer_panel", {
      title: `${offer.name} — Painel da Oferta - TigerFy`,
      offer,
      steps,
      currentStep,
      active: "ofertas",
    });
  } catch (err) {
    console.error("Erro painel:", err);
    return res.redirect("/ofertas");
  }
});

/* ---------- Criar etapa (sempre INSERT, nunca sobrescreve) ---------- */
router.post("/ofertas/:id/etapas", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;
    const { name, duplicate, fromStepId } = req.body || {};

    // Confere owner da oferta
    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    // Usa mutateStep se existir; senão, createStep
    const fn = typeof Steps.mutateStep === "function" ? Steps.mutateStep : Steps.createStep;
    const params = (fn === Steps.mutateStep)
      ? {
          mode: duplicate ? "duplicateFromCurrent" : "createFromScratch",
          offerId,
          ownerId: owner,
          name: (name || "").trim(),
          fromStepId: duplicate ? (fromStepId || null) : null
        }
      : {
          offerId,
          name: (name || "").trim(),
          duplicate: !!duplicate,
          fromStepId: duplicate ? (fromStepId || null) : null
        };

    const created = await fn(params);
    if (created.error || !created.data) {
      console.error("[steps] insert error:", created.error);
      return res.status(500).json({ ok: false, error: "insert_failed" });
    }

    return res.json({ ok: true, step: mapStep(created.data) });
  } catch (err) {
    console.error("Erro criar etapa:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* ---------- Salvar alterações da etapa (PATCH canônico) ---------- */
router.patch("/ofertas/:id/etapas/:stepId", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId, stepId } = req.params;
    const { name, settings } = req.body || {};

    // Confere owner da oferta
    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    // Confere step pertence à oferta
    const stepRes = await Steps.getStepById({ offerId, stepId });
    if (stepRes.error || !stepRes.data) {
      return res.status(404).json({ ok: false, error: "step_not_found" });
    }

    // Atualiza via mutateStep se existir; senão, updateStep
    let updRes;
    if (typeof Steps.mutateStep === "function") {
      updRes = await Steps.mutateStep({
        mode: "update",
        offerId,
        ownerId: owner,
        stepId,
        name: typeof name === "string" ? name : undefined,
        payloadConfig: settings && typeof settings === "object" ? settings : undefined,
      });
    } else {
      updRes = await Steps.updateStep({
        offerId,
        stepId,
        name: typeof name === "string" ? name : undefined,
        settings: settings && typeof settings === "object" ? settings : undefined,
      });
    }

    if (updRes.error || !updRes.data) {
      console.error("[steps] update error:", updRes.error?.message || updRes.error);
      return res.status(500).json({ ok: false, error: "update_failed" });
    }

    return res.json({ ok: true, step: mapStep(updRes.data) });
  } catch (err) {
    console.error("Erro salvar etapa (PATCH):", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// ➕ ADICIONE abaixo das outras rotas de etapas
router.delete("/ofertas/:id/etapas/:stepId", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId, stepId } = req.params;

    // valida dono
    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    // deleta
    const del = await Steps.deleteStep({ offerId, stepId });
    if (del.error) {
      const msg = (del.error && del.error.message) || "delete_failed";
      return res.status(400).json({ ok: false, error: msg });
    }

    // devolve a lista atualizada
    const list = await Steps.listSteps(offerId);
    const steps = (list.data || []).map(s => ({
      id: s.id,
      offerId: s.offer_id,
      name: s.name,
      stepNo: s.step_no,
      createdAt: s.created_at,
    }));

    return res.json({ ok: true, steps });
  } catch (err) {
    console.error("Erro delete step:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// EXCLUIR ETAPA — com proteção para Etapa 1
router.post("/ofertas/:id/etapas/:stepId/delete", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId, stepId } = req.params;

    // Confere owner da oferta
    const gotOffer = await Steps.getOfferByIdForOwner(offerId, owner);
    if (gotOffer.error || !gotOffer.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const del = await Steps.deleteStep({ offerId, stepId });
    if (del.error) {
      if (String(del.error.message||'').includes('cannot_delete_first_step')) {
        return res.status(400).json({ ok:false, error:"cannot_delete_first_step" });
      }
      console.error("[steps] delete error:", del.error);
      return res.status(500).json({ ok:false, error:"delete_failed" });
    }
    return res.json({ ok:true, id: stepId });
  } catch (err) {
    console.error("Erro excluir etapa:", err);
    return res.status(500).json({ ok:false, error:"server_error" });
  }
});


/* ---------- Salvar alterações (compat: POST /save) ---------- */
router.post("/ofertas/:id/etapas/:stepId/save", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId, stepId } = req.params;
    const { name, settings } = req.body || {};

    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const stepRes = await Steps.getStepById({ offerId, stepId });
    if (stepRes.error || !stepRes.data) {
      return res.status(404).json({ ok: false, error: "step_not_found" });
    }

    const updRes = await Steps.updateStep({
      offerId,
      stepId,
      name: typeof name === "string" ? name : undefined,
      settings: settings && typeof settings === "object" ? settings : undefined,
    });

    if (updRes.error || !updRes.data) {
      console.error("[steps] update error:", updRes.error?.message || updRes.error);
      return res.status(500).json({ ok: false, error: "update_failed" });
    }

    return res.json({ ok: true, step: mapStep(updRes.data) });
  } catch (err) {
    console.error("Erro salvar etapa (POST /save):", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* ---------- Salvar token (inalterado) ---------- */
router.post("/ofertas/:id/token", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;
    const { botToken, telegramUsername } = req.body;

    const { data: exists, error: getErr } = await supabase
      .from("offers")
      .select("id, owner")
      .eq("id", id)
      .eq("owner", owner)
      .single();

    if (getErr || !exists) return res.redirect("/ofertas");

    const newStatus = botToken ? "ativo" : "incompleto";
    await supabase
      .from("offers")
      .update({
        bot_token: botToken || null,
        telegram_username: telegramUsername || null,
        status: newStatus,
      })
      .eq("id", id)
      .eq("owner", owner);

    return res.redirect(`/ofertas/painel/${id}`);
  } catch (err) {
    console.error("Erro salvar token:", err);
    return res.redirect("/ofertas");
  }
});

module.exports = router;
