const express = require("express");
const router = express.Router();
const { supabase } = require("../lib/supabase");

// GET /login
router.get("/login", (req, res) => {
  res.render("login", {
    title: "Login - TigerFy",
    message: "",
    layout: false
  });
});

// POST /login → Supabase Auth
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "Preencha e-mail e senha.",
        layout: false
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "E-mail ou senha inválidos.",
        layout: false
      });
    }

    // sessão no nosso cookie (compatível com Vercel)
    req.session.user = {
      id: data.user.id,
      email: data.user.email
    };

    // pós-POST → 303 para /deck
    return res.redirect(303, "/deck");
  } catch (err) {
    console.error("Erro login:", err);
    return res.render("login", {
      title: "Login - TigerFy",
      message: "Erro inesperado ao entrar.",
      layout: false
    });
  }
});

// GET /register (opcional)
router.get("/register", (req, res) => {
  // se não quiser permitir cadastro público, redirecione:
  // return res.redirect("/login");

  // Se quiser manter a tela de registro existente, certifique-se que o EJS tem name="email" e name="password"
  res.render("register", {
    title: "Registrar - TigerFy",
    message: "",
    layout: false
  });
});

// POST /register → cria usuário no Supabase Auth
router.post("/register", async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.render("register", {
        title: "Registrar - TigerFy",
        message: "Informe e-mail e senha.",
        layout: false
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password
      // Você pode salvar `username` depois em uma tabela "profiles" se quiser.
    });

    if (error) {
      return res.render("register", {
        title: "Registrar - TigerFy",
        message: error.message || "Erro ao registrar.",
        layout: false
      });
    }

    // Se confirmação de e-mail estiver DESLIGADA, o user já entra
    if (data?.user) {
      req.session.user = { id: data.user.id, email: data.user.email };
      return res.redirect(303, "/deck");
    }

    // Se confirmação estiver LIGADA:
    return res.render("login", {
      title: "Login - TigerFy",
      message: "Verifique seu e-mail para confirmar a conta e depois faça login.",
      layout: false
    });
  } catch (err) {
    console.error("Erro register:", err);
    return res.render("register", {
      title: "Registrar - TigerFy",
      message: "Erro inesperado ao registrar.",
      layout: false
    });
  }
});

// GET /logout
router.get("/logout", (req, res) => {
  req.session = null; // limpa cookie
  res.redirect("/login");
});

module.exports = router;

// TEMP: debug de envs (remover depois)
router.get("/__envcheck", (req, res) => {
  res.json({
    hasAdminEmail: Boolean(process.env.ADMIN_EMAIL),
    hasAdminPass: Boolean(process.env.ADMIN_PASS),
    env: process.env.VERCEL_ENV || "unknown"
  });
});

