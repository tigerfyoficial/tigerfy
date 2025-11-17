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
// Painel da oferta — NÃO cria etapa automaticamente
router.get("/ofertas/painel/:id", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;
    const stepId = req.query.stepId || null;
    const etapaNum = req.query.etapa ? parseInt(req.query.etapa, 10) : null;

    // Confere se a oferta é do usuário
    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) return res.redirect("/ofertas");
    const offer = {
      _id: offerRes.data.id,
      id: offerRes.data.id,
      owner: offerRes.data.owner,
      name: offerRes.data.name,
      botType: offerRes.data.bot_type,
      trackingType: offerRes.data.tracking_type,
      status: offerRes.data.status,
      telegramUsername: offerRes.data.telegram_username || null,
      botToken: offerRes.data.bot_token || null,
      createdAt: offerRes.data.created_at,
    };

    // Carrega etapas (pode vir zerado)
    const stepsRes = await Steps.listSteps(offer.id);
    const steps = (stepsRes.data || []).map(s => ({
      id: s.id,
      offerId: s.offer_id,
      name: s.name,
      stepNo: s.step_no,
      duplicated: s.duplicated,
      duplicatedFrom: s.duplicated_from || null,
      settings: s.settings || {},
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    // Define etapa atual (se existir)
    let currentStep = null;
    if (stepId) {
      const got = await Steps.getStepById({ offerId: offer.id, stepId });
      if (!got.error && got.data) {
        currentStep = {
          id: got.data.id,
          offerId: got.data.offer_id,
          name: got.data.name,
          stepNo: got.data.step_no,
          duplicated: got.data.duplicated,
          duplicatedFrom: got.data.duplicated_from || null,
          settings: got.data.settings || {},
          createdAt: got.data.created_at,
          updatedAt: got.data.updated_at,
        };
      }
    } else if (etapaNum && !isNaN(etapaNum)) {
      currentStep = steps.find(s => s.stepNo === etapaNum) || null;
    }
    if (!currentStep && steps.length) currentStep = steps[0]; // se houver

    // Render: aceita 0 etapas de boa
    return res.render("offer_panel", {
      title: `${offer.name} — Painel da Oferta - TigerFy`,
      offer,
      steps,
      currentStep,            // pode ser null
      hasSteps: steps.length > 0, // útil se quiser no EJS (opcional)
      active: "ofertas",
    });
  } catch (err) {
    console.error("Erro painel:", err);
    return res.redirect("/ofertas");
  }
});

/* ---------- ETAPAS: CRIAR (sempre INSERT) ---------- */
router.post("/ofertas/:id/etapas", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;
    const { name, duplicate, fromStepId } = req.body || {};

    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const created = await Steps.createStep({
      offerId,
      name: (name || "").trim(),
      duplicate: !!duplicate,
      fromStepId: duplicate ? (fromStepId || null) : null,
    });

    if (created.error || !created.data) {
      console.error("[steps] insert error:", created.error);
      return res.status(500).json({ ok: false, error: "insert_failed" });
    }
    return res.json({ ok: true, step: created.data });
  } catch (err) {
    console.error("Erro criar etapa:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* ---------- ETAPAS: SALVAR ALTERAÇÕES (settings/nome) ---------- */
router.post("/ofertas/:id/etapas/:stepId/save", authGuard, async (req, res) => {
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
    console.error("Erro salvar etapa:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* ---------- Salvar token da oferta ---------- */
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

/* ======================================================================
   NOVAS ROTAS: RENOMEAR / EXCLUIR / DUPLICAR OFERTA (para offers_list.ejs)
   ====================================================================== */

/* Renomear oferta */
router.post("/ofertas/:id/renomear", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;
    const { novoNome } = req.body || {};
    const name = (novoNome || "").trim();

    if (!name) return res.status(400).json({ ok: false, error: "invalid_name" });

    const { data, error } = await supabase
      .from("offers")
      .update({ name })
      .eq("id", id)
      .eq("owner", owner)
      .select("id, name")
      .single();

    if (error || !data) return res.status(500).json({ ok: false, error: "update_failed" });

    return res.json({ ok: true, offer: data });
  } catch (err) {
    console.error("Erro renomear oferta:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* Excluir oferta */
router.delete("/ofertas/:id", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;

    // RLS garante owner; cascata apaga steps (FK ON DELETE CASCADE)
    const { data, error } = await supabase
      .from("offers")
      .delete()
      .eq("id", id)
      .eq("owner", owner)
      .select("id")
      .single();

    if (error || !data) return res.status(404).json({ ok: false, error: "not_found" });

    return res.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("Erro excluir oferta:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* Duplicar oferta */
router.post("/ofertas/:id/duplicar", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;

    // pega a original (confirma owner)
    const { data: original, error: getErr } = await supabase
      .from("offers")
      .select("id, owner, name, bot_type, tracking_type")
      .eq("id", id)
      .eq("owner", owner)
      .single();

    if (getErr || !original) return res.status(404).json({ ok: false, error: "not_found" });

    // gera nome "cópia"
    const base = original.name || "Oferta";
    const copyName = `${base} (cópia)`;

    // cria nova (status resetado e tokens limpos por segurança)
    const payload = {
      owner,
      name: copyName,
      bot_type: original.bot_type || "bot_padrao",
      tracking_type: original.tracking_type || "fb_pixel",
      status: "incompleto",
      telegram_username: null,
      bot_token: null,
    };

    const { data: created, error: insErr } = await supabase
      .from("offers")
      .insert([payload])
      .select("id, name, bot_type, tracking_type")
      .single();

    if (insErr || !created) return res.status(500).json({ ok: false, error: "insert_failed" });

    // (Opcional: duplicar steps no futuro; por ora painel cria Etapa 1 ao abrir)
    return res.json({ ok: true, offer: created });
  } catch (err) {
    console.error("Erro duplicar oferta:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

module.exports = router;
