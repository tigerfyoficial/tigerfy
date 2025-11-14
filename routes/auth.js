const express = require("express");
const router = express.Router();

// ===== LOGIN (GET) =====
router.get("/login", (req, res) => {
  res.render("login", {
    title: "Login - TigerFy",
    message: "",
    layout: false,
  });
});

// ===== LOGIN (POST) =====
router.post("/login", async (req, res) => {
  try {
    const emailInput = (req.body?.email || "").trim().toLowerCase();
    const passInput  = (req.body?.password || "").trim();

    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const ADMIN_PASS  = (process.env.ADMIN_PASS  || "").trim();

    if (!emailInput || !passInput) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "Preencha e-mail e senha.",
        layout: false,
      });
    }

    if (!ADMIN_EMAIL || !ADMIN_PASS) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "Credenciais do admin não configuradas (ADMIN_EMAIL e ADMIN_PASS).",
        layout: false,
      });
    }

    if (emailInput !== ADMIN_EMAIL) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "E-mail não encontrado",
        layout: false,
      });
    }

    if (passInput !== ADMIN_PASS) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "Senha incorreta",
        layout: false,
      });
    }

    // sucesso
    req.session.user = { id: "admin", email: ADMIN_EMAIL, name: "Admin" };
    return res.redirect("/deck");
  } catch (err) {
    console.error("Erro login:", err);
    return res.render("login", {
      title: "Login - TigerFy",
      message: "Erro inesperado ao entrar",
      layout: false,
    });
  }
});

// ===== REGISTER (GET) =====
router.get("/register", (req, res) => {
  res.render("register", {
    title: "Registrar - TigerFy",
    message: "Cadastro desativado no momento (necessita banco).",
    layout: false,
  });
});

// ===== REGISTER (POST) =====
router.post("/register", (req, res) => {
  return res.render("register", {
    title: "Registrar - TigerFy",
    message: "Cadastro desativado no momento (necessita banco).",
    layout: false,
  });
});

// ===== LOGOUT =====
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
