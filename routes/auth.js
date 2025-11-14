const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");
const bcrypt = require("bcrypt");

// ===== LOGIN (GET) =====
router.get("/login", (req, res) => {
  // sem layout global aqui – tela limpa de login
  res.render("login", {
    title: "Login - TigerFy",
    message: "",
    layout: false,
  });
});

// ===== LOGIN (POST) =====
router.post("/login", async (req, res) => {
  try {
    // campos que vêm do <form> do login.ejs
    const { email, password } = req.body;

    // procura pelo e-mail cadastrado
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "E-mail não encontrado",
        layout: false,
      });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.render("login", {
        title: "Login - TigerFy",
        message: "Senha incorreta",
        layout: false,
      });
    }

    // logou com sucesso
    req.session.userId = admin._id;
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
    message: "",
    layout: false,
  });
});

// ===== REGISTER (POST) =====
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const exists = await Admin.findOne({ email });
    if (exists) {
      return res.render("register", {
        title: "Registrar - TigerFy",
        message: "E-mail já cadastrado",
        layout: false,
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      username,
      email,
      password: hash,
    });

    req.session.userId = admin._id;

    return res.redirect("/deck");
  } catch (err) {
    console.error("Erro register:", err);
    res.render("register", {
      title: "Registrar - TigerFy",
      message: "Erro ao registrar",
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
