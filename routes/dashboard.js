// routes/dashboard.js
const express = require("express");
const router = express.Router();

// guarda de autenticação centralizada
const authGuard = require("../middleware/authGuard");

// cliente do Supabase
const { supabase } = require("../lib/supabase");

/**
 * GET /  e  GET /deck
 * - Mantém a mesma view "deck" e as variáveis { title, planos, active }
 * - Lê os planos da tabela 'plans' (ajuste o nome se você criar outro)
 * - Em caso de erro ou tabela ausente, renderiza com [] (tema intacto)
 */
router.get(["/", "/deck"], authGuard, async (_req, res) => {
  try {
    let planos = [];

    const { data, error } = await supabase
      .from("plans")
      .select("id, name, price, description, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[dashboard] select plans falhou:", error.message);
    } else {
      planos = data || [];
    }

    return res.render("deck", {
      title: "Dashboard - TigerFy",
      planos,
      active: "deck",
    });
  } catch (err) {
    console.error("Erro dashboard:", err);
    return res.render("deck", {
      title: "Dashboard - TigerFy",
      planos: [],
      active: "deck",
    });
  }
});

module.exports = router;
