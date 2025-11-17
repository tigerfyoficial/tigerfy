// routes/offers.js
const express = require("express");
const router = express.Router();

const authGuard = require("../middleware/authGuard");
const { supabase } = require("../lib/supabase");
const Steps = require("../lib/steps");

/* ---------------------- mappers ---------------------- */
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
   LISTA
   ========================================================= */
router.get("/ofertas", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;

    const { data, error } = await supabase
      .from("offers")
      .select(
        "id, owner, name, bot_type, tracking_type, status, telegram_username, bot_token, created_at"
      )
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
   CRIAR OFERTA (somente a oferta; NÃO cria etapa automática)
   ========================================================= */
router.get("/ofertas/criar", authGuard, (_req, res) => {
  return res.render("bots_create", {
    title: "Criar Oferta - TigerFy",
    active: "ofertas",
  });
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

    // redireciona para o painel SEM criar etapa automática
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
   PAINEL DA OFERTA (NÃO garante etapa 1 automaticamente)
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

    // Carrega etapas (se não houver, painel abre vazio)
    const stepsRes = await Steps.listSteps(offer.id);
    const steps = (stepsRes.data || []).map(mapStep);

    // Etapa atual (se existir)
    let currentStep = null;
    if (stepId) {
      const got = await Steps.getStepById({ offerId: offer.id, stepId });
      if (!got.error && got.data) currentStep = mapStep(got.data);
    } else if (etapaNum && !isNaN(etapaNum)) {
      currentStep = steps.find((s) => s.stepNo === etapaNum) || null;
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

/* =========================================================
   OFERTA: RENOMEAR / DUPLICAR / EXCLUIR (usado na lista)
   ========================================================= */
router.post("/ofertas/:id/renomear", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;
    const { novoNome } = req.body || {};

    const name = (novoNome || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "bad_name" });

    // Confere owner
    const okOffer = await supabase
      .from("offers")
      .select("id")
      .eq("id", id)
      .eq("owner", owner)
      .single();

    if (okOffer.error || !okOffer.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const upd = await supabase
      .from("offers")
      .update({ name })
      .eq("id", id)
      .eq("owner", owner)
      .select("id")
      .single();

    if (upd.error) return res.status(500).json({ ok: false, error: "update_failed" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("Erro renomear oferta:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.delete("/ofertas/:id", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;

    const del = await supabase
      .from("offers")
      .delete()
      .eq("id", id)
      .eq("owner", owner);

    if (del.error) return res.status(500).json({ ok: false, error: "delete_failed" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("Erro excluir oferta:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/ofertas/:id/duplicar", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;

    const { data: src, error: e0 } = await supabase
      .from("offers")
      .select("id, name, bot_type, tracking_type, status, telegram_username, bot_token")
      .eq("id", id)
      .eq("owner", owner)
      .single();

    if (e0 || !src) return res.status(403).json({ ok: false, error: "forbidden" });

    const payload = {
      owner,
      name: `${src.name || "Oferta"} (cópia)`,
      bot_type: src.bot_type || "bot_padrao",
      tracking_type: src.tracking_type || "fb_pixel",
      status: "incompleto",
      telegram_username: null,
      bot_token: null,
    };

    const ins = await supabase.from("offers").insert([payload]).select("*").single();
    if (ins.error) return res.status(500).json({ ok: false, error: "insert_failed" });

    return res.json({ ok: true, offer: ins.data });
  } catch (e) {
    console.error("Erro duplicar oferta:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* =========================================================
   ETAPAS — CRIAR ÚNICA (caso algum ponto do front use)
   ========================================================= */
router.post("/ofertas/:id/etapas", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;
    const { name } = req.body || {};

    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const created = await Steps.createStep({
      offerId,
      name: (name || "").trim(),
      duplicate: false,
      fromStepId: null,
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

/* =========================================================
   ETAPAS — SALVAR MUDANÇAS (modal)  → bulk-save + alias /batch
   ========================================================= */
async function handleStepsBulkSave(req, res) {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;
    const { items } = req.body || {};

    if (!Array.isArray(items)) {
      return res.status(400).json({ ok: false, error: "bad_body" });
    }

    // Confere owner da oferta
    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    // Excluir existentes marcados
    const toDeleteIds = items
      .filter((i) => i && i._delete && i.id && !String(i.id).startsWith("tmp_"))
      .map((i) => i.id);

    if (toDeleteIds.length) {
      const del = await supabase
        .from("offer_steps")
        .delete()
        .in("id", toDeleteIds)
        .eq("offer_id", offerId);
      if (del.error) {
        console.error("[steps] delete error:", del.error);
        return res.status(500).json({ ok: false, error: "delete_failed" });
      }
    }

    // Renomear existentes
    const toUpdate = items.filter(
      (i) => i && i.id && !i._delete && typeof i.name === "string"
    );
    for (const it of toUpdate) {
      const name = (it.name || "").trim();
      if (!name) continue;
      const upd = await supabase
        .from("offer_steps")
        .update({ name })
        .eq("id", it.id)
        .eq("offer_id", offerId)
        .select("id")
        .single();
      if (upd.error) {
        console.error("[steps] update name error:", upd.error);
        return res.status(500).json({ ok: false, error: "update_failed" });
      }
    }

    // Criar novas (tmp_*)
    const toCreate = items.filter(
      (i) => i && !i._delete && (!i.id || String(i.id).startsWith("tmp_"))
    );
    if (toCreate.length) {
      const last = await supabase
        .from("offer_steps")
        .select("step_no")
        .eq("offer_id", offerId)
        .order("step_no", { ascending: false })
        .limit(1);

      const start = (last.data && last.data[0] && Number(last.data[0].step_no)) || 0;

      const inserts = toCreate.map((it, idx) => ({
        offer_id: offerId,
        name: (it.name && String(it.name).trim()) || `Etapa ${start + idx + 1}`,
        step_no: start + idx + 1,
        settings: it.settings && typeof it.settings === "object" ? it.settings : {},
        duplicated: false,
        duplicated_from: null,
      }));

      const ins = await supabase.from("offer_steps").insert(inserts).select("id");
      if (ins.error) {
        console.error("[steps] bulk insert error:", ins.error);
        return res.status(500).json({ ok: false, error: "insert_failed" });
      }
    }

    // Retorna lista atualizada
    const list = await Steps.listSteps(offerId);
    if (list.error) {
      console.error("[steps] list after save error:", list.error);
      return res.status(500).json({ ok: false, error: "list_failed" });
    }

    return res.json({
      ok: true,
      steps: (list.data || []).map(mapStep),
    });
  } catch (err) {
    console.error("Erro bulk-save:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

router.post("/ofertas/:id/etapas/bulk-save", authGuard, handleStepsBulkSave);
router.post("/ofertas/:id/etapas/batch", authGuard, handleStepsBulkSave); // compat com o front

/* =========================================================
   ETAPAS — SALVAR (config/nome) de uma etapa específica
   ========================================================= */
router.post("/ofertas/:id/etapas/:stepId/save", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId, stepId } = req.params;
    const { name, settings } = req.body || {};

    // Confere owner
    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    // Confere step pertence à oferta
    const stepRes = await Steps.getStepById({ offerId, stepId });
    if (stepRes.error || !stepRes.data) {
      return res.status(404).json({ ok: false, error: "step_not_found" });
    }

    // Atualiza
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

/* =========================================================
   OFERTA — SALVAR TOKEN (inalterado)
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

module.exports = router;
