// routes/offers.js
const express = require("express");
const router = express.Router();

const authGuard = require("../middleware/authGuard");
const { supabase } = require("../lib/supabase");

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

/* LISTA => /ofertas */
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

    return res.render("bots", {
      title: "Minhas Ofertas - TigerFy",
      offers,
      active: "ofertas",
    });
  } catch (err) {
    console.error("Erro carregar ofertas:", err);
    return res.render("bots", {
      title: "Minhas Ofertas - TigerFy",
      offers: [],
      active: "ofertas",
    });
  }
});

/* CRIAR (GET) => /ofertas/criar */
router.get("/ofertas/criar", authGuard, (_req, res) => {
  return res.render("bots_create", {
    title: "Criar Oferta - TigerFy",
    active: "ofertas",
  });
});

/* CRIAR (POST) => /ofertas/criar  → redireciona /ofertas/gerenciar?id=... */
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

    return res.redirect(`/ofertas/gerenciar?id=${data.id}`);
  } catch (err) {
    console.error("Erro criar oferta:", err);
    return res.redirect("/ofertas");
  }
});

/* GERENCIAR => /ofertas/gerenciar?id=... */
router.get("/ofertas/gerenciar", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const selectedId = req.query.id || null;

    const { data: listData, error: listErr } = await supabase
      .from("offers")
      .select("id, owner, name, bot_type, tracking_type, status, telegram_username, bot_token, created_at")
      .eq("owner", owner)
      .order("created_at", { ascending: false });

    if (listErr) console.warn("[ofertas] list error:", listErr.message);
    const offers = (listData || []).map(mapOffer);

    let selectedOffer = null;
    if (selectedId) {
      const { data: sel, error: selErr } = await supabase
        .from("offers")
        .select("id, owner, name, bot_type, tracking_type, status, telegram_username, bot_token, created_at")
        .eq("id", selectedId)
        .eq("owner", owner)
        .single();

      if (selErr && selErr.code !== "PGRST116") {
        console.warn("[ofertas] selected error:", selErr.message);
      }
      if (sel) selectedOffer = mapOffer(sel);
    }

    return res.render("bots_manage", {
      title: "Gerenciar Ofertas - TigerFy",
      offers,
      selectedOffer,
      active: "ofertas",
    });
  } catch (err) {
    console.error("Erro manage:", err);
    return res.render("bots_manage", {
      title: "Gerenciar Ofertas - TigerFy",
      offers: [],
      selectedOffer: null,
      active: "ofertas",
    });
  }
});

/* SALVAR TOKEN => /ofertas/:id/token */
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

    return res.redirect(`/ofertas/gerenciar?id=${id}`);
  } catch (err) {
    console.error("Erro salvar token:", err);
    return res.redirect("/ofertas");
  }
});

module.exports = router;
