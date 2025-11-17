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

    // painel SEM etapa automática
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

    // Etapas (se não houver, painel abre vazio)
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
   OFERTA: RENOMEAR / DUPLICAR / EXCLUIR
   ========================================================= */
router.post("/ofertas/:id/renomear", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;
    const { novoNome } = req.body || {};

    const name = (novoNome || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "bad_name" });

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
   ETAPAS — LISTAR / CRIAR ÚNICA / EXCLUIR ÚNICA
   ========================================================= */
router.get("/ofertas/:id/etapas", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;

    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const list = await Steps.listSteps(offerId);
    if (list.error) return res.status(500).json({ ok: false, error: "list_failed" });

    return res.json({ ok: true, steps: (list.data || []).map(mapStep) });
  } catch (err) {
    console.error("Erro listar etapas:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

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

router.delete("/ofertas/:id/etapas/:stepId", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId, stepId } = req.params;

    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const del = await supabase
      .from("offer_steps")
      .delete()
      .eq("id", stepId)
      .eq("offer_id", offerId);

    if (del.error) return res.status(500).json({ ok: false, error: "delete_failed" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro excluir etapa:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* =========================================================
   ETAPAS — SALVAR (cria quando não tem id; atualiza quando tem)
   → funciona com body simples {name} OU em lote (items/steps/list)
   ========================================================= */
function normalizeBulkBody(body) {
  const items =
    body?.items ||
    body?.steps ||
    body?.list ||
    body?.payload ||
    body?.data?.items ||
    body?.data?.steps ||
    [];

  return (Array.isArray(items) ? items : []).map((i) => ({
    id: i.id ?? i.stepId ?? null,
    name: typeof i.name === "string" ? i.name : (i.title || ""),
    settings:
      i.settings && typeof i.settings === "object" ? i.settings : (i.config || {}),
    _delete: !!(i._delete || i.delete || i.removed),
  }));
}

async function handleStepsSave(req, res) {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;

    // 1) checa owner
    const offerRes = await Steps.getOfferByIdForOwner(offerId, owner);
    if (offerRes.error || !offerRes.data) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    // 2) modo simples: body { name: "Etapa X" } → cria APENAS quando clicar em SALVAR
    if (req.body && typeof req.body === "object" && req.body.name && !req.body.id && !req.body.items && !req.body.steps && !req.body.list) {
      const created = await Steps.createStep({
        offerId,
        name: String(req.body.name || "").trim(),
        duplicate: false,
        fromStepId: null,
      });
      if (created.error || !created.data) {
        console.error("[steps] create (simple) error:", created.error);
        return res.status(500).json({ ok: false, error: "insert_failed" });
      }

      // retorna lista atualizada + step criado
      const list = await Steps.listSteps(offerId);
      return res.json({
        ok: true,
        created: mapStep(created.data),
        steps: (list.data || []).map(mapStep),
      });
    }

    // 3) modo lista (batch)
    const items = normalizeBulkBody(req.body);

    // deletar
    const toDeleteIds = items
      .filter((i) => i._delete && i.id && !String(i.id).startsWith("tmp_"))
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

    // atualizar nomes existentes
    const toUpdate = items.filter(
      (i) => i.id && !String(i.id).startsWith("tmp_") && !i._delete
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

    // criar novas (tmp_*)
    const toCreate = items.filter(
      (i) => !i._delete && (!i.id || String(i.id).startsWith("tmp_"))
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

    const list = await Steps.listSteps(offerId);
    return res.json({
      ok: true,
      steps: (list.data || []).map(mapStep),
      message: "saved",
    });
  } catch (err) {
    console.error("Erro steps save:", err, "BODY:", req.body);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/* Aliases aceitando o mesmo body */
router.post("/ofertas/:id/etapas/save-changes", authGuard, handleStepsSave);
router.post("/ofertas/:id/etapas/batch", authGuard, handleStepsSave);
router.post("/ofertas/:id/etapas/bulk-save", authGuard, handleStepsSave);
router.post("/ofertas/:id/etapas/save", authGuard, handleStepsSave);

/* =========================================================
   ETAPA — salvar nome/config específica
   ========================================================= */
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
    console.error("Erro salvar etapa:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* =========================================================
   OFERTA — SALVAR TOKEN
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
