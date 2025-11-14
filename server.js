// server.js
const express = require("express");
const session = require("express-session");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");
require("dotenv").config();

const app = express();

// Confiança no proxy (Vercel) p/ headers corretos
app.set("trust proxy", 1);

// Middlewares base
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());
app.use(helmet());
app.use(morgan("tiny"));

// Sessão (MemoryStore temporária; ok p/ agora)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "tigerfy_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // secure: true // habilite quando usar domínio com HTTPS e proxy configurado
    },
  })
);

// Evita "active undefined" nos EJS
app.use((req, res, next) => {
  res.locals.active = "";
  next();
});

// EJS + Layout
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout");
app.use(expressLayouts);

// Arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// --- Rotas utilitárias
app.get("/health", (_req, res) => res.status(200).send("ok"));
app.get("/", (_req, res) => res.redirect("/login"));

// --- Gate de autenticação apenas para áreas privadas
const authGate = (req, res, next) => {
  // já autenticado → segue
  if (req.session && req.session.user) return next();
  // sempre liberar login e health
  if (req.path === "/login" || req.path === "/health") return next();
  return res.redirect("/login");
};

// --- Rotas
// públicas
app.use("/", require("./routes/auth"));          // /login (GET/POST), /logout

// privadas
app.use("/", authGate, require("./routes/dashboard"));
app.use("/", authGate, require("./routes/offers"));
app.use("/", authGate, require("./routes/api_pix"));

// 404 (deixe por último)
app.use((req, res) => {
  res.status(404).render("404", { title: "404 - TigerFy" });
});

// --- Execução: Vercel importa o app; local dá listen
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => console.log(`🚀 TigerFy rodando! Porta ${PORT}`));
}

