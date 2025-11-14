const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

/**
 * Login temporário sem DB:
 * Configure no Vercel/locally:
 *  - ADMIN_EMAIL
 *  - ADMIN_PASS           (senha em texto)  OU
 *  - ADMIN_PASS_BCRYPT    (hash bcrypt da senha)
 */

// ===== LOGIN (GET) =====
router.get("/login", (req, res) => {
  res.render("login", {
    title: "Login - TigerFy",
    message: "",
    layout: false, // mantém tela limpa de login
  });
});

// ===== LOGIN (POST) =====
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
    const PASS_PLAIN = process.env.ADMIN_PASS || "";
    const PASS_HASH = process.env.ADMIN_PASS_BCRYPT || "";

    if (!email || !password) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "Preencha e-mail e senha.",
        layout: false,
      });
    }

    if (!ADMIN_EMAIL || (!PASS_PLAIN && !PASS_HASH)) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "Credenciais do admin não configuradas (ADMIN_EMAIL e ADMIN_PASS/ADMIN_PASS_BCRYPT).",
        layout: false,
      });
    }

    // valida e-mail
    const emailOk = email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
    if (!emailOk) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "E-mail não encontrado",
        layout: false,
      });
    }

    // valida senha (bcrypt se houver hash; senão, texto puro)
    let passOk = false;
    if (PASS_HASH) {
      passOk = await bcrypt.compare(password, PASS_HASH);
    } else {
      passOk = password === PASS_PLAIN;
    }

    if (!passOk) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "Senha incorreta",
        layout: false,
      });
    }

    // sessão mínima
    req.session.user = {
      id: "admin",
      email: ADMIN_EMAIL,
      name: "Admin",
    };

    // redireciona para onde já estava no seu fluxo
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
  // Mantém a página para não quebrar links/tema, mas avisa que está desligado
  res.render("register", {
    title: "Registrar - TigerFy",
    message: "Cadastro temporariamente desativado.",
    layout: false,
  });
});

// ===== REGISTER (POST) =====
router.post("/register", async (req, res) => {
  // Sem DB por enquanto — retorna mensagem mantendo layout
  return res.render("register", {
    title: "Registrar - TigerFy",
    message: "Cadastro temporariamente desativado.",
    layout: false,
  });
});

// ===== LOGOUT =====
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
