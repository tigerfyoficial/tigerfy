// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt"); // só se for usar no futuro em tabelas próprias
const { supabase } = require("../lib/supabase");

// ===== LOGIN (GET) =====
router.get("/login", (req, res) => {
  // tela de login sem layout global (mantém seu tema atual)
  res.render("login", {
    title: "Login - TigerFy",
    message: "",
    layout: false,
  });
});

// ===== LOGIN (POST) — Supabase Auth =====
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "E-mail ou senha inválidos.",
        layout: false,
      });
    }

    // sucesso: guardamos o id do user na sessão do Express
    req.session.userId = data.user.id;
    req.session.userEmail = data.user.email;

    return res.redirect("/deck");
  } catch (err) {
    console.error("Erro login:", err);
    return res.render("login", {
      title: "Login - TigerFy",
      message: "Erro inesperado ao entrar.",
      layout: false,
    });
  }
});

// ===== REGISTER (GET) =====
router.get("/register", (req, res) => {
  res.render("register", {
    title: "Registrar - TigerFy",
    message: "",
    layout: false,
  });
});

// ===== REGISTER (POST) — Supabase Auth =====
// Obs.: se "Email confirmations" estiver ON no Supabase,
// data.session virá null e o usuário terá que confirmar por e-mail.
// Para testes rápidos, crie usuários pelo Dashboard como Confirmed.
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username || "" }, // metadata opcional
      },
    });

    if (error) {
      return res.render("register", {
        title: "Registrar - TigerFy",
        message: error.message || "Erro ao registrar.",
        layout: false,
      });
    }

    // Se o projeto exige confirmação por e-mail:
    if (!data.session) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "Conta criada! Verifique seu e-mail para confirmar.",
        layout: false,
      });
    }

    // Caso sessão venha direto (auto-confirm), já loga:
    req.session.userId = data.user.id;
    req.session.userEmail = data.user.email;
    return res.redirect("/deck");
  } catch (err) {
    console.error("Erro register:", err);
    res.render("register", {
      title: "Registrar - TigerFy",
      message: "Erro ao registrar.",
      layout: false,
    });
  }
});

// ===== LOGOUT =====
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;
