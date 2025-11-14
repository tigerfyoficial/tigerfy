// routes/api_pix.js
const express = require("express");
const router = express.Router();

// guarda de rota (login obrigatório)
const authGuard = require("../middleware/authGuard");

// supabase client (sem usar Mongo)
const { supabase } = require("../lib/supabase");

/**
 * GET /api_pix
 * Lista os adquirentes do usuário logado.
 * - Mantém a mesma view e variáveis usadas no tema: `adquirentes`, `active`, `title`
 * - Se a tabela ainda não existir no Supabase, cai no catch e renderiza vazio (sem quebrar a página)
 */
router.get("/api_pix", authGuard, async (req, res) => {
  try {
    let adquirentes = [];

    // Tenta buscar na tabela `api_pix` (owner = userId da sessão)
    const { data, error } = await supabase
      .from("api_pix")
      .select("id, provider, key, secret, created_at")
      .eq("owner", req.session.userId)
      .order("created_at", { ascending: false });

    if (error) {
      // Tabela pode não existir ainda — loga e segue com array vazio
      console.warn("[api_pix] select falhou:", error.message);
    } else {
      adquirentes = data || [];
    }

    return res.render("api_pix", {
      title: "Adquirentes - TigerFy",
      adquirentes,
      active: "api_pix",
    });
  } catch (err) {
    console.error("Erro api pix:", err);
    return res.render("api_pix", {
      title: "Adquirentes - TigerFy",
      adquirentes: [],
      active: "api_pix",
    });
  }
});

/**
 * POST /api_pix/add
 * Cria um adquirente vinculado ao usuário logado.
 * - Mantém o redirect para /api_pix (mesmo comportamento anterior)
 * - Se a tabela ainda não existir, só loga o erro e volta pra tela (não quebra o tema)
 */
router.post("/api_pix/add", authGuard, async (req, res) => {
  try {
    const { provider, key, secret } = req.body;

    const { error } = await supabase.from("api_pix").insert([
      {
        provider: provider || null,
        key: key || null,
        secret: secret || null,
        owner: req.session.userId,
      },
    ]);

    if (error) {
      console.warn("[api_pix] insert falhou:", error.message);
    }

    return res.redirect("/api_pix");
  } catch (err) {
    console.error("Erro add pix:", err);
    return res.redirect("/api_pix");
  }
});

module.exports = router;
