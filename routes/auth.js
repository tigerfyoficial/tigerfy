const express = require("express");
const router = express.Router();

// GET /login
router.get("/login", (req, res) => {
  res.render("login", {
    title: "Login - TigerFy",
    message: "",
    layout: false
  });
});

// POST /login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim();
    const ADMIN_PASS  = (process.env.ADMIN_PASS  || "").trim();

    if (!ADMIN_EMAIL || !ADMIN_PASS) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "Admin não configurado. Defina ADMIN_EMAIL e ADMIN_PASS na Vercel.",
        layout: false
      });
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASS) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "E-mail ou senha inválidos",
        layout: false
      });
    }

    // cria sessão
    req.session.user = { id: "admin", email: ADMIN_EMAIL };

    // 303 força GET no próximo passo (pós-POST)
    return res.redirect(303, "/deck");
  } catch (err) {
    console.error("Erro login:", err);
    return res.render("login", {
      title: "Login - TigerFy",
      message: "Erro inesperado ao entrar",
      layout: false
    });
  }
});

// GET /register -> desativado por enquanto
router.get("/register", (req, res) => res.redirect("/login"));

// GET /logout
router.get("/logout", (req, res) => {
  req.session = null; // cookie-session limpa assim
  res.redirect("/login");
});

module.exports = router;
