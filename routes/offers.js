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

/* =========================================================
   LISTAGEM
========================================================= */
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

/* =========================================================
   CRIAR OFERTA (GET/POST)
========================================================= */
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
      telegram_username: null,
      bot_token: null,
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

    // ✅ NÃO cria etapa automaticamente. Apenas abre o painel.
    return res.redirect(`/ofertas/painel/${data.id}`);
  } catch (err) {
    console.error("Erro criar oferta:", err);
    return res.redirect("/ofertas");
  }
});

/* =========================================================
   COMPAT: /ofertas/gerenciar → painel
========================================================= */
router.get("/ofertas/gerenciar", authGuard, (req, res) => {
  const id = req.query.id;
  if (!id) return res.redirect("/ofertas");
  return res.redirect(`/ofertas/painel/${id}`);
});

/* =========================================================
   PAINEL DA OFERTA (sem ensureFirstStep)
========================================================= */
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

    // ❌ NÃO garantir Etapa 1 automaticamente
    // const _ = await Steps.ensureFirstStep(offer.id);

    // Carrega etapas (se não houver, tudo bem)
    const stepsRes = await Steps.listSteps(offer.id);
    const steps = (stepsRes.data || []).map(mapStep);

    // Seleção da etapa atual (se existir)
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
      currentStep, // pode ser null
      active: "ofertas",
    });
  } catch (err) {
    console.error("Erro painel:", err);
    return res.redirect("/ofertas");
  }
});

/* =========================================================
   ETAPAS — criar
========================================================= */
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

/* =========================================================
   ETAPAS — salvar (nome/settings)
   (evita UPDATE vazio; parse seguro de settings)
========================================================= */
router.post("/ofertas/:id/etapas/:stepId/save", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId, stepId } = req.params;
    const { name } = req.body || {};
    let { settings } = req.body || {};

    if (typeof settings === "string") {
      try { settings = JSON.parse(settings); } catch (_) { settings = undefined; }
    }

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
      settings
    });

    if (updRes.error || !updRes.data) {
      console.error("[steps] update error:", updRes.error?.message || updRes.error);
      return res.status(500).json({ ok: false, error: "update_failed" });
    }

    const s = updRes.data;
    return res.json({
      ok: true,
      step: {
        id: s.id,
        offerId: s.offer_id,
        name: s.name,
        stepNo: s.step_no,
        duplicated: s.duplicated,
        duplicatedFrom: s.duplicated_from || null,
        settings: s.settings || {},
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      }
    });
  } catch (err) {
    console.error("Erro salvar etapa:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* =========================================================
   TOKENS (inalterado)
========================================================= */
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

/* =========================================================
   AÇÕES DA LISTA — RENOMEAR / DUPLICAR / EXCLUIR
========================================================= */

// Renomear
router.post("/ofertas/:id/renomear", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;
    const { novoNome } = req.body || {};
    const name = (novoNome || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "invalid_name" });

    const { data: exists, error: getErr } = await supabase
      .from("offers")
      .select("id")
      .eq("id", id)
      .eq("owner", owner)
      .single();
    if (getErr || !exists) return res.status(404).json({ ok: false, error: "not_found" });

    const { error: updErr } = await supabase
      .from("offers")
      .update({ name })
      .eq("id", id)
      .eq("owner", owner);

    if (updErr) return res.status(500).json({ ok: false, error: "update_failed" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro renomear oferta:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Duplicar
router.post("/ofertas/:id/duplicar", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;

    const { data: src, error: getErr } = await supabase
      .from("offers")
      .select("id, owner, name, bot_type, tracking_type, status")
      .eq("id", id)
      .eq("owner", owner)
      .single();

    if (getErr || !src) return res.status(404).json({ ok: false, error: "not_found" });

    const payload = {
      owner,
      name: `${src.name} (cópia)`,
      bot_type: src.bot_type,
      tracking_type: src.tracking_type,
      status: "incompleto",
      telegram_username: null,
      bot_token: null,
    };

    const { data: created, error: insErr } = await supabase
      .from("offers")
      .insert([payload])
      .select("id, name, bot_type")
      .single();

    if (insErr || !created) return res.status(500).json({ ok: false, error: "insert_failed" });

    // ❗Não copiamos etapas aqui (mantém simples)
    return res.json({ ok: true, offer: created });
  } catch (err) {
    console.error("Erro duplicar oferta:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Excluir
router.delete("/ofertas/:id", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;

    // Confirma posse
    const { data: exists, error: getErr } = await supabase
      .from("offers")
      .select("id")
      .eq("id", id)
      .eq("owner", owner)
      .single();
    if (getErr || !exists) return res.status(404).json({ ok: false, error: "not_found" });

    // FK em offer_steps está ON DELETE CASCADE
    const { error: delErr } = await supabase
      .from("offers")
      .delete()
      .eq("id", id)
      .eq("owner", owner);

    if (delErr) return res.status(500).json({ ok: false, error: "delete_failed" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro excluir oferta:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

module.exports = router;
