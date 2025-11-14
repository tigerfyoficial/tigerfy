const express = require("express");
const router = express.Router();

// GET /login → renderiza a página
router.get("/login", (req, res) => {
  // se quiser, se já tiver logado pode ir ao dashboard:
  // if (req.session?.user) return res.redirect("/dashboard");
  res.status(200).render("login", { title: "Login - TigerFy" });
});

// POST /login → (placeholder) cria sessão e vai pro dashboard
router.post("/login", async (req, res) => {
  const email = (req.body?.email || "").trim();
  // TODO: validar no Supabase depois
  req.session.user = { id: "dev", email: email || "dev@local" };
  return res.redirect("/dashboard");
});

// GET /logout → destrói sessão
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
