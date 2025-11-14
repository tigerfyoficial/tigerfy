// routes/offers.js
const express = require("express");
const router = express.Router();

const authGuard = require("../middleware/authGuard");
const { supabase } = require("../lib/supabase");

/* util: mapeia linha do Supabase para o formato que o EJS espera (Mongo-like) */
function mapOffer(row) {
  return {
    _id: row.id,                         // <- para o EJS que usa offer._id
    id: row.id,                          // redundante, mas útil
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

/* LISTA DE OFERTAS  => /bots */
router.get("/bots", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;

    const { data, error } = await supabase
      .from("offers")
      .select(
        "id, owner, name, bot_type, tracking_type, status, telegram_username, bot_token, created_at"
      )
      .eq("owner", owner)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[offers] select error:", error.message);
    }

    const offers = (data || []).map(mapOffer);

    return res.render("bots", {
      title: "Minhas Ofertas - TigerFy",
      offers,
      active: "bots",
    });
  } catch (err) {
    console.error("Erro carregar ofertas:", err);
    return res.render("bots", {
      title: "Minhas Ofertas - TigerFy",
      offers: [],
      active: "bots",
    });
  }
});

/* TELA DE CRIAÇÃO => /bots/create (GET) */
router.get("/bots/create", authGuard, (_req, res) => {
  return res.render("bots_create", {
    title: "Criar Oferta - TigerFy",
    active: "bots",
  });
});

/* CRIAR OFERTA => /bots/create (POST)
   Após criar, redireciona para /bots/manage?id=<novoId> */
router.post("/bots/create", authGuard, async (req, res) => {
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
      console.error("[offers] insert error:", error?.message);
      return res.redirect("/bots");
    }

    return res.redirect(`/bots/manage?id=${data.id}`);
  } catch (err) {
    console.error("Erro criar oferta:", err);
    return res.redirect("/bots");
  }
});

/* GERENCIAR OFERTAS => /bots/manage?id=<offerId> */
router.get("/bots/manage", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const selectedId = req.query.id || null;

    // lista para a coluna esquerda
    const { data: listData, error: listErr } = await supabase
      .from("offers")
      .select(
        "id, owner, name, bot_type, tracking_type, status, telegram_username, bot_token, created_at"
      )
      .eq("owner", owner)
      .order("created_at", { ascending: false });

    if (listErr) console.warn("[offers] list error:", listErr.message);
    const offers = (listData || []).map(mapOffer);

    // oferta selecionada (painel à direita)
    let selectedOffer = null;
    if (selectedId) {
      const { data: sel, error: selErr } = await supabase
        .from("offers")
        .select(
          "id, owner, name, bot_type, tracking_type, status, telegram_username, bot_token, created_at"
        )
        .eq("id", selectedId)
        .eq("owner", owner)
        .single();

      if (selErr && selErr.code !== "PGRST116") {
        console.warn("[offers] selected error:", selErr.message);
      }
      if (sel) selectedOffer = mapOffer(sel);
    }

    return res.render("bots_manage", {
      title: "Gerenciar Ofertas - TigerFy",
      offers,
      selectedOffer,
      active: "bots",
    });
  } catch (err) {
    console.error("Erro manage:", err);
    return res.render("bots_manage", {
      title: "Gerenciar Ofertas - TigerFy",
      offers: [],
      selectedOffer: null,
      active: "bots",
    });
  }
});

/* SALVAR TOKEN DO BOT => /bots/:id/token  (form do bots_manage.ejs) */
router.post("/bots/:id/token", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { id } = req.params;
    const { botToken, telegramUsername } = req.body;

    // garante que a oferta pertence ao usuário
    const { data: exists, error: getErr } = await supabase
      .from("offers")
      .select("id, owner")
      .eq("id", id)
      .eq("owner", owner)
      .single();

    if (getErr || !exists) {
      console.warn("[offers] token denied (owner mismatch)");
      return res.redirect("/bots");
    }

    // define status automaticamente
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

    if (updErr) {
      console.error("[offers] update token error:", updErr.message);
    }

    return res.redirect(`/bots/manage?id=${id}`);
  } catch (err) {
    console.error("Erro salvar token:", err);
    return res.redirect("/bots");
  }
});

module.exports = router;
