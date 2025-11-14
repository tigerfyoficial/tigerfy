// routes/auth.js — versão mínima SEM redirects em /login
const express = require("express");
const router = express.Router();

// GET /login → só renderiza a view (sem redirecionar)
router.get("/login", (req, res) => {
  // Se sua view é views/login.ejs, deixe "login"
  // Se for outra pasta, ajuste o caminho aqui.
  res.status(200).render("login", { title: "Login - TigerFy" });
});

// POST /login → placeholder (vamos ligar ao Supabase depois)
router.post("/login", async (req, res) => {
  // TODO: validar user no Supabase e criar sessão
  // Por enquanto, só segue para o dashboard para não travar a navegação.
  req.session.user = { id: "dev", email: req.body.email || "dev@local" };
  return res.redirect("/dashboard");
});

// GET /logout → encerra sessão e volta ao login
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
