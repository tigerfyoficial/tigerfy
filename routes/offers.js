// routes/offers.js
const express = require("express");
const router = express.Router();

const authGuard = require("../middleware/authGuard");
const { supabase } = require("../lib/supabase");

/* ---------- Helpers ---------- */
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
    createdAt: row.created_at,
  };
}

/* ---------- LISTA MINIMALISTA => /ofertas ---------- */
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

/* ---------- CRIAR (GET) => /ofertas/criar ---------- */
router.get("/ofertas/criar", authGuard, (_req, res) => {
  return res.render("bots_create", {
    title: "Criar Oferta - TigerFy",
    active: "ofertas",
  });
});

/* ---------- CRIAR (POST) => /ofertas/criar → redireciona painel ---------- */
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

/* ---------- BACKWARD: /ofertas/gerenciar?id=... → painel novo ---------- */
router.get("/ofertas/gerenciar", authGuard, (req, res) => {
  const id = req.query.id;
  if (!id) return res.redirect("/ofertas");
  return res.redirect(`/ofertas/painel/${id}`);
});

/* ---------- Util: garante etapa 1 se não existir ---------- */
async function ensureFirstStep(offerId) {
  // existe alguma etapa?
  const { data: stepsExist, error: seErr } = await supabase
    .from("offer_steps")
    .select("id")
    .eq("offer_id", offerId)
    .limit(1);

  if (seErr) {
    console.warn("[steps] check first error:", seErr.message);
    return null;
  }
  if (stepsExist && stepsExist.length > 0) return null;

  // cria Etapa 1
  const { data: inserted, error: insErr } = await supabase
    .from("offer_steps")
    .insert([{ offer_id: offerId, name: "Etapa 1", step_no: 1, duplicated: false }])
    .select("*")
    .single();

  if (insErr) {
    console.warn("[steps] create first error:", insErr.message);
    return null;
  }
  return inserted;
}

/* ---------- Painel Exclusivo: /ofertas/painel/:id ---------- */
router.get("/ofertas/painel/:id", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;
    const stepId = req.query.stepId || null; // id real da etapa (uuid)
    const etapaNum = req.query.etapa ? parseInt(req.query.etapa, 10) : null; // legado (número)

    // 1) Confere oferta pertence ao user
    const { data: offerRow, error: offErr } = await supabase
      .from("offers")
      .select("id, owner, name, bot_type, tracking_type, status, telegram_username, bot_token, created_at")
      .eq("id", offerId)
      .eq("owner", owner)
      .single();

    if (offErr || !offerRow) {
      console.warn("[ofertas] painel not found/denied:", offErr?.message);
      return res.redirect("/ofertas");
    }
    const offer = mapOffer(offerRow);

    // 2) Garante ao menos a Etapa 1
    await ensureFirstStep(offer.id);

    // 3) Carrega todas as etapas da oferta
    const { data: stepsData, error: stErr } = await supabase
      .from("offer_steps")
      .select("*")
      .eq("offer_id", offer.id)
      .order("step_no", { ascending: true });

    if (stErr) {
      console.warn("[steps] fetch error:", stErr.message);
    }

    const steps = (stepsData || []).map(mapStep);

    // 4) Descobre etapa atual:
    let currentStep = null;

    if (stepId) {
      currentStep = steps.find(s => s.id === stepId) || null;
    } else if (etapaNum && !isNaN(etapaNum)) {
      currentStep = steps.find(s => s.stepNo === etapaNum) || null;
    }
    if (!currentStep) {
      // padrão: menor step_no
      currentStep = steps.length ? steps[0] : null;
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

/* ---------- Criar Etapa (POST JSON) ----------
   body: { name: string, duplicate: boolean, fromStepId?: uuid }
------------------------------------------------ */
router.post("/ofertas/:id/etapas", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id: offerId } = req.params;
    const { name, duplicate, fromStepId } = req.body || {};

    // 1) owner da oferta
    const { data: off, error: offErr } = await supabase
      .from("offers")
      .select("id, owner")
      .eq("id", offerId)
      .eq("owner", owner)
      .single();

    if (offErr || !off) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    // 2) descobre o próximo step_no
    const { data: last, error: lastErr } = await supabase
      .from("offer_steps")
      .select("step_no")
      .eq("offer_id", offerId)
      .order("step_no", { ascending: false })
      .limit(1);

    if (lastErr) {
      console.warn("[steps] lastErr:", lastErr.message);
    }
    const nextNo = last && last.length ? (Number(last[0].step_no) + 1) : 1;

    // 3) insere a etapa
    const payload = {
      offer_id: offerId,
      name: (name || "").trim() || `Etapa ${nextNo}`,
      step_no: nextNo,
      duplicated: !!duplicate,
      duplicated_from: duplicate && fromStepId ? fromStepId : null,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("offer_steps")
      .insert([payload])
      .select("*")
      .single();

    if (insErr || !inserted) {
      console.error("[steps] insert error:", insErr?.message);
      return res.status(500).json({ ok: false, error: "insert_failed" });
    }

    // (Futuro: se duplicate==true, copiar configs aqui)
    // Por ora, apenas marcamos duplicated e duplicated_from.

    return res.json({
      ok: true,
      step: mapStep(inserted),
    });
  } catch (err) {
    console.error("Erro criar etapa:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* ---------- SALVAR TOKEN (inalterado; redireciona painel novo) ---------- */
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

    if (getErr || !exists) {
      console.warn("[ofertas] token denied (owner mismatch)");
      return res.redirect("/ofertas");
    }

    const newStatus = botToken ? "ativo" : "incompleto";

    const { error: updErr } = await supabase
      .from("offers")
      .update({
        bot_token: botToken || null,
        telegram_username: telegramUsername || null,
        status: newStatus,
      })
      .eq("id", id)
      .eq("owner", owner);

    if (updErr) console.error("[ofertas] update token error:", updErr.message);

    return res.redirect(`/ofertas/painel/${id}`);
  } catch (err) {
    console.error("Erro salvar token:", err);
    return res.redirect("/ofertas");
  }
});

module.exports = router;
