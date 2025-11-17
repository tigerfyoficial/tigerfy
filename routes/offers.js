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

/* ========== LISTA ========== */
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

/* ========== CRIAR OFERTA ========== */
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

    // ⚠️ NÃO cria etapa automaticamente. Só redireciona para o painel vazio.
    return res.redirect(`/ofertas/painel/${data.id}`);
  } catch (err) {
    console.error("Erro criar oferta:", err);
    return res.redirect("/ofertas");
  }
});

/* Compat: /ofertas/gerenciar → painel */
router.get("/ofertas/gerenciar", authGuard, (req, res) => {
  const id = req.query.id;
  if (!id) return res.redirect("/ofertas");
  return res.redirect(`/ofertas/painel/${id}`);
});

/* ========== PAINEL DA OFERTA ========== */
router.get("/ofertas/painel/:id", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;
    const stepId = req.query.stepId || null;
    const etapaNum = req.query.etapa ? parseInt(req.query.etapa, 10) : null;

    // Oferta pertence ao usuário?
    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) return res.redirect("/ofertas");
    const offer = mapOffer(offerRes.data);

    // NÃO garante Etapa 1; painel pode abrir vazio
    const stepsRes = await Steps.listSteps(offer.id);
    const steps = (stepsRes.data || []).map(mapStep);

    // Etapa atual (se existir)
    let currentStep = null;
    if (stepId) {
      const got = await Steps.getStepById({ offerId: offer.id, stepId });
      if (!got.error && got.data) currentStep = mapStep(got.data);
    } else if (etapaNum && !isNaN(etapaNum)) {
      currentStep = steps.find(s => s.stepNo === etapaNum) || null;
    }
    if (!currentStep && steps.length) currentStep = steps[0];

    return res.render("offer_panel", {
      title: `${offer.name} — Painel da Oferta - TigerFy`,
      offer,
      steps,
      currentStep, // pode ser null, e a view deve lidar normal
      active: "ofertas",
    });
  } catch (err) {
    console.error("Erro painel:", err);
    return res.redirect("/ofertas");
  }
});

