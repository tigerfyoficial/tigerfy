const express = require("express");
const router = express.Router();
const authGuard = require("../middleware/authGuard");
const { supabase } = require("../lib/supabase");

// LISTAGEM
router.get("/adquirentes", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { data, error } = await supabase
      .from("api_pix")
      .select("id, provider, key, secret, owner, created_at")
      .eq("owner", owner)
      .order("created_at", { ascending: false });

    if (error) console.warn("[adquirentes] select error:", error.message);

    return res.render("api_pix", {
      title: "Adquirentes - TigerFy",
      adquirentes: data || [],
      active: "adquirentes",
    });
  } catch (err) {
    console.error("Erro adquirentes:", err);
    return res.status(500).send("erro ao carregar adquirentes");
  }
});

// ADD
router.post("/adquirentes/add", authGuard, async (req, res) => {
  try {
    const owner = req.session.userId;
    const { provider, key, secret } = req.body;

    const { error } = await supabase
      .from("api_pix")
      .insert([{ provider, key, secret, owner }]);

    if (error) console.error("[adquirentes] insert error:", error.message);
    return res.redirect("/adquirentes");
  } catch (err) {
    console.error("Erro add adquirente:", err);
    return res.status(500).send("erro ao adicionar adquirente");
  }
});

module.exports = router;
