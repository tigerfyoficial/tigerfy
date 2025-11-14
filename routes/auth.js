// routes/auth.js
const express = require("express");
const router = express.Router();

// GET /login -> renderiza a view de login
router.get("/login", (req, res) => {
  // se já logado, manda pro dashboard
  if (req.session && req.session.user) return res.redirect("/dashboard");
  return res.render("login", { title: "Login - TigerFy" });
});

// POST /login -> autenticação dummy temporária (ajuste depois)
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  // TODO: trocar por validação real (Supabase etc.)
  if (!email || !password) {
    return res.status(400).render("login", {
      title: "Login - TigerFy",
      error: "Informe email e senha.",
    });
  }
  // salva sessão simples
  req.session.user = { email };
  return res.redirect("/dashboard");
});

// GET /logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