/* ========== ETAPAS ========== */
/* Criar etapa (imediato; usado por UIs antigas) */
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
    return res.json({ ok: true, step: mapStep(created.data) });
  } catch (err) {
    console.error("Erro criar etapa:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* Salvar alterações de etapa (PATCH) */
async function _patchStep(req, res) {
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
    console.error("Erro salvar etapa:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
router.patch("/ofertas/:id/etapas/:stepId", authGuard, _patchStep);
/* compat antiga: /save */
router.post("/ofertas/:id/etapas/:stepId/save", authGuard, _patchStep);

/* Excluir etapa */
router.delete("/ofertas/:id/etapas/:stepId", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId, stepId } = req.params;

    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const { error } = await supabase
      .from("offer_steps")
      .delete()
      .eq("id", stepId)
      .eq("offer_id", offerId);

    if (error) {
      console.error("[steps] delete error:", error.message);
      return res.status(500).json({ ok: false, error: "delete_failed" });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro excluir etapa:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// === Substitua a ROTA /ofertas/:id/etapas/batch por esta versão ===
router.post("/ofertas/:id/etapas/batch", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;

    // Confere dono da oferta
    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    // Aceitamos VÁRIOS formatos de payload para evitar 400:
    //  A) { ops:[ {action: 'create'|'update'|'delete', ...} ], currentStepId? }
    //  B) [ {action, ...}, ... ]
    //  C) { create:[{name,...}], update:[{id,name,settings?}], delete:[{id}], currentStepId? }
    let ops = [];
    let currentStepId = null;

    if (Array.isArray(req.body)) {
      ops = req.body;
    } else if (Array.isArray(req.body?.ops)) {
      ops = req.body.ops;
      currentStepId = req.body.currentStepId || req.body.selectedStepId || null;
    } else if (
      req.body &&
      (Array.isArray(req.body.create) ||
       Array.isArray(req.body.update) ||
       Array.isArray(req.body.delete))
    ) {
      currentStepId = req.body.currentStepId || req.body.selectedStepId || null;

      // Expandimos para formato "ops"
      if (Array.isArray(req.body.create)) {
        for (const c of req.body.create) {
          ops.push({ action: "create", ...c });
        }
      }
      if (Array.isArray(req.body.update)) {
        for (const u of req.body.update) {
          ops.push({ action: "update", ...u });
        }
      }
      if (Array.isArray(req.body.delete)) {
        for (const d of req.body.delete) {
          ops.push({ action: "delete", ...d });
        }
      }
    } else if (req.body && (req.body.action || req.body.type)) {
      ops = [req.body];
      currentStepId = req.body.currentStepId || req.body.selectedStepId || null;
    }

    if (!ops.length && !currentStepId) {
      return res.status(400).json({ ok: false, error: "no_ops" });
    }

    const results = [];
    for (const raw of ops) {
      const action = String(raw.action || raw.type || "").toLowerCase();

      if (action === "create") {
        const name = (raw.name || "").trim();
        const duplicate = !!raw.duplicate;
        const fromStepId = duplicate ? (raw.fromStepId || null) : null;

        const created = await Steps.createStep({ offerId, name, duplicate, fromStepId });
        if (created.error) {
          results.push({ ok: false, error: created.error.message || "create_failed" });
        } else {
          results.push({ ok: true, step: created.data });
        }
        continue;
      }

      if (action === "update") {
        const stepId = raw.stepId || raw.id;
        if (!stepId) { results.push({ ok:false, error:"missing_stepId" }); continue; }

        const upd = await Steps.updateStep({
          offerId,
          stepId,
          name: typeof raw.name === "string" ? raw.name : undefined,
          settings: raw.settings && typeof raw.settings === "object" ? raw.settings : undefined,
        });
        if (upd.error) {
          results.push({ ok: false, error: upd.error.message || "update_failed" });
        } else {
          results.push({ ok: true, step: upd.data });
        }
        continue;
      }

      if (action === "delete") {
        const stepId = raw.stepId || raw.id;
        if (!stepId) { results.push({ ok:false, error:"missing_stepId" }); continue; }

        const { error } = await supabase
          .from("offer_steps")
          .delete()
          .eq("id", stepId)
          .eq("offer_id", offerId);
        if (error) {
          results.push({ ok: false, error: error.message || "delete_failed" });
        } else {
          results.push({ ok: true });
        }
        continue;
      }

      results.push({ ok:false, error:"unknown_action" });
    }

    // Marcar etapa atual (sem precisar alterar schema):
    // Guardamos em settings.is_current = true no step escolhido e false nos demais.
    if (currentStepId) {
      const all = await Steps.listSteps(offerId);
      if (!all.error) {
        const steps = all.data || [];
        for (const s of steps) {
          const makeCurrent = s.id === currentStepId;
          const newSettings = { ...(s.settings || {}) };
          if (makeCurrent) newSettings.is_current = true; else delete newSettings.is_current;

          await Steps.updateStep({
            offerId,
            stepId: s.id,
            settings: newSettings
          });
        }
      }
    }

    // Devolvemos a lista FINAL para o front se reconciliar (evita ter de mapear temp ids)
    const finalList = await Steps.listSteps(offerId);
    const stepsOut = (finalList.data || []).map(s => ({
      id: s.id,
      offer_id: s.offer_id,
      name: s.name,
      step_no: s.step_no,
      settings: s.settings || {},
      created_at: s.created_at,
      updated_at: s.updated_at
    }));

    return res.json({ ok: true, results, steps: stepsOut });
  } catch (err) {
    console.error("Erro batch etapas:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* ========== TOKEN DA OFERTA (inalterado) ========== */
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

/* ========== AÇÕES DA LISTA (renomear/duplicar/excluir) ========== */
router.post("/ofertas/:id/renomear", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;
    const { novoNome } = req.body || {};
    const name = (novoNome || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "invalid_name" });

    const { error } = await supabase
      .from("offers")
      .update({ name })
      .eq("id", id)
      .eq("owner", owner);

    if (error) return res.status(500).json({ ok: false, error: "rename_failed" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro renomear oferta:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/ofertas/:id/duplicar", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;

    const { data: base, error: getErr } = await supabase
      .from("offers")
      .select("*")
      .eq("id", id)
      .eq("owner", owner)
      .single();
    if (getErr || !base) return res.status(404).json({ ok: false, error: "not_found" });

    const payload = {
      owner,
      name: (base.name || "Oferta") + " (cópia)",
      bot_type: base.bot_type,
      tracking_type: base.tracking_type,
      status: "incompleto",
      telegram_username: null,
      bot_token: null,
    };

    const { data: created, error: insErr } = await supabase
      .from("offers")
      .insert([payload])
      .select("*")
      .single();

    if (insErr || !created) return res.status(500).json({ ok: false, error: "duplicate_failed" });
    return res.json({ ok: true, offer: created });
  } catch (err) {
    console.error("Erro duplicar oferta:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.delete("/ofertas/:id", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;

    const { error } = await supabase
      .from("offers")
      .delete()
      .eq("id", id)
      .eq("owner", owner);

    if (error) return res.status(500).json({ ok: false, error: "delete_failed" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro excluir oferta:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

module.exports = router;
