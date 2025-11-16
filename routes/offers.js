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

    // ⚠️ NÃO cria etapa automaticamente.
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

    // ⚠️ NÃO garantir Etapa 1 automaticamente.
    const stepsRes = await Steps.listSteps(offer.id);
    const steps = (stepsRes.data || []).map(mapStep);

    // Etapa atual (se houver)
    let currentStep = null;
    if (stepId) {
      const got = await Steps.getStepById({ offerId: offer.id, stepId });
      if (!got.error && got.data) currentStep = mapStep(got.data);
    } else if (etapaNum && !isNaN(etapaNum)) {
      currentStep = steps.find(s => s.stepNo === etapaNum) || null;
    }

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

/* ---------- Criar etapa (única) ---------- */
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
      fromStepId: duplicate ? (fromStepId || null) : null
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

/* ---------- Criar várias etapas (para o botão “+” e salvar em lote) ---------- */
router.post("/ofertas/:id/etapas/batch", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;
    const { names } = req.body || {};
    if (!Array.isArray(names) || !names.length) {
      return res.status(400).json({ ok: false, error: "empty_names" });
    }

    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const created = [];
    for (const raw of names) {
      const nm = String(raw || "").trim() || null;
      const r = await Steps.createStep({ offerId, name: nm, duplicate: false, fromStepId: null });
      if (r.error) return res.status(500).json({ ok: false, error: r.error.message || "insert_failed" });
      created.push(r.data);
    }
    return res.json({ ok: true, steps: created });
  } catch (err) {
    console.error("Erro batch create:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* ---------- Renomear etapa ---------- */
router.patch("/ofertas/:id/etapas/:stepId/rename", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId, stepId } = req.params;
    const { name } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ ok:false, error:"invalid_name" });

    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const got = await Steps.getStepById({ offerId, stepId });
    if (got.error || !got.data) return res.status(404).json({ ok:false, error:"step_not_found" });

    const upd = await Steps.updateStep({ offerId, stepId, name: String(name).trim() });
    if (upd.error || !upd.data) return res.status(500).json({ ok:false, error:"update_failed" });

    return res.json({ ok:true, step: upd.data });
  } catch (err) {
    console.error("Erro rename:", err);
    return res.status(500).json({ ok:false, error:"server_error" });
  }
});

/* ---------- Excluir etapa ---------- */
router.delete("/ofertas/:id/etapas/:stepId", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId, stepId } = req.params;

    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) return res.status(403).json({ ok:false, error:"forbidden" });

    const del = await Steps.deleteStep({ offerId, stepId });
    if (del.error) {
      const msg = String(del.error.message || "");
      if (msg.includes("cannot_delete_first_step")) {
        return res.status(400).json({ ok:false, error:"cannot_delete_first_step" });
      }
      return res.status(500).json({ ok:false, error:"delete_failed" });
    }
    return res.json({ ok:true, id: stepId });
  } catch (err) {
    console.error("Erro delete:", err);
    return res.status(500).json({ ok:false, error:"server_error" });
  }
});

/* ---------- Reordenar etapas ---------- */
router.put("/ofertas/:id/etapas/reorder", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;
    const { order } = req.body || {}; // array de stepIds na ordem final

    if (!Array.isArray(order) || !order.length) {
      return res.status(400).json({ ok:false, error:"invalid_order" });
    }

    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) return res.status(403).json({ ok:false, error:"forbidden" });

    const r = await Steps.reorderSteps({ offerId, order });
    if (r.error) return res.status(500).json({ ok:false, error:"reorder_failed" });

    return res.json({ ok:true });
  } catch (err) {
    console.error("Erro reorder:", err);
    return res.status(500).json({ ok:false, error:"server_error" });
  }
});

/* ---------- Salvar alterações (settings / opcionalmente name) ---------- */
router.post("/ofertas/:id/etapas/:stepId/save", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId, stepId } = req.params;
    const { name, settings } = req.body || {};

    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) return res.status(403).json({ ok:false, error:"forbidden" });

    const stepRes = await Steps.getStepById({ offerId, stepId });
    if (stepRes.error || !stepRes.data) return res.status(404).json({ ok:false, error:"step_not_found" });

    const updRes = await Steps.updateStep({
      offerId,
      stepId,
      name: typeof name === "string" ? name : undefined,
      settings: settings && typeof settings === "object" ? settings : undefined,
    });
    if (updRes.error || !updRes.data) return res.status(500).json({ ok:false, error:"update_failed" });

    return res.json({ ok:true, step: mapStep(updRes.data) });
  } catch (err) {
    console.error("Erro salvar etapa:", err);
    return res.status(500).json({ ok:false, error:"server_error" });
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
