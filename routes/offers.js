// routes/offers.js
const express = require("express");
const router = express.Router();

const authGuard = require("../middleware/authGuard");
const { supabase } = require("../lib/supabase");

// LISTA DE OFERTAS
router.get("/bots", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;

    const { data, error } = await supabase
      .from("offers")
      .select("id, owner, name, bot_type, tracking_type, status, created_at")
      .eq("owner", owner)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[offers] erro select:", error.message);
    }

    return res.render("bots", {
      title: "Minhas Ofertas - TigerFy",
      offers: data || [],
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

// TELA DE CRIAÇÃO
router.get("/bots/create", authGuard, (_req, res) => {
  return res.render("bots_create", {
    title: "Criar Oferta - TigerFy",
    active: "bots",
  });
});

// CRIAR OFERTA
router.post("/bots/create", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { name, botType, trackingType } = req.body;

    // valores default para manter compatibilidade visual/fluxo antigo
    const payload = {
      owner,
      name: name || "",
      bot_type: botType || "bot_padrao",
      tracking_type: trackingType || "fb_pixel",
      status: "incompleto",
    };

    const { error } = await supabase.from("offers").insert([payload]);

    if (error) {
      console.error("[offers] erro insert:", error.message);
      // mantém UX: volta para a lista mesmo em falha (como fazia com redirect)
      return res.redirect("/bots");
    }

    return res.redirect("/bots");
  } catch (err) {
    console.error("Erro criar oferta:", err);
    return res.redirect("/bots");
  }
});

module.exports = router;
