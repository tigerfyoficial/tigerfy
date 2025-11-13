const express = require("express");
// const mongoose = require("mongoose");  // ❌ removido
const session = require("express-session");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");
require("dotenv").config();

const app = express();

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());
app.use(helmet());
app.use(morgan("tiny"));

// Sessão
app.use(
  session({
    secret: process.env.SESSION_SECRET || "tigerfy_secret",
    resave: false,
    saveUninitialized: false,
  })
);

// EVITA ERRO "active undefined"
app.use((req, res, next) => {
  res.locals.active = "";
  next();
});

// EJS + Layout
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout");
app.use(expressLayouts);

// Public
app.use(express.static(path.join(__dirname, "public")));

// ❌ Mongo totalmente removido (não conecta nada aqui)

// Rotas
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/dashboard"));
app.use("/", require("./routes/offers"));   // rota de bots/ofertas
app.use("/", require("./routes/api_pix"));

// 404
app.use((req, res) => {
  res.status(404).render("404", { title: "404 - TigerFy" });
});

// Start (modo local; Vercel entra no passo 2)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 TigerFy rodando! Porta ${PORT}`)
);

module.exports = app; // manter export para compat futura
